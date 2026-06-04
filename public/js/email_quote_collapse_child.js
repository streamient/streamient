(() => {
  // src/email_quote_collapse_child.js
  (function() {
    var QUOTE_SELECTOR = "blockquote,.gmail_quote,.yahoo_quoted";
    var COLLAPSE_CLASS = "kk-email-quote-collapse";
    var TOGGLE_CLASS = "kk-email-quote-toggle";
    var QUOTE_HEADER_RE = /^(on\s.+wrote:|from:\s.+|sent:\s.+|to:\s.+|subject:\s.+|-----original message-----)$/i;
    function normalizedText(value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    }
    function isWhitespaceNode(node) {
      return node?.nodeType === Node.TEXT_NODE && !normalizedText(node.textContent);
    }
    function isIgnorableSibling(node) {
      return isWhitespaceNode(node) || node instanceof HTMLElement && node.tagName === "BR";
    }
    function previousMeaningfulSibling(node) {
      var sibling = node?.previousSibling || null;
      while (sibling && isIgnorableSibling(sibling)) {
        sibling = sibling.previousSibling;
      }
      return sibling;
    }
    function isReplyHeader(element) {
      if (!(element instanceof HTMLElement)) return false;
      if (element.classList.contains("moz-cite-prefix")) return true;
      var text = normalizedText(element.textContent);
      if (!text || text.length > 260) return false;
      return QUOTE_HEADER_RE.test(text);
    }
    function hasCollapsedAncestor(element) {
      return Boolean(element.closest("." + COLLAPSE_CLASS));
    }
    function hasQuoteAncestor(element) {
      var parent = element.parentElement;
      return Boolean(parent?.closest(QUOTE_SELECTOR));
    }
    function nodesBetween(startNode, endNode) {
      var nodes = [];
      var node = startNode;
      var limit = 0;
      while (node && limit < 20) {
        var next = node.nextSibling;
        nodes.push(node);
        if (node === endNode) break;
        node = next;
        limit++;
      }
      return nodes[nodes.length - 1] === endNode ? nodes : [endNode];
    }
    function nodesForQuote(quote) {
      var previous = previousMeaningfulSibling(quote);
      if (isReplyHeader(previous)) {
        return nodesBetween(previous, quote);
      }
      return [quote];
    }
    function requestResize() {
      try {
        window.parentIFrame?.size?.();
      } catch {
      }
      try {
        window.dispatchEvent(new Event("resize"));
      } catch {
      }
    }
    function setExpanded(button, collapse, expanded) {
      collapse.hidden = !expanded;
      button.setAttribute("aria-expanded", expanded ? "true" : "false");
      button.setAttribute("aria-label", expanded ? "Hide quoted text" : "Show quoted text");
      button.title = expanded ? "Hide quoted text" : "Show quoted text";
      requestResize();
    }
    function collapseQuote(quote) {
      if (!(quote instanceof HTMLElement)) return;
      if (hasCollapsedAncestor(quote) || hasQuoteAncestor(quote)) return;
      var parent = quote.parentNode;
      if (!parent) return;
      var nodes = nodesForQuote(quote).filter(Boolean);
      var firstNode = nodes[0];
      if (!firstNode?.parentNode) return;
      var button = document.createElement("button");
      button.type = "button";
      button.className = TOGGLE_CLASS;
      button.textContent = "...";
      var collapse = document.createElement("div");
      collapse.className = COLLAPSE_CLASS;
      collapse.hidden = true;
      firstNode.parentNode.insertBefore(button, firstNode);
      firstNode.parentNode.insertBefore(collapse, firstNode);
      nodes.forEach(function(node) {
        collapse.appendChild(node);
      });
      button.addEventListener("click", function() {
        setExpanded(button, collapse, collapse.hidden);
      });
      setExpanded(button, collapse, false);
    }
    function collapseQuotes() {
      Array.from(document.querySelectorAll(QUOTE_SELECTOR)).forEach(collapseQuote);
      requestResize();
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", collapseQuotes, { once: true });
    } else {
      collapseQuotes();
    }
    window.addEventListener("load", collapseQuotes, { once: true });
  })();
})();
