/**
 * Web Inspector engine — DevTools-grade inspection for ANY page, powered
 * by the native XCoderWebView plugin.
 *
 * How it works:
 *  1. A hidden (or fullscreen) webview is created for the target URL.
 *  2. CAPTURE_SCRIPT is registered with `setInjectScript()` — the native
 *     side injects it at document start AND document end of every
 *     navigation, so console/network capture starts before page scripts.
 *  3. The capture script monkey-patches console, window errors, fetch and
 *     XMLHttpRequest, reporting through the `webview.postMessage` bridge.
 *  4. The app drives DOM inspection with command messages
 *     (`__inspectorCmd`) — getTree/inspect/highlight/searchDom — answered
 *     as `__inspector` result messages. Node paths are index chains from
 *     the document root ("0.2.1"), stable for a loaded page.
 *
 * Pure helpers (formatting, path math) live here too so they are
 * unit-testable without a webview.
 */

import webviewApi from "lib/webview";

/** Max characters of outerHTML returned per inspect call. */
export const OUTER_HTML_LIMIT = 20000;

/**
 * The page-side capture + command script. Registered per webview session;
 * the native layer re-injects it on every navigation (document start +
 * document end), giving true DevTools-style capture from the first request.
 */
export const CAPTURE_SCRIPT = String.raw`
(function(){
  if (window.__xcoderInspector) { return; }
  // mark NOW: the native side re-injects this script on every navigation
  // AND again on pageFinished — without the flag each injection wrapped
  // console/fetch/XHR a second time, posting every log twice.
  window.__xcoderInspector = true;
  var seq = 1;
  var highlighted = null;
  var highlightedPrev = null;
  function send(msg){
    try {
      msg.__inspector = 1;
      msg.seq = seq++;
      if (window.webview && webview.postMessage) { webview.postMessage(JSON.stringify(msg)); }
    } catch (e) { /* bridge unavailable */ }
  }
  function fmt(v, depth){
    try {
      if (v === null) return "null";
      if (v === undefined) return "undefined";
      if (typeof v === "string") return v.length > 4000 ? v.slice(0, 4000) + "…" : v;
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      if (v instanceof Error) return (v.stack || (v.name + ": " + v.message));
      if (typeof v === "function") return "ƒ " + (v.name || "anonymous") + "()";
      if (v instanceof Element) return "<" + v.tagName.toLowerCase() + (v.id ? "#" + v.id : "") + ">";
      var seen = depth || 0;
      if (seen > 3) return "…";
      return JSON.stringify(v, function(key, val){
        if (val === undefined) return "undefined";
        if (typeof val === "function") return "ƒ()";
        if (val instanceof Element) return "<" + val.tagName.toLowerCase() + ">";
        return val;
      }).slice(0, 4000);
    } catch (e) { return String(v); }
  }
  // console capture
  ["log", "warn", "error", "info", "debug"].forEach(function(level){
    var orig = console[level] ? console[level].bind(console) : function(){};
    console[level] = function(){
      var parts = [];
      for (var i = 0; i < arguments.length; i++) parts.push(fmt(arguments[i]));
      send({ cmd: "console", data: { level: level, text: parts.join(" "), ts: Date.now() } });
      try { orig.apply(console, arguments); } catch (e) {}
    };
  });
  window.addEventListener("error", function(e){
    var text = e.message || String(e.error || "Error");
    if (e.filename) { text += " (" + String(e.filename).split("/").pop() + ":" + e.lineno + ")"; }
    send({ cmd: "console", data: { level: "error", text: text, ts: Date.now() } });
  });
  window.addEventListener("unhandledrejection", function(e){
    send({ cmd: "console", data: { level: "error", text: "Unhandled rejection: " + fmt(e.reason), ts: Date.now() } });
  });
  // network capture — fetch
  var of = window.fetch;
  if (of) {
    window.fetch = function(input, init){
      var url = typeof input === "string" ? input : (input && input.url) || String(input);
      var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
      var t0 = Date.now();
      return of.apply(this, arguments).then(function(res){
        var ct = "";
        try { ct = (res.headers && res.headers.get("content-type")) || ""; } catch (e) {}
        send({ cmd: "network", data: { method: method, url: String(url), status: res.status, ok: res.ok, ms: Date.now() - t0, type: ct } });
        return res;
      }, function(err){
        send({ cmd: "network", data: { method: method, url: String(url), status: 0, failed: 1, ms: Date.now() - t0, error: fmt(err && err.message || err) } });
        throw err;
      });
    };
  }
  // network capture — XHR
  var ox = XMLHttpRequest.prototype.open;
  var os = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m, u){
    this.__xc = { method: String(m || "GET").toUpperCase(), url: String(u || "") };
    return ox.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(){
    var self = this;
    var t0 = Date.now();
    this.addEventListener("loadend", function(){
      var size = 0;
      try { size = Number(self.getResponseHeader("content-length")) || 0; } catch (e) {}
      if (!size && self.response) {
        try { size = self.response.length || JSON.stringify(self.response).length; } catch (e) {}
      }
      var ct = "";
      try { ct = self.getResponseHeader("content-type") || ""; } catch (e) {}
      send({ cmd: "network", data: { method: self.__xc ? self.__xc.method : "GET", url: self.__xc ? self.__xc.url : "", status: self.status, ms: Date.now() - t0, size: size, type: ct } });
    });
    return os.apply(this, arguments);
  };
  // DOM commands from the app
  if (window.webview && webview.onMessage) {
    webview.onMessage(function(msg){
      if (!msg || msg.__inspectorCmd !== true) return;
      try { handle(msg); } catch (e) {
        send({ cmd: msg.cmd, id: msg.id, error: fmt(e && e.message || e) });
      }
    });
  }
  function nodeAt(path){
    var node = document;
    var parts = String(path || "").split(".").filter(function(p){ return p !== ""; });
    for (var i = 0; i < parts.length; i++) {
      node = node.children[Number(parts[i])];
      if (!node) return null;
    }
    return node;
  }
  function pathOf(node){
    var parts = [];
    while (node && node !== document) {
      var parent = node.parentElement;
      if (!parent) return null;
      var idx = Array.prototype.indexOf.call(parent.children, node);
      parts.unshift(String(idx));
      node = parent;
    }
    return parts.join(".");
  }
  function attrsOf(node){
    var attrs = {};
    if (node.attributes) {
      for (var i = 0; i < node.attributes.length; i++) {
        var a = node.attributes[i];
        attrs[a.name] = a.value;
      }
    }
    return attrs;
  }
  function describe(node){
    if (!node) return null;
    var tag = node.nodeType === 3 ? "#text" : node.tagName ? node.tagName.toLowerCase() : String(node.nodeName || "");
    var text = "";
    if (node.nodeType === 3) { text = String(node.textContent || "").trim().slice(0, 120); }
    var classes = node.classList && node.classList.length ? Array.prototype.join.call(node.classList, " ") : "";
    return {
      path: pathOf(node),
      tag: tag,
      id: node.id || "",
      classes: classes,
      childCount: node.children ? node.children.length : 0,
      text: text,
      attrs: attrsOf(node)
    };
  }
  function handle(msg){
    switch (msg.cmd) {
      case "getTree": {
        var node = nodeAt(msg.path);
        if (!node) { send({ cmd: "getTree", id: msg.id, data: null }); return; }
        var children = [];
        var limit = 60;
        var total = node.children ? node.children.length : 0;
        for (var i = 0; i < total && children.length < limit; i++) {
          var child = describe(node.children[i]);
          if (child) children.push(child);
        }
        send({ cmd: "getTree", id: msg.id, data: { self: describe(node), children: children, total: total } });
        return;
      }
      case "inspect": {
        var node = nodeAt(msg.path);
        if (!node) { send({ cmd: "inspect", id: msg.id, data: null }); return; }
        var box = node.getBoundingClientRect();
        var styles = {};
        try {
          var cs = getComputedStyle(node);
          ["display","position","width","height","margin","padding","color","background","background-color","font-size","font-family","font-weight","line-height","border","border-radius","z-index","opacity","overflow","flex-direction","justify-content","align-items","grid-template-columns","text-align","text-decoration","box-shadow","transform","visibility"].forEach(function(prop){ styles[prop] = cs.getPropertyValue(prop); });
        } catch (e) {}
        var html = "";
        try { html = node.outerHTML || String(node.nodeValue || ""); } catch (e) {}
        send({ cmd: "inspect", id: msg.id, data: {
          self: describe(node),
          html: html.slice(0, ${OUTER_HTML_LIMIT}),
          htmlTruncated: html.length > ${OUTER_HTML_LIMIT},
          box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) },
          styles: styles
        } });
        return;
      }
      case "highlight": {
        var node = nodeAt(msg.path);
        if (!node) { send({ cmd: "highlight", id: msg.id, error: "not found" }); return; }
        clearHighlight();
        highlighted = node;
        highlightedPrev = node.getAttribute("style");
        node.setAttribute("style", (highlightedPrev ? highlightedPrev + ";" : "") + "outline: 2px solid #f8c441 !important; outline-offset: 1px; background-color: rgba(248,196,65,.18) !important;");
        send({ cmd: "highlight", id: msg.id, data: { ok: 1 } });
        return;
      }
      case "clearHighlight": {
        clearHighlight();
        send({ cmd: "clearHighlight", id: msg.id, data: { ok: 1 } });
        return;
      }
      case "searchDom": {
        var selector = String(msg.selector || "").trim();
        var results = [];
        if (selector) {
          var nodes = [];
          try { nodes = Array.prototype.slice.call(document.querySelectorAll(selector)); } catch (e) {}
          for (var i = 0; i < nodes.length && results.length < 100; i++) {
            var d = describe(nodes[i]);
            if (d) results.push(d);
          }
        }
        send({ cmd: "searchDom", id: msg.id, data: { matches: results, total: nodes.length } });
        return;
      }
      default:
        send({ cmd: msg.cmd, id: msg.id, error: "unknown command" });
    }
  }
  function clearHighlight(){
    if (highlighted) {
      if (highlightedPrev === null) highlighted.removeAttribute("style");
      else highlighted.setAttribute("style", highlightedPrev);
    }
    highlighted = null;
    highlightedPrev = null;
  }
})();`;

const SESSION_TTL = 30 * 60 * 1000;

/** @type {import("lib/webview").default|null} active inspector webview */
let session = null;
/** @type {((event: string, data: any) => void)|null} app-level event handler */
let appHandler = null;
/** @type {Map<string, {resolve: (v: any) => void, reject: (e: Error) => void, timer: ReturnType<typeof setTimeout>}>} */
const pendingCommands = new Map();
/** @type {ReturnType<typeof setTimeout>|null} */
let ttlTimer = null;

/** Routes one webview instance message (capture replies). */
function routeInstanceMessage(parsed) {
	if (!parsed || !parsed.__inspector) return;
	const pending = parsed.id ? pendingCommands.get(parsed.id) : null;
	if (pending) {
		pendingCommands.delete(parsed.id);
		clearTimeout(pending.timer);
		if (parsed.error) pending.reject(new Error(parsed.error));
		else pending.resolve(parsed.data);
	}
	appHandler?.("inspectorMessage", parsed);
}

/** Attaches page event + message listeners to a session instance. */
function attachSession(instance) {
	instance.on("pageFinished", (data) => appHandler?.("pageFinished", data));
	instance.on("titleChanged", (data) => appHandler?.("titleChanged", data));
	instance.on("closed", () => {
		if (session === instance) {
			session = null;
			appHandler?.("pageClosed", {});
		}
	});
	instance.onMessage(routeInstanceMessage);
}

/**
 * Starts (or replaces) an inspector webview session and navigates it to a URL.
 * @param {string} url
 * @param {{mode?: "hidden"|"fullscreen", visible?: boolean}} [options]
 * @returns {Promise<string>} session id
 */
export async function openInspectorSession(url, options = {}) {
	const mode = options.mode || "fullscreen";
	const visible = options.visible !== false;

	// one live session — replacing it kills the previous webview
	await closeInspectorSession();

	const instance = await webviewApi.create({
		mode,
		title: url,
		allowNavigation: true,
		allowDownloads: true,
		visible,
	});
	session = instance;
	armTtl();
	attachSession(instance);
	// capture hooks BEFORE loadURL → document-start recording
	await instance.setInjectScript(CAPTURE_SCRIPT);
	await instance.loadURL(url);
	return instance.id;
}

/**
 * Destroys the active inspector session, if any.
 */
export async function closeInspectorSession() {
	clearTimeout(ttlTimer);
	ttlTimer = null;
	for (const [token, pending] of pendingCommands) {
		clearTimeout(pending.timer);
		pending.reject(new Error("Inspector session closed"));
		pendingCommands.delete(token);
	}
	if (session) {
		const instance = session;
		session = null;
		await instance.destroy().catch(() => {});
	}
}

/** @returns {string|null} active session id */
export function activeInspectorSession() {
	return session?.id ?? null;
}

/** Reloads the active inspector page. */
export async function reloadInspectorSession() {
	if (!session) return;
	await session.reload();
}

/** Brings the inspected page to the foreground (fullscreen sessions). */
export async function showInspectorPage() {
	if (!session) return;
	await session.show();
}

/**
 * Loads a URL in a temporary hidden webview and returns the fully
 * rendered DOM (outerHTML) — the scraper's "browser view" fetch. Handles
 * sites whose raw HTML is an empty JS shell.
 * @param {string} url
 * @param {{timeoutMs?: number}} [options]
 * @returns {Promise<{html: string, url: string, title: string}>}
 */
export async function fetchRenderedHtml(url, options = {}) {
	const timeoutMs = options.timeoutMs || 45000;
	const instance = await webviewApi.create({
		mode: "hidden",
		allowNavigation: true,
		visible: false,
	});

	try {
		await new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				instance.off("pageFinished", onPageFinished);
				reject(new Error(`timeout: ${url}`));
			}, timeoutMs);
			function onPageFinished(_event, data) {
				clearTimeout(timer);
				resolve(data);
			}
			instance.on("pageFinished", onPageFinished);
			instance.loadURL(url).catch((error) => {
				instance.off("pageFinished", onPageFinished);
				clearTimeout(timer);
				reject(error);
			});
		});
		// settle a moment so late scripts paint their DOM
		await new Promise((resolve) => setTimeout(resolve, 1200));
		const html = await instance.evaluate("document.documentElement.outerHTML");
		const meta = await instance
			.evaluate("JSON.stringify({t: document.title, u: location.href})")
			.catch(() => null);
		let title = "";
		let finalUrl = url;
		try {
			const parsedMeta = JSON.parse(meta || "{}");
			title = parsedMeta.t || "";
			finalUrl = parsedMeta.u || url;
		} catch {
			/* keep defaults */
		}
		return { html: String(html || ""), url: finalUrl, title };
	} finally {
		instance.destroy().catch(() => {});
	}
}

/**
 * Registers the inspector event handler (page events + capture messages).
 * @param {(event: string, data: any) => void} handler
 */
export function onInspectorEvent(handler) {
	appHandler = handler;
}

/**
 * Sends an inspector command to the page and resolves with its response.
 * @param {string} cmd
 * @param {Record<string, any>} [payload]
 * @param {number} [timeoutMs]
 * @returns {Promise<any>}
 */
export function sendInspectorCommand(cmd, payload = {}, timeoutMs = 15000) {
	if (!session) return Promise.reject(new Error("No inspector session"));

	return new Promise((resolve, reject) => {
		const token = `cmd-${cmd}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const timer = setTimeout(() => {
			pendingCommands.delete(token);
			reject(new Error(`Inspector timeout: ${cmd}`));
		}, timeoutMs);
		pendingCommands.set(token, { resolve, reject, timer });

		session
			.postMessage(
				JSON.stringify({
					__inspectorCmd: true,
					cmd,
					id: token,
					...payload,
				}),
			)
			.catch((error) => {
				pendingCommands.delete(token);
				clearTimeout(timer);
				reject(error);
			});
	});
}

/**
 * Runs arbitrary JS in the inspected page (Console tab "run").
 * @param {string} code
 * @returns {Promise<{ok: boolean, value?: any, error?: string}>}
 */
export async function evaluateInPage(code) {
	if (!session) throw new Error("No inspector session");
	const wrapped =
		`(function(){ try {` +
		` var __r = eval(${JSON.stringify(code)});` +
		` return JSON.stringify({ok:true, value: __r === undefined ? null : __r});` +
		` } catch (e) { return JSON.stringify({ok:false, error: String(e && e.message || e)}); } })()`;
	const raw = await session.evaluate(wrapped);
	try {
		return JSON.parse(raw);
	} catch {
		return { ok: false, error: String(raw) };
	}
}

function armTtl() {
	clearTimeout(ttlTimer);
	ttlTimer = setTimeout(() => {
		closeInspectorSession().catch(() => {});
	}, SESSION_TTL);
}

// ------------------------------------------------------------------ pure

/**
 * Short label for a network entry URL (host + last path segment).
 * @param {string} url
 * @returns {string}
 */
export function networkLabel(url) {
	try {
		const parsed = new URL(url);
		const segments = parsed.pathname.split("/").filter(Boolean);
		const last = segments[segments.length - 1] || "/";
		return `${parsed.host}/${decodeURIComponent(last).slice(0, 60)}`;
	} catch {
		return String(url || "").slice(0, 80);
	}
}

/**
 * Groups a network entry into a coarse resource type for the filter chips.
 * @param {{url?: string, type?: string, method?: string}} entry
 * @returns {"xhr"|"css"|"js"|"img"|"font"|"doc"|"other"}
 */
export function networkType(entry) {
	const url = String(entry?.url || "");
	const type = String(entry?.type || "");
	const ext = url.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
	if (
		/json|xml|text\/plain|x-www-form-urlencoded|graphql/.test(type) ||
		entry?.method === "POST" ||
		ext === "json"
	) {
		return "xhr";
	}
	if (/css/.test(type) || ext === "css") return "css";
	if (/javascript|ecmascript/.test(type) || ext === "js" || ext === "mjs")
		return "js";
	if (
		/image|svg/.test(type) ||
		["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "avif"].includes(ext)
	)
		return "img";
	if (
		/font|woff|ttf|otf/.test(type) ||
		["woff", "woff2", "ttf", "otf", "eot"].includes(ext)
	)
		return "font";
	if (/html/.test(type) || ext === "html") return "doc";
	return "other";
}

/**
 * Normalizes a user-typed address into a loadable URL.
 * @param {string} input
 * @returns {string|null}
 */
export function normalizeAddress(input) {
	const value = String(input || "").trim();
	if (!value) return null;
	if (/^https?:\/\//i.test(value)) return value;
	if (
		/^localhost(:\d+)?(\/|$)/i.test(value) ||
		/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(value)
	) {
		return `http://${value}`;
	}
	return `https://${value}`;
}
