(function () {
	function escapeHtml(value) {
		var div = document.createElement('div');
		div.textContent = String(value || '');
		return div.innerHTML;
	}

	function staticScriptUrl(fileName) {
		var staticBase = window.__static_base || '/static';
		return window.location.origin + staticBase + '/js/' + fileName;
	}

	function defaultTheme() {
		var dt = document.documentElement?.getAttribute?.('data-theme');
		if (dt === 'dark') return 'dark';
		if (dt === 'light') return 'original';
		if (document.body?.classList.contains('kk-template1')) return 'dark';
		return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'original';
	}

	function normalizeTheme(theme) {
		return theme === 'dark' ? 'dark' : 'original';
	}

	function baseCss(theme) {
		if (theme !== 'dark') {
			return [
				'html,body{margin:0;padding:0;background:#fff;color:#212529;font-family:Arial,sans-serif;font-size:14px;line-height:1.45;}',
				'body{padding:16px;overflow-wrap:anywhere;}',
				'img{max-width:100%;height:auto;}',
				'table{max-width:100%;}',
				'a{color:#0d6efd;}',
				'blockquote,.gmail_quote,.yahoo_quoted{border-left:4px solid #4aa3df!important;padding-left:16px!important;margin-left:0!important;background:#f8f9fa!important;color:#5f6872!important;}',
				'.kk-email-quote-toggle{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:18px;margin:10px 0 6px;padding:0 8px;border:0;border-radius:5px;background:#e9ecef;color:#495057;font:700 14px/1 Arial,sans-serif;cursor:pointer;}',
				'.kk-email-quote-toggle:hover,.kk-email-quote-toggle:focus{background:#dee2e6;outline:0;}',
				'.kk-email-quote-collapse[hidden]{display:none!important;}',
			].join('');
		}
		return [
			':root{color-scheme:dark;--kk-email-bg:#0f141b;--kk-email-surface:#1a1f25;--kk-email-surface-2:#20262d;--kk-email-text:#e8edf3;--kk-email-muted:#b7c0cc;--kk-email-border:#3a424d;--kk-email-link:#c5a7ff;}',
			'html,body{margin:0;padding:0;background:var(--kk-email-bg)!important;color:var(--kk-email-text)!important;font-family:Arial,sans-serif;font-size:14px;line-height:1.45;}',
			'body{padding:16px;overflow-wrap:anywhere;}',
			'body,div,section,article,main,p,span,font,center,li,td,th{border-color:var(--kk-email-border)!important;}',
			'table{max-width:100%;border-color:var(--kk-email-border)!important;}',
			'img,picture,svg,canvas,video{max-width:100%;height:auto;}',
			'a,a span{color:var(--kk-email-link)!important;}',
			'hr{border-color:var(--kk-email-border)!important;background:var(--kk-email-border)!important;color:var(--kk-email-border)!important;}',
			'blockquote,.gmail_quote,.yahoo_quoted{border-left:4px solid #4aa3df!important;padding-left:16px!important;margin-left:0!important;background:rgba(255,255,255,.035)!important;color:var(--kk-email-muted)!important;}',
			'.kk-email-quote-toggle{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:18px;margin:10px 0 6px;padding:0 8px;border:0;border-radius:5px;background:#343a40;color:#d3d9e2;font:700 14px/1 Arial,sans-serif;cursor:pointer;}',
			'.kk-email-quote-toggle:hover,.kk-email-quote-toggle:focus{background:#454d57;outline:0;}',
			'.kk-email-quote-collapse[hidden]{display:none!important;}',
			'[bgcolor="#ffffff"],[bgcolor="#fff"],[bgcolor="white"],[style*="background:#fff"],[style*="background: #fff"],[style*="background-color:#fff"],[style*="background-color: #fff"],[style*="background:#ffffff"],[style*="background: #ffffff"],[style*="background-color:#ffffff"],[style*="background-color: #ffffff"]{background-color:var(--kk-email-surface)!important;}',
		].join('');
	}

	function htmlWithRemoteImages(html, loadRemoteImages) {
		if (!loadRemoteImages || !html) return html || '';
		var doc = new DOMParser().parseFromString('<div id="kk-email-root">' + html + '</div>', 'text/html');
		doc.querySelectorAll('img[data-kk-remote-src]').forEach(function (img) {
			var src = img.getAttribute('data-kk-remote-src') || '';
			if (/^https?:\/\//i.test(src)) img.setAttribute('src', src);
		});
		return doc.getElementById('kk-email-root')?.innerHTML || html;
	}

	function normalizedText(value) {
		return String(value || '').replace(/\s+/g, ' ').trim();
	}

	function removeLeadingRepeatedNode(node, repeatedValues) {
		if (!node) return false;
		if (node.nodeType === Node.TEXT_NODE) {
			var text = normalizedText(node.textContent);
			if (!text) {
				node.remove();
				return true;
			}
			if (repeatedValues.includes(text)) {
				node.remove();
				return true;
			}
			return false;
		}
		if (!(node instanceof HTMLElement)) return false;
		if (['BR', 'HR'].includes(node.tagName) && !normalizedText(node.textContent)) {
			node.remove();
			return true;
		}
		var nodeText = normalizedText(node.textContent);
		if (node.children.length === 0 && repeatedValues.includes(nodeText)) {
			node.remove();
			return true;
		}
		return false;
	}

	function stripLeadingRepeatedHeader(html, options) {
		var repeatedValues = [
			options?.subject,
			options?.from,
		].map(normalizedText).filter(Boolean);
		if (!repeatedValues.length || !html) return html || '';
		var doc = new DOMParser().parseFromString('<div id="kk-email-root">' + html + '</div>', 'text/html');
		var root = doc.getElementById('kk-email-root');
		if (!root) return html;
		var removed = 0;
		while (root.firstChild && removed < 4 && removeLeadingRepeatedNode(root.firstChild, repeatedValues)) {
			removed++;
		}
		return root.innerHTML || html;
	}

	function buildSrcdoc(options) {
		var html = stripLeadingRepeatedHeader(String(options?.html || ''), options || {});
		var loadRemoteImages = Boolean(options?.loadRemoteImages);
		var theme = normalizeTheme(options?.theme || defaultTheme());
		var childScriptUrl = staticScriptUrl('iframe_resizer_child.js');
		var darkModeScriptUrl = staticScriptUrl('email_dark_mode_child.js');
		var quoteCollapseScriptUrl = staticScriptUrl('email_quote_collapse_child.js');
		var scripts = theme === 'dark'
			? '<script src="' + escapeHtml(darkModeScriptUrl) + '"></script><script src="' + escapeHtml(quoteCollapseScriptUrl) + '"></script><script async src="' + escapeHtml(childScriptUrl) + '"></script>'
			: '<script src="' + escapeHtml(quoteCollapseScriptUrl) + '"></script><script async src="' + escapeHtml(childScriptUrl) + '"></script>';
		var csp = [
			"default-src 'none'",
			'img-src data: cid:' + (loadRemoteImages ? ' http: https:' : ''),
			'script-src ' + window.location.origin,
			"style-src 'unsafe-inline'",
			'font-src data:',
			"base-uri 'none'",
			"form-action 'none'",
		].join('; ');
		return '<!doctype html><html data-kk-email-theme="' + theme + '"><head>'
			+ '<meta charset="utf-8">'
			+ '<meta http-equiv="Content-Security-Policy" content="' + escapeHtml(csp) + '">'
			+ '<base target="_blank">'
			+ '<style>' + baseCss(theme) + '</style>'
			+ '</head><body>' + html + scripts + '</body></html>';
	}

	function resizeFrame(frame) {
		try {
			var doc = frame.contentDocument;
			if (!doc?.body) return;
			var height = Math.max(220, doc.documentElement.scrollHeight, doc.body.scrollHeight);
			frame.style.height = height + 'px';
		} catch {
			frame.style.height = '420px';
		}
	}

	function initResize(frame) {
		if (!frame) return;
		frame.onload = function () {
			if (!frame.iframeResizer && !frame.iFrameResizer) resizeFrame(frame);
		};
		if (typeof window.kkIframeResize !== 'function') {
			frame.style.height = '420px';
			return;
		}
		window.kkIframeResize(frame);
	}

	window.kkEmailIframeRenderer = {
		buildSrcdoc: buildSrcdoc,
		defaultTheme: defaultTheme,
		htmlWithRemoteImages: htmlWithRemoteImages,
		initResize: initResize,
		stripLeadingRepeatedHeader: stripLeadingRepeatedHeader,
	};
})();
