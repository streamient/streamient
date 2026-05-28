import iframeResize from '@iframe-resizer/parent';

const emailIframeResizeOptions = {
	license: 'GPLv3',
	log: false,
	checkOrigin: false,
	inPageLinks: true,
	waitForLoad: true,
	warningTimeout: 0,
};

window.kkIframeResize = function kkIframeResize(iframe) {
	if (!(iframe instanceof HTMLIFrameElement)) return null;
	if (iframe.iframeResizer || iframe.iFrameResizer) return iframe.iframeResizer || iframe.iFrameResizer;

	iframeResize(emailIframeResizeOptions, iframe);
	return iframe.iframeResizer || iframe.iFrameResizer || null;
};

window.kkIframeResizeRaw = iframeResize;
