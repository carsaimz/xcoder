/* XCoder SEO audit overlay — injected into the previewed page by the native
 * preview screen (menu › "SEO"). Self-contained, idempotent, zero
 * dependencies: computes a detailed, scored report (Meta, Conteúdo,
 * Social, Técnico, Performance) like a mini-Lighthouse and renders it as
 * an in-page panel in the app's VS Code dark palette. Nothing leaves the
 * page — the report is only displayed and copyable. */
(function () {
  "use strict";
  if (!document.documentElement) return;

  var OLD = document.getElementById("xc-seo-root");
  if (OLD) OLD.remove();

  // ------------------------------------------------------------- helpers
  var CSS = [
    "#xc-seo-root{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:flex-end;justify-content:center;pointer-events:none;font:13px/1.5 -apple-system,'Segoe UI',Roboto,sans-serif}",
    "#xc-seo-root *{box-sizing:border-box}",
    ".xc-seo-panel{pointer-events:auto;width:min(100vw,760px);max-height:100vh;max-height:100dvh;display:flex;flex-direction:column;background:#1e1e1e;color:#cccccc;border-top:1px solid #333;box-shadow:0 -8px 40px rgba(0,0,0,.55);border-radius:10px 10px 0 0;overflow:hidden}",
    "@media(min-width:760px){.xc-seo-panel{height:92%;border:1px solid #333;border-radius:10px;margin-bottom:1.5vh}}",
    ".xc-seo-head{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#252526;border-bottom:1px solid #333;flex-shrink:0}",
    ".xc-seo-title{font-weight:700;font-size:13px;letter-spacing:.4px;color:#e7e7e7;text-transform:uppercase}",
    ".xc-seo-score{display:flex;align-items:center;gap:8px;margin-left:auto}",
    ".xc-seo-total{font-size:20px;font-weight:800}",
    ".xc-seo-total.good{color:#89d185}.xc-seo-total.mid{color:#cca700}.xc-seo-total.bad{color:#f14c4c}",
    ".xc-seo-btn{background:#333;border:1px solid #444;color:#ccc;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}",
    ".xc-seo-btn:active{background:#3c3c3c}",
    ".xc-seo-close{background:transparent;border:none;color:#999;font-size:22px;line-height:1;padding:2px 8px;cursor:pointer}",
    ".xc-seo-body{overflow-y:auto;padding:12px 14px 20px;-webkit-overflow-scrolling:touch}",
    ".xc-seo-cat{border:1px solid #2c2c2c;border-radius:8px;margin-bottom:10px;background:#212121;overflow:hidden}",
    ".xc-seo-cat-head{display:flex;align-items:center;gap:10px;padding:9px 12px;background:#252526;cursor:pointer}",
    ".xc-seo-cat-name{font-weight:700;font-size:12.5px;text-transform:uppercase;letter-spacing:.6px}",
    ".xc-seo-cat-score{margin-left:auto;font-weight:800;font-size:14px}",
    ".xc-seo-cat-score.good{color:#89d185}.xc-seo-cat-score.mid{color:#cca700}.xc-seo-cat-score.bad{color:#f14c4c}",
    ".xc-seo-check{display:flex;gap:9px;padding:8px 12px;border-top:1px solid #2a2a2a;flex-direction:column}",
    ".xc-seo-check-row{display:flex;gap:9px;align-items:flex-start}",
    ".xc-seo-mark{flex-shrink:0;font-weight:800;width:16px;text-align:center}",
    ".xc-seo-mark.pass{color:#89d185}.xc-seo-mark.warn{color:#cca700}.xc-seo-mark.fail{color:#f14c4c}",
    ".xc-seo-check-title{font-weight:600;color:#e0e0e0}",
    ".xc-seo-check-detail{font-size:12px;color:#a0a0a0;word-break:break-word}",
    ".xc-seo-tip{font-size:11.5px;color:#7c7cb5}",
    ".xc-seo-foot{padding:8px 14px 12px;font-size:11px;color:#777;text-align:center}",
  ].join("\n");

  /** @param {string} s */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  /** @param {number} score */
  function grade(score) {
    return score >= 90 ? "good" : score >= 50 ? "mid" : "bad";
  }
  function $(html) {
    var el = document.createElement("div");
    el.innerHTML = html.trim();
    return el.firstChild;
  }

  // ------------------------------------------------------------- audit
  function collect() {
    var doc = document;
    var meta = function (sel) {
      var el = doc.querySelector(sel);
      return el ? (el.getAttribute("content") || "").trim() : "";
    };
    var title = (doc.querySelector("title") || {}).textContent || "";
    var description = meta('meta[name="description" i], meta[name="description"]');
    var robots = meta('meta[name="robots" i]');
    var viewport = meta('meta[name="viewport" i]');
    var canonicalEl = doc.querySelector('link[rel="canonical" i]');
    var lang = (doc.documentElement.getAttribute("lang") || "").trim();
    var charset =
      !!doc.querySelector("meta[charset]") ||
      /charset=/i.test(
        (doc.querySelector('meta[http-equiv="Content-Type" i]') || {}).content ||
          "",
      );
    var headings = [].slice.call(doc.querySelectorAll("h1,h2,h3,h4,h5,h6"));
    var h1s = headings.filter(function (h) {
      return h.tagName === "H1";
    });
    var words = (doc.body ? doc.body.innerText || doc.body.textContent : "").trim();
    var wordCount = words ? words.split(/\s+/).length : 0;
    var images = [].slice.call(doc.images || doc.querySelectorAll("img"));
    var noAlt = images.filter(function (img) {
      return !(img.getAttribute("alt") || "").trim();
    });
    var altRatio = images.length
      ? Math.round(((images.length - noAlt.length) / images.length) * 100)
      : 100;
    var links = [].slice.call(doc.querySelectorAll("a[href]"));
    var emptyAnchors = links.filter(function (a) {
      var href = a.getAttribute("href") || "";
      return href === "#" || href === "";
    });
    var og = {
      "og:title": meta('meta[property="og:title" i]'),
      "og:description": meta('meta[property="og:description" i]'),
      "og:image": meta('meta[property="og:image" i]'),
      "og:url": meta('meta[property="og:url" i]'),
    };
    var twitter = {
      "twitter:card": meta('meta[name="twitter:card" i]'),
      "twitter:title": meta('meta[name="twitter:title" i]'),
    };
    var jsonld = [].slice.call(
      doc.querySelectorAll('script[type="application/ld+json"]'),
    ).length;
    var favicon = !!doc.querySelector(
      'link[rel*="icon" i], link[rel="shortcut icon" i]',
    );
    var https = location.protocol === "https:";
    var html = doc.documentElement.outerHTML || "";
    var htmlKb = Math.round((html.length / 1024) * 10) / 10;
    var domNodes = doc.querySelectorAll("*").length;
    var headScripts = [].slice.call(doc.querySelectorAll("head script[src]"));
    var blocking = headScripts.filter(function (s) {
      return !s.defer && !s.async;
    }).length;
    var nav = null;
    try {
      nav = performance.getEntriesByType("navigation")[0] || null;
    } catch (e) {}
    var resources = [];
    try {
      resources = performance.getEntriesByType("resource") || [];
    } catch (e) {}
    var transfer = 0;
    for (var i = 0; i < resources.length; i++) {
      transfer +=
        resources[i].transferSize || resources[i].encodedBodySize || 0;
    }
    return {
      url: location.href,
      title: title,
      description: description,
      robots: robots,
      viewport: viewport,
      canonical: canonicalEl ? canonicalEl.href : "",
      lang: lang,
      charset: charset,
      headings: headings,
      h1Count: h1s.length,
      wordCount: wordCount,
      images: images.length,
      noAlt: noAlt,
      altRatio: altRatio,
      links: links.length,
      emptyAnchors: emptyAnchors.length,
      og: og,
      twitter: twitter,
      jsonld: jsonld,
      favicon: favicon,
      https: https,
      htmlKb: htmlKb,
      domNodes: domNodes,
      blocking: blocking,
      ttfb: nav ? Math.round(nav.responseStart) : null,
      domReady: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      load: nav ? Math.round(nav.loadEventEnd || nav.domComplete) : null,
      resources: resources.length,
      transferKb: Math.round(transfer / 1024),
    };
  }

  function buildChecks(d) {
    /** @type {Array<{cat:string,name:string,checks:Array}>} */
    var cats = [
      { id: "meta", name: "Meta & tags", weight: 25, checks: [] },
      { id: "content", name: "Conteúdo", weight: 20, checks: [] },
      { id: "social", name: "Social & partilha", weight: 15, checks: [] },
      { id: "tech", name: "Técnico", weight: 25, checks: [] },
      { id: "perf", name: "Performance", weight: 15, checks: [] },
    ];
    var byId = {};
    cats.forEach(function (c) {
      byId[c.id] = c.checks;
    });

    function add(cat, status, title, detail, tip) {
      byId[cat].push({ status: status, title: title, detail: detail, tip: tip });
    }

    // ---- Meta & tags
    var tl = d.title.trim().length;
    add(
      "meta",
      !tl ? "fail" : tl >= 15 && tl <= 60 ? "pass" : tl >= 5 && tl <= 70 ? "warn" : "fail",
      "Título da página",
      tl ? '"' + d.title.trim().slice(0, 120) + '" (' + tl + " caracteres)" : "Sem <title>.",
      !tl ? "Adicione um <title> único e descritivo." : "Ideal entre 15 e 60 caracteres.",
    );
    var dl = d.description.length;
    add(
      "meta",
      !dl ? "fail" : dl >= 50 && dl <= 160 ? "pass" : dl >= 20 && dl <= 320 ? "warn" : "warn",
      "Meta description",
      dl ? dl + " caracteres" : 'Sem <meta name="description">.',
      !dl ? "Adicione uma descrição de 50–160 caracteres." : "Ideal entre 50 e 160 caracteres.",
    );
    add(
      "meta",
      d.canonical ? "pass" : "warn",
      "URL canónico",
      d.canonical ? esc(d.canonical) : "Sem <link rel=\"canonical\">.",
      d.canonical ? "" : "Ajuda a evitar conteúdo duplicado (importante com parâmetros de URL).",
    );
    var noindex = /noindex/i.test(d.robots);
    var nofollow = /nofollow/i.test(d.robots);
    add(
      "meta",
      noindex || nofollow ? "fail" : "pass",
      "Meta robots",
      d.robots ? d.robots : 'Sem meta robots (indexado por defeito).',
      noindex || nofollow ? "noindex/nofollow impede indexação — remova se a página deve aparecer no Google." : "",
    );
    add(
      "meta",
      d.lang ? "pass" : "warn",
      "Idioma (lang)",
      d.lang ? 'lang="' + esc(d.lang) + '"' : "<html> sem atributo lang.",
      d.lang ? "" : "Ex.: <html lang=\"pt-BR\"> — usado por motores de busca e leitores de ecrã.",
    );
    add(
      "meta",
      d.charset ? "pass" : "warn",
      "Charset declarado",
      d.charset ? "UTF-8 declarado" : 'Sem <meta charset>.',
      d.charset ? "" : 'Adicione <meta charset="utf-8"> no <head>.',
    );

    // ---- Conteúdo
    add(
      "content",
      d.h1Count === 1 ? "pass" : d.h1Count === 0 ? "fail" : "warn",
      "Estrutura de títulos (h1)",
      d.h1Count + " <h1>, " + d.headings.length + " títulos no total (h1–h6).",
      d.h1Count === 0 ? "Toda página precisa de um <h1>." : d.h1Count > 1 ? "Use apenas um <h1> por página." : "",
    );
    var h2 = d.headings.filter(function (h) { return h.tagName === "H2"; }).length;
    add(
      "content",
      h2 ? "pass" : "warn",
      "Subtítulos (h2/h3)",
      h2 + " <h2> e " + (d.headings.length - d.h1Count - h2) + " outros subtítulos.",
      h2 ? "" : "Subtítulos organizam o conteúdo e ajudam o Google a entender a página.",
    );
    add(
      "content",
      d.wordCount >= 300 ? "pass" : d.wordCount >= 100 ? "warn" : "fail",
      "Volume de texto",
      d.wordCount + " palavras visíveis.",
      d.wordCount < 300 ? "Conteúdo com 300+ palavras costuma posicionar melhor." : "",
    );
    var listNoAlt = d.noAlt
      .slice(0, 10)
      .map(function (img) {
        return (img.currentSrc || img.src || "(sem src)").split("/").pop().slice(0, 60);
      })
      .join(", ");
    add(
      "content",
      d.images === 0 ? "pass" : d.altRatio >= 95 ? "pass" : d.altRatio >= 60 ? "warn" : "fail",
      "Imagens com alt",
      d.images === 0
        ? "A página não usa <img>."
        : d.altRatio + "% com alt (" + d.noAlt.length + " de " + d.images.length + " sem alt).",
      d.noAlt.length ? "Sem alt: " + esc(listNoAlt) : "",
    );
    add(
      "content",
      d.emptyAnchors === 0 ? "pass" : d.emptyAnchors <= 3 ? "warn" : "fail",
      "Ligações com destino",
      d.links + " ligações, " + d.emptyAnchors + ' com href="#" ou vazio.',
      d.emptyAnchors ? 'Ligações vazias ("#") não são rastreáveis.' : "",
    );

    // ---- Social
    var missingOg = Object.keys(d.og).filter(function (k) { return !d.og[k]; });
    var ogScore = missingOg.length === 0 ? "pass" : missingOg.length <= 2 ? "warn" : "fail";
    add(
      "social",
      ogScore,
      "Open Graph",
      missingOg.length
        ? "Faltam: " + missingOg.join(", ")
        : "og:title, og:description, og:image e og:url completos.",
      missingOg.length ? "Definem o cartão de partilha em WhatsApp/Facebook." : "",
    );
    add(
      "social",
      d.twitter["twitter:card"] ? "pass" : "warn",
      "Twitter Card",
      d.twitter["twitter:card"] ? "twitter:card=" + esc(d.twitter["twitter:card"]) : 'Sem <meta name="twitter:card">.',
      d.twitter["twitter:card"] ? "" : 'Adicione <meta name="twitter:card" content="summary_large_image">.',
    );

    // ---- Técnico
    add(
      "tech",
      d.https ? "pass" : "fail",
      "HTTPS",
      d.https ? "Página servida em HTTPS." : "Página em HTTP inseguro.",
      d.https ? "" : "HTTPS é factor de posicionamento e obrigatório para várias APIs.",
    );
    add(
      "tech",
      d.viewport ? "pass" : "fail",
      "Viewport móvel",
      d.viewport ? esc(d.viewport.slice(0, 80)) : 'Sem <meta name="viewport">.',
      d.viewport ? "" : 'Sem viewport o site não se adapta ao telemóvel (penalização mobile).',
    );
    add(
      "tech",
      d.favicon ? "pass" : "warn",
      "Favicon",
      d.favicon ? "Declarado." : 'Sem <link rel="icon">.',
      d.favicon ? "" : "Adicione um favicon — aparece nos resultados de busca.",
    );
    add(
      "tech",
      d.jsonld ? "pass" : "warn",
      "Dados estruturados (JSON-LD)",
      d.jsonld + " bloco(s) ld+json.",
      d.jsonld ? "" : "Schema.org (Article, Product, Organization…) enriquece o resultado na busca.",
    );
    add(
      "tech",
      d.htmlKb <= 100 ? "pass" : d.htmlKb <= 500 ? "warn" : "fail",
      "Tamanho do HTML",
      d.htmlKb + " KB, " + d.domNodes + " elementos no DOM.",
      d.htmlKb > 100 ? "HTML pesado/gerado por JavaScript dificulta a indexação." : "",
    );
    add(
      "tech",
      d.blocking === 0 ? "pass" : d.blocking <= 2 ? "warn" : "fail",
      "Scripts bloqueantes no <head>",
      d.blocking + " script(s) sem defer/async no head.",
      d.blocking ? "Use defer/async para não bloquear a renderização." : "",
    );

    // ---- Performance
    if (d.ttfb != null) {
      add(
        "perf",
        d.ttfb <= 800 ? "pass" : d.ttfb <= 2500 ? "warn" : "fail",
        "Tempo até o primeiro byte (TTFB)",
        d.ttfb + " ms.",
        d.ttfb > 800 ? "Resposta lenta do servidor atrasa tudo." : "",
      );
      add(
        "perf",
        d.load != null && d.load <= 3000 ? "pass" : d.load != null && d.load <= 6000 ? "warn" : "fail",
        "Tempo de carregamento",
        d.load != null ? "evento load em " + d.load + " ms" + (d.domReady != null ? " · DOM pronto em " + d.domReady + " ms" : "") : "indisponível",
        "",
      );
    } else {
      add("perf", "warn", "Tempos de navegação", "Performance API indisponível nesta página.", "");
    }
    add(
      "perf",
      d.transferKb === 0 ? "warn" : d.transferKb <= 1500 ? "pass" : d.transferKb <= 4000 ? "warn" : "fail",
      "Peso dos recursos",
      d.transferKb ? d.transferKb + " KB transferidos em " + d.resources + " pedidos." : "Tamanhos indisponíveis (recursos cross-origin).",
      d.transferKb > 1500 ? "Comprima imagens, use cache e carregue sob demanda." : "",
    );

    // score per category
    cats.forEach(function (cat) {
      if (!cat.checks.length) {
        cat.score = 100;
        return;
      }
      var sum = 0;
      cat.checks.forEach(function (c) {
        sum += c.status === "pass" ? 1 : c.status === "warn" ? 0.5 : 0;
      });
      cat.score = Math.round((sum / cat.checks.length) * 100);
    });
    var total = 0;
    cats.forEach(function (cat) {
      total += cat.score * cat.weight;
    });
    d.overall = Math.round(total / 100);
    return cats;
  }

  function textReport(d, cats) {
    var lines = [];
    lines.push("AUDITORIA SEO — " + d.url);
    lines.push("Pontuação geral: " + d.overall + "/100");
    lines.push("");
    cats.forEach(function (cat) {
      lines.push("== " + cat.name + " — " + cat.score + "/100 ==");
      cat.checks.forEach(function (c) {
        lines.push(
          "  [" +
            (c.status === "pass" ? "OK" : c.status === "warn" ? "ATENÇÃO" : "ERRO") +
            "] " +
            c.title +
            (c.detail ? " — " + c.detail : "") +
            (c.tip ? " | Dica: " + c.tip : ""),
        );
      });
      lines.push("");
    });
    return lines.join("\n");
  }

  // ------------------------------------------------------------- render
  function render() {
    var d = collect();
    var cats = buildChecks(d);

    var style = document.createElement("style");
    style.id = "xc-seo-style";
    style.textContent = CSS;

    var root = document.createElement("div");
    root.id = "xc-seo-root";

    var checksHtml = "";
    cats.forEach(function (cat) {
      checksHtml +=
        '<section class="xc-seo-cat">' +
        '<div class="xc-seo-cat-head" data-collapse="1">' +
        '<span class="xc-seo-cat-name">' + esc(cat.name) + "</span>" +
        '<span class="xc-seo-cat-score ' + grade(cat.score) + '">' + cat.score + "</span>" +
        "</div>";
      cat.checks.forEach(function (c) {
        var mark = c.status === "pass" ? "✓" : c.status === "warn" ? "!" : "✕";
        checksHtml +=
          '<div class="xc-seo-check">' +
          '<div class="xc-seo-check-row"><span class="xc-seo-mark ' + c.status + '">' + mark + "</span>" +
          '<span class="xc-seo-check-title">' + esc(c.title) + "</span></div>" +
          (c.detail ? '<div class="xc-seo-check-detail">' + c.detail + "</div>" : "") +
          (c.tip ? '<div class="xc-seo-tip">💡 ' + esc(c.tip) + "</div>" : "") +
          "</div>";
      });
      checksHtml += "</section>";
    });

    root.innerHTML =
      '<div class="xc-seo-panel">' +
      '<div class="xc-seo-head">' +
      '<span class="xc-seo-title">Auditoria SEO</span>' +
      '<span class="xc-seo-score"><span class="xc-seo-total ' + grade(d.overall) + '">' + d.overall + "</span><span style=\"color:#777\">/100</span></span>" +
      '<button type="button" class="xc-seo-btn" data-act="copy">Copiar</button>' +
      '<button type="button" class="xc-seo-btn" data-act="refresh">Atualizar</button>' +
      '<button type="button" class="xc-seo-close" data-act="close" aria-label="Fechar">✕</button>' +
      "</div>" +
      '<div class="xc-seo-body">' + checksHtml +
      '<div class="xc-seo-foot">' + esc(d.url) + "</div>" +
      "</div></div>";

    document.documentElement.appendChild(style);
    document.documentElement.appendChild(root);

    function close() {
      root.remove();
      style.remove();
    }
    function copyReport() {
      var report = textReport(d, cats);
      var done = function () {
        var b = root.querySelector('[data-act="copy"]');
        if (b) b.textContent = "Copiado ✓";
        setTimeout(function () {
          var b2 = root.querySelector('[data-act="copy"]');
          if (b2) b2.textContent = "Copiar";
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(report).then(done, function () { fallback(); });
      } else {
        fallback();
      }
      function fallback() {
        var ta = document.createElement("textarea");
        ta.value = report;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); done(); } catch (e) {}
        ta.remove();
      }
    }

    root.addEventListener("click", function (e) {
      var act = e.target.closest && e.target.closest("[data-act]");
      if (act) {
        var a = act.getAttribute("data-act");
        if (a === "close") close();
        else if (a === "copy") copyReport();
        else if (a === "refresh") {
          close();
          window.setTimeout(run, 60);
        }
        return;
      }
      var head = e.target.closest && e.target.closest("[data-collapse]");
      if (head) {
        var kids = head.parentElement.children;
        for (var i = 1; i < kids.length; i++) {
          kids[i].style.display = kids[i].style.display === "none" ? "" : "none";
        }
      }
    });

    // pop-out on top: swipe/touch outside is captured by the panel itself
    root.style.pointerEvents = "none";
    root.querySelector(".xc-seo-panel").style.pointerEvents = "auto";
  }

  function run() {
    render();
  }

  window.__xcoderSeoAudit = run;
  run();
})();
