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
 *     (`__inspectorCmd`) — getTree/inspect/highlight/searchDom/searchText/
 *     setAttr/deleteNode/setOuterHTML/setPickMode — answered as
 *     `__inspector` result messages. Node paths are index chains from
 *     the document root ("0.2.1"), stable for a loaded page.
 *
 * Pure helpers (formatting, path math) live here too so they are
 * unit-testable without a webview.
 */

import webviewApi from "lib/webview";

/** Max characters of outerHTML returned per inspect call. */
export const OUTER_HTML_LIMIT = 20000;

/** Max characters of a captured fetch/XHR response body (DevTools-style
 * "Response" preview). Media and binary payloads are never captured. */
export const BODY_CAPTURE_LIMIT = 262144;

/**
 * The page-side capture + command script. Registered per webview session;
 * the native layer re-injects it on every navigation (document start +
 * document end), giving true DevTools-style capture from the first request.
 */
export const CAPTURE_SCRIPT = String.raw`
(function(){
  // ---- one-shot page capture (console, errors, fetch, XHR) ---------------
  // The guard keeps the hooks from double-wrapping when the native side
  // re-injects this script on every navigation AND again on pageFinished
  // (each wrap would post every log twice).
  var seq = 1;
  var highlighted = null;
  var highlightedPrev = null;
  // Buffered mirror of every CAPTURE entry (console/network/picked). The
  // app-side session POLLS this array through the independent evaluate()
  // channel, so entries still reach DevTools even when the postMessage
  // bridge is dead (rebuilt window.webview, mid-navigation dispatch…).
  // Initialised BEFORE the one-shot guard so a re-injection never wipes
  // entries buffered by the previous document context.
  if (!window.__xcoderLog) { window.__xcoderLog = []; }
  function send(msg){
    try {
      msg.__inspector = 1;
      msg.seq = seq++;
      if (!msg.id && (msg.cmd === "console" || msg.cmd === "network" || msg.cmd === "picked")) {
        try {
          window.__xcoderLog.push(msg);
          if (window.__xcoderLog.length > 2000) {
            window.__xcoderLog.splice(0, window.__xcoderLog.length - 2000);
          }
        } catch (e2) { /* buffer unavailable */ }
      }
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
  if (!window.__xcoderInspector) {
    window.__xcoderInspector = true;
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
    var BODY_LIMIT = ${BODY_CAPTURE_LIMIT};
    // Text-ish responses get their body captured (DevTools "Response" tab);
    // media/binary payloads are skipped and huge bodies race a 1.5s budget
    // so a slow download can never delay the network entry itself.
    function captureBody(promise, ct){
      try {
        if (!promise) return Promise.resolve(null);
        if (/^(image|video|audio|font)\//i.test(ct) || /octet-stream/i.test(ct)) return Promise.resolve(null);
        return Promise.race([
          promise.then(function(text){
            text = String(text || "");
            if (text.length > BODY_LIMIT) return { body: text.slice(0, BODY_LIMIT), truncated: true };
            return { body: text };
          }),
          new Promise(function(resolve){ setTimeout(function(){ resolve(null); }, 1500); })
        ]);
      } catch (e) { return Promise.resolve(null); }
    }
    if (of) {
      window.fetch = function(input, init){
        var url = typeof input === "string" ? input : (input && input.url) || String(input);
        var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
        var t0 = Date.now();
        return of.apply(this, arguments).then(function(res){
          var ct = "";
          try { ct = (res.headers && res.headers.get("content-type")) || ""; } catch (e) {}
          var finish = function(body){
            send({ cmd: "network", data: { method: method, url: String(url), status: res.status, ok: res.ok, ms: Date.now() - t0, type: ct, body: body && body.body, bodyTruncated: body && body.truncated } });
          };
          captureBody(res.clone ? res.clone().text() : null, ct).then(finish, function(){ finish(null); });
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
        // response body — text/json only, same limits as the fetch transport
        var body = null;
        var truncated = false;
        try {
          var raw = "";
          if (self.responseType === "" || self.responseType === "text") raw = String(self.responseText || "");
          else if (self.responseType === "json") raw = JSON.stringify(self.response);
          if (raw && !/^(image|video|audio|font)\//i.test(ct) && !/octet-stream/i.test(ct)) {
            if (raw.length > BODY_LIMIT) { raw = raw.slice(0, BODY_LIMIT); truncated = true; }
            body = raw;
          }
        } catch (e) {}
        send({ cmd: "network", data: { method: self.__xc ? self.__xc.method : "GET", url: self.__xc ? self.__xc.url : "", status: self.status, ms: Date.now() - t0, size: size, type: ct, body: body, bodyTruncated: truncated } });
      });
      return os.apply(this, arguments);
    };
  }
  // ---- command channel: registered on EVERY injection --------------------
  // Navigations (and some bridges) rebuild window.webview with empty
  // callbacks while the one-shot guard above stays set — a handler
  // registered only once would never hear commands again. Re-register on
  // each injection; offMessage keeps a same-context re-injection from
  // doubling the handler up.
  if (window.webview && webview.onMessage) {
    if (window.__xcoderCmdHandler) {
      try { webview.offMessage(window.__xcoderCmdHandler); } catch (e) {}
    }
    window.__xcoderCmdHandler = function(msg){
      if (!msg || msg.__inspectorCmd !== true) return;
      try { handle(msg); } catch (e) {
        send({ cmd: msg.cmd, id: msg.id, error: fmt(e && e.message || e) });
      }
    };
    webview.onMessage(window.__xcoderCmdHandler);
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
  // Documents have no getBoundingClientRect/attributes — everything the
  // inspect/highlight paths touch (box, styles, outerHTML, highlight) is
  // element-only, so an empty path (the tree root) resolves to the
  // documentElement instead of crashing with
  // «node.getBoundingClientRect is not a function».
  function asElement(node){
    if (!node) return null;
    if (node.nodeType === 9) return node.documentElement || node.body || null;
    if (node.nodeType === 3 || node.nodeType === 8) return node.parentElement || null;
    return node.nodeType === 1 ? node : null;
  }
  function pathOf(node){
    if (!node || node === document) return "";
    if (node === document.documentElement) return "0";
    var parts = [];
    var cur = node;
    while (cur && cur !== document) {
      var parent = cur.parentElement || cur.parentNode;
      if (!parent) return null;
      var idx = Array.prototype.indexOf.call(parent.children, cur);
      if (idx < 0) return null;
      parts.unshift(String(idx));
      cur = parent === document.documentElement ? document : parent;
    }
    parts.unshift("0");
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
  // ---- element picker (DevTools «inspect element» cursor) --------------
  // While active, the FIRST tap anywhere in the page is intercepted,
  // reported to the app as a "picked" message and the mode exits — the
  // page never receives the click, so nothing is followed/opened.
  var pickHandler = null;
  function enablePick(){
    if (pickHandler) return;
    pickHandler = function(e){
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      var d = describe(e && e.target);
      if (d) send({ cmd: "picked", data: d });
      disablePick();
    };
    document.addEventListener("click", pickHandler, true);
    try { document.documentElement.style.cursor = "crosshair"; } catch (err) {}
  }
  function disablePick(){
    if (!pickHandler) return;
    document.removeEventListener("click", pickHandler, true);
    pickHandler = null;
    try { document.documentElement.style.cursor = ""; } catch (err) {}
  }
  function describe(node){
    if (!node) return null;
    if (node.nodeType === 9) node = node.documentElement || node;
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
        var node = asElement(nodeAt(msg.path));
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
        var node = asElement(nodeAt(msg.path));
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
        var nodes = [];
        if (selector) {
          try { nodes = Array.prototype.slice.call(document.querySelectorAll(selector)); } catch (e) {}
          for (var i = 0; i < nodes.length && results.length < 100; i++) {
            var d = describe(nodes[i]);
            if (d) results.push(d);
          }
        }
        send({ cmd: "searchDom", id: msg.id, data: { matches: results, total: nodes.length } });
        return;
      }
      case "searchText": {
        var needle = String(msg.text || "").toLowerCase();
        var textMatches = [];
        var seenMatch = {};
        if (needle) {
          var rootEl = document.body || document.documentElement;
          var walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null, false);
          while (walker.nextNode() && textMatches.length < 100) {
            var value = walker.currentNode.nodeValue || "";
            if (value.toLowerCase().indexOf(needle) < 0) continue;
            var hit = walker.currentNode.parentElement;
            if (!hit) continue;
            var hitInfo = describe(hit);
            if (hitInfo && !seenMatch[hitInfo.path]) {
              seenMatch[hitInfo.path] = 1;
              textMatches.push(hitInfo);
            }
          }
        }
        send({ cmd: "searchText", id: msg.id, data: { matches: textMatches } });
        return;
      }
      case "setPickMode": {
        if (msg.on) enablePick();
        else disablePick();
        send({ cmd: "setPickMode", id: msg.id, data: { ok: 1 } });
        return;
      }
      case "setAttr": {
        var el = asElement(nodeAt(msg.path));
        if (!el || !msg.name) { send({ cmd: "setAttr", id: msg.id, error: "not found" }); return; }
        try {
          if (msg.value === "" || msg.value === null || msg.value === undefined) el.removeAttribute(String(msg.name));
          else el.setAttribute(String(msg.name), String(msg.value));
          send({ cmd: "setAttr", id: msg.id, data: { ok: 1, self: describe(el) } });
        } catch (e) { send({ cmd: "setAttr", id: msg.id, error: fmt(e && e.message || e) }); }
        return;
      }
      case "deleteNode": {
        var victim = asElement(nodeAt(msg.path));
        if (!victim || !victim.parentElement) { send({ cmd: "deleteNode", id: msg.id, error: "not found" }); return; }
        var parentPath = pathOf(victim.parentElement);
        victim.parentElement.removeChild(victim);
        send({ cmd: "deleteNode", id: msg.id, data: { ok: 1, parentPath: parentPath } });
        return;
      }
      case "setOuterHTML": {
        var target = asElement(nodeAt(msg.path));
        if (!target || !target.parentElement) { send({ cmd: "setOuterHTML", id: msg.id, error: "not found" }); return; }
        try {
          target.outerHTML = String(msg.html || "");
          send({ cmd: "setOuterHTML", id: msg.id, data: { ok: 1, parentPath: pathOf(target.parentElement) || String(msg.path || "") } });
        } catch (e) { send({ cmd: "setOuterHTML", id: msg.id, error: fmt(e && e.message || e) }); }
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
/** Poll cadence for the evaluate-channel capture drain (see POLL_SNIPPET). */
const POLL_INTERVAL_MS = 1200;

/** @type {import("lib/webview").default|null} active inspector webview */
let session = null;
/** @type {((event: string, data: any) => void)|null} app-level event handler */
let appHandler = null;
/** @type {Map<string, {resolve: (v: any) => void, reject: (e: Error) => void, timer: ReturnType<typeof setTimeout>}>} */
const pendingCommands = new Map();
/** @type {ReturnType<typeof setTimeout>|null} */
let ttlTimer = null;
/** @type {ReturnType<typeof setInterval>|null} evaluate-channel capture drain */
let pollTimer = null;
/** href whose pageFinished was already delivered (native event OR poll) */
let completedHref = "";
/** last title delivered to avoid duplicate titleChanged events */
let deliveredTitle = "";
/** capture seq values already delivered through the push bridge */
let deliveredSeq = new Set();

/**
 * Runs INSIDE the inspected page on every poll tick: drains the buffered
 * capture entries (console/network/picked) and reports navigation state.
 * The evaluate channel is independent of the postMessage bridge, so this
 * keeps Consola/Rede alive even when the bridge silently dies on device.
 */
const POLL_SNIPPET = `(function(){
var out={href:"",title:"",ready:"",entries:null};
try{out.href=location.href;}catch(e){}
try{out.title=document.title;}catch(e){}
try{out.ready=document.readyState;}catch(e){}
try{if(window.__xcoderLog&&window.__xcoderLog.length){out.entries=window.__xcoderLog.splice(0,window.__xcoderLog.length);}}catch(e){}
return JSON.stringify(out);})()`;

/** Stops the evaluate-channel capture drain. */
function stopSessionPolling() {
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
}

/**
 * Marks a capture entry as delivered (push bridge) so the poll drain
 * never duplicates it.
 * @param {any} parsed
 * @returns {boolean} true when the entry was already delivered
 */
function alreadyDelivered(parsed) {
	if (parsed?.seq == null) return false;
	if (deliveredSeq.has(parsed.seq)) return true;
	deliveredSeq.add(parsed.seq);
	if (deliveredSeq.size > 4000) {
		deliveredSeq = new Set([...deliveredSeq].slice(-2000));
	}
	return false;
}

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
	if (parsed.id) {
		// command reply — always forwarded (a poll-drained reply still
		// resolves the pending promise below, but the app handler needs it
		// only for capture entries)
		appHandler?.("inspectorMessage", parsed);
		return;
	}
	if (alreadyDelivered(parsed)) return;
	appHandler?.("inspectorMessage", parsed);
}

/** Attaches page event + message listeners to a session instance. */
function attachSession(instance) {
	// lib/webview.js dispatches event listeners as callback(event, data) —
	// the payload is the SECOND argument. The one-arg arrow here used to
	// receive the EVENT NAME string as «data», so the plugin saw
	// pageFinished with no url/title (empty «▸» console line, dead
	// Elements refresh) — fetchRenderedHtml already used the right shape.
	instance.on("pageFinished", (_event, data) => {
		// the native event is authoritative — remember it so the poll
		// never re-synthesizes the same navigation (dedupe by href)
		if (data?.url) completedHref = String(data.url);
		if (data?.title) deliveredTitle = String(data.title);
		appHandler?.("pageFinished", data);
	});
	instance.on("titleChanged", (_event, data) => {
		if (data?.title) deliveredTitle = String(data.title);
		appHandler?.("titleChanged", data);
	});
	instance.on("closed", () => {
		if (session === instance) {
			session = null;
			stopSessionPolling();
			appHandler?.("pageClosed", {});
		}
	});
	instance.onMessage(routeInstanceMessage);
}

/**
 * Drains the page-side capture buffer through the independent evaluate
 * channel and synthesizes pageFinished/titleChanged when the native
 * events are lost (they share the same Cordova callback as everything
 * else — a lost callback must not leave the Elements/Consola tabs dead).
 * @param {import("lib/webview").default} instance
 */
function startSessionPolling(instance) {
	stopSessionPolling();
	completedHref = "";
	deliveredTitle = "";
	deliveredSeq = new Set();
	pollTimer = setInterval(() => {
		if (session !== instance) {
			stopSessionPolling();
			return;
		}
		instance
			.evaluate(POLL_SNIPPET)
			.then((raw) => {
				let parsed;
				try {
					parsed = JSON.parse(typeof raw === "string" ? raw : "{}");
				} catch {
					return;
				}
				const href = String(parsed?.href || "");
				const title = String(parsed?.title || "");
				if (
					(parsed?.ready === "complete" || parsed?.ready === "interactive") &&
					href &&
					href !== completedHref
				) {
					completedHref = href;
					if (title) deliveredTitle = title;
					appHandler?.("pageFinished", { url: href, title });
				} else if (title && title !== deliveredTitle) {
					deliveredTitle = title;
					appHandler?.("titleChanged", { title });
				}
				const entries = parsed?.entries;
				if (Array.isArray(entries)) {
					for (const entry of entries) {
						routeInstanceMessage({ ...entry, __polled: true });
					}
				}
			})
			.catch(() => {
				/* mid-navigation — retry on the next tick */
			});
	}, POLL_INTERVAL_MS);
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
	// evaluate-channel capture drain — works even when the message bridge
	// is dead, so Elements/Consola/Rede are never permanently empty
	startSessionPolling(instance);
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
	stopSessionPolling();
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
 * Commands with an evaluate twin (getTree/inspect/searchDom/searchText)
 * go through the evaluate channel FIRST — it is the proven, bridge-
 * independent path (Storage tab, console run) — and only mirror through
 * the postMessage bridge when evaluate fails. Remaining commands (live
 * highlight, pick mode, node edits) use the bridge directly.
 * @param {string} cmd
 * @param {Record<string, any>} [payload]
 * @param {number} [timeoutMs]
 * @returns {Promise<any>}
 */
export function sendInspectorCommand(cmd, payload = {}, timeoutMs = 8000) {
	if (!session) return Promise.reject(new Error("No inspector session"));
	if (EVAL_COMMANDS[cmd]) {
		return commandViaEval(cmd, payload).catch(() =>
			bridgeCommand(cmd, payload, timeoutMs),
		);
	}
	return bridgeCommand(cmd, payload, timeoutMs);
}

/**
 * Sends a command through the webview postMessage bridge and resolves
 * with the page's reply (8s timeout).
 * @param {string} cmd
 * @param {Record<string, any>} [payload]
 * @param {number} [timeoutMs]
 * @returns {Promise<any>}
 */
function bridgeCommand(cmd, payload = {}, timeoutMs = 8000) {
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
 * Self-contained evaluate-channel twins of the capture-script commands.
 * The postMessage bridge can silently die on a device (a mid-navigation
 * dispatch, a rebuilt window.webview with empty callbacks) — the evaluate
 * channel (Storage tab already uses it) is independent, so DOM commands
 * mirror themselves through it instead of failing the tab.
 * @type {Record<string, (payload: Record<string, any>) => string>}
 */
const EVAL_COMMANDS = {
	getTree: (payload) => `(function(){
var PATH=${JSON.stringify(String(payload.path ?? ""))};
function nodeAt(p){var n=document;var parts=String(p||"").split(".").filter(function(x){return x!==""});for(var i=0;i<parts.length;i++){n=n.children[Number(parts[i])];if(!n)return null;}return n;}
function attrsOf(n){var a={};if(n.attributes){for(var i=0;i<n.attributes.length;i++){var at=n.attributes[i];a[at.name]=at.value;}}return a;}
function pathOf(node){if(!node||node===document)return "";if(node===document.documentElement)return "0";var parts=[];var cur=node;while(cur&&cur!==document){var parent=cur.parentElement||cur.parentNode;if(!parent)return null;var idx=Array.prototype.indexOf.call(parent.children,cur);if(idx<0)return null;parts.unshift(String(idx));cur=parent===document.documentElement?document:parent;}parts.unshift("0");return parts.join(".");}
function describe(node){if(!node)return null;if(node.nodeType===9)node=node.documentElement||node;var tag=node.nodeType===3?"#text":node.tagName?node.tagName.toLowerCase():String(node.nodeName||"");var text=node.nodeType===3?String(node.textContent||"").trim().slice(0,120):"";var classes=node.classList&&node.classList.length?Array.prototype.join.call(node.classList," "):"";return{path:pathOf(node),tag:tag,id:node.id||"",classes:classes,childCount:node.children?node.children.length:0,text:text,attrs:attrsOf(node)};}
var node=nodeAt(PATH);if(!node)return JSON.stringify({self:null,children:[],total:0});
var children=[];var total=node.children?node.children.length:0;
for(var i=0;i<total&&children.length<60;i++){var d=describe(node.children[i]);if(d)children.push(d);}
return JSON.stringify({self:describe(node),children:children,total:total});})()`,
	inspect: (payload) => `(function(){
var PATH=${JSON.stringify(String(payload.path ?? ""))};
function nodeAt(p){var n=document;var parts=String(p||"").split(".").filter(function(x){return x!==""});for(var i=0;i<parts.length;i++){n=n.children[Number(parts[i])];if(!n)return null;}return n;}
function asElement(n){if(!n)return null;if(n.nodeType===9)return n.documentElement||n.body||null;if(n.nodeType===3||n.nodeType===8)return n.parentElement||null;return n.nodeType===1?n:null;}
function attrsOf(n){var a={};if(n.attributes){for(var i=0;i<n.attributes.length;i++){var at=n.attributes[i];a[at.name]=at.value;}}return a;}
function pathOf(node){if(!node||node===document)return "";if(node===document.documentElement)return "0";var parts=[];var cur=node;while(cur&&cur!==document){var parent=cur.parentElement||cur.parentNode;if(!parent)return null;var idx=Array.prototype.indexOf.call(parent.children,cur);if(idx<0)return null;parts.unshift(String(idx));cur=parent===document.documentElement?document:parent;}parts.unshift("0");return parts.join(".");}
function describe(node){if(!node)return null;if(node.nodeType===9)node=node.documentElement||node;var tag=node.nodeType===3?"#text":node.tagName?node.tagName.toLowerCase():String(node.nodeName||"");var text=node.nodeType===3?String(node.textContent||"").trim().slice(0,120):"";var classes=node.classList&&node.classList.length?Array.prototype.join.call(node.classList," "):"";return{path:pathOf(node),tag:tag,id:node.id||"",classes:classes,childCount:node.children?node.children.length:0,text:text,attrs:attrsOf(node)};}
var el=asElement(nodeAt(PATH));if(!el)return JSON.stringify(null);
var box=el.getBoundingClientRect();var styles={};
try{var cs=getComputedStyle(el);["display","position","width","height","margin","padding","color","background-color","font-size","font-family","font-weight","line-height","border","border-radius","z-index","opacity","overflow","flex-direction","justify-content","align-items","text-align","box-shadow","transform","visibility"].forEach(function(pr){styles[pr]=cs.getPropertyValue(pr);});}catch(e){}
var html="";try{html=el.outerHTML||String(el.nodeValue||"");}catch(e){}
return JSON.stringify({self:describe(el),html:String(html).slice(0,${OUTER_HTML_LIMIT}),htmlTruncated:html.length>${OUTER_HTML_LIMIT},box:{x:Math.round(box.x),y:Math.round(box.y),w:Math.round(box.width),h:Math.round(box.height)},styles:styles});})()`,
	searchDom: (payload) => `(function(){
var SEL=${JSON.stringify(String(payload.selector ?? ""))};
function attrsOf(n){var a={};if(n.attributes){for(var i=0;i<n.attributes.length;i++){var at=n.attributes[i];a[at.name]=at.value;}}return a;}
function pathOf(node){if(!node||node===document)return "";if(node===document.documentElement)return "0";var parts=[];var cur=node;while(cur&&cur!==document){var parent=cur.parentElement||cur.parentNode;if(!parent)return null;var idx=Array.prototype.indexOf.call(parent.children,cur);if(idx<0)return null;parts.unshift(String(idx));cur=parent===document.documentElement?document:parent;}parts.unshift("0");return parts.join(".");}
function describe(node){if(!node)return null;if(node.nodeType===9)node=node.documentElement||node;var tag=node.nodeType===3?"#text":node.tagName?node.tagName.toLowerCase():String(node.nodeName||"");var text=node.nodeType===3?String(node.textContent||"").trim().slice(0,120):"";var classes=node.classList&&node.classList.length?Array.prototype.join.call(node.classList," "):"";return{path:pathOf(node),tag:tag,id:node.id||"",classes:classes,childCount:node.children?node.children.length:0,text:text,attrs:attrsOf(node)};}
var nodes=[];try{nodes=Array.prototype.slice.call(document.querySelectorAll(SEL));}catch(e){}
var matches=[];for(var i=0;i<nodes.length&&matches.length<100;i++){var d=describe(nodes[i]);if(d)matches.push(d);}
return JSON.stringify({matches:matches,total:nodes.length});})()`,
	searchText: (payload) => `(function(){
var NEEDLE=${JSON.stringify(String(payload.text ?? "").toLowerCase())};
function attrsOf(n){var a={};if(n.attributes){for(var i=0;i<n.attributes.length;i++){var at=n.attributes[i];a[at.name]=at.value;}}return a;}
function pathOf(node){if(!node||node===document)return "";if(node===document.documentElement)return "0";var parts=[];var cur=node;while(cur&&cur!==document){var parent=cur.parentElement||cur.parentNode;if(!parent)return null;var idx=Array.prototype.indexOf.call(parent.children,cur);if(idx<0)return null;parts.unshift(String(idx));cur=parent===document.documentElement?document:parent;}parts.unshift("0");return parts.join(".");}
function describe(node){if(!node)return null;if(node.nodeType===9)node=node.documentElement||node;var tag=node.nodeType===3?"#text":node.tagName?node.tagName.toLowerCase():String(node.nodeName||"");var text=node.nodeType===3?String(node.textContent||"").trim().slice(0,120):"";var classes=node.classList&&node.classList.length?Array.prototype.join.call(node.classList," "):"";return{path:pathOf(node),tag:tag,id:node.id||"",classes:classes,childCount:node.children?node.children.length:0,text:text,attrs:attrsOf(node)};}
var matches=[];var seen={};var rootEl=document.body||document.documentElement;
try{var walker=document.createTreeWalker(rootEl,NodeFilter.SHOW_TEXT,null,false);
while(walker.nextNode()&&matches.length<100){var value=walker.currentNode.nodeValue||"";
if(value.toLowerCase().indexOf(NEEDLE)<0)continue;var hit=walker.currentNode.parentElement;if(!hit)continue;
var info=describe(hit);if(info&&!seen[info.path]){seen[info.path]=1;matches.push(info);}}}catch(e){}
return JSON.stringify({matches:matches});})()`,
};

/**
 * Runs an inspector command through the evaluate channel (fallback twin).
 * @param {string} cmd
 * @param {Record<string, any>} payload
 * @returns {Promise<any>}
 */
async function commandViaEval(cmd, payload) {
	const build = EVAL_COMMANDS[cmd];
	if (!build)
		throw new Error(`Inspector command not available via evaluate: ${cmd}`);
	const result = await evaluateInPage(build(payload));
	if (!result || !result.ok) {
		throw new Error((result && result.error) || "Inspector eval failed");
	}
	try {
		return JSON.parse(result.value);
	} catch {
		return result.value;
	}
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
