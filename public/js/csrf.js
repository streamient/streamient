(function () {
	const token = document.querySelector('meta[name="csrf-token"]')?.content;
	if (!token) return;
	const nativeFetch = window.fetch;
	window.fetch = function (input, init) {
		const request = input instanceof Request ? input : null;
		const url = new URL(request ? request.url : input, window.location.href);
		const method = String(init?.method || request?.method || 'GET').toUpperCase();
		if (url.origin !== window.location.origin || ['GET', 'HEAD', 'OPTIONS'].includes(method)) return nativeFetch.call(this, input, init);
		const headers = new Headers(init?.headers || request?.headers);
		headers.set('X-CSRF-Token', token);
		return nativeFetch.call(this, input, { ...init, headers });
	};
})();
