// Vendor JS bundle — Bootstrap + SweetAlert2 + Huebee + JSURL + FilePond
export { Collapse, Dropdown, Modal, Offcanvas, Tab, Toast, Tooltip } from 'bootstrap';
export { default as Huebee } from 'huebee';
import * as JSURL from 'jsurl2';
export { JSURL };
import * as FilePond from 'filepond';
export { FilePond };
import Swal from 'sweetalert2';
export { Swal };
import { openobserveRum } from '@openobserve/browser-rum';
import { openobserveLogs } from '@openobserve/browser-logs';
export { openobserveRum, openobserveLogs };

// Marked (markdown parser)
import { marked } from 'marked';
export { marked };

const alertIcons = {
	success: 'checkCircle',
	error: 'cancel',
	warning: 'warning',
	info: 'info',
	question: 'question',
};

const alertGlyphs = {
	checkCircle: 'check_circle',
	cancel: 'cancel',
	warning: 'warning',
	info: 'info',
	question: 'help',
};

const decorateSwalOptions = (options) => {
	if (!options || typeof options !== 'object') return options;
	if (!options.icon || !alertIcons[options.icon] || options.iconHtml) return options;
	const glyph = alertGlyphs[alertIcons[options.icon]];
	return {
		...options,
		iconHtml: `<span class="kk-icon material-symbols-outlined" aria-hidden="true">${glyph}</span>`,
		customClass: {
			...options.customClass,
			icon: ['swal2-kk-icon', options.customClass?.icon].filter(Boolean).join(' '),
		},
	};
};

const originalSwalFire = Swal.fire.bind(Swal);
Swal.fire = (...args) => {
	if (args.length === 1 && typeof args[0] === 'object') {
		return originalSwalFire(decorateSwalOptions(args[0]));
	}
	if (args.length >= 3 && typeof args[2] === 'string') {
		return originalSwalFire(decorateSwalOptions({
			title: args[0],
			html: args[1],
			icon: args[2],
		}));
	}
	return originalSwalFire(...args);
};

// Make SweetAlert2 + JSURL + FilePond + marked + Bootstrap Modal available globally for non-module scripts
import { Modal as BsModal } from 'bootstrap';
window.Swal = Swal;
window.JSURL = JSURL;
window.FilePond = FilePond;
window.marked = marked;
window.BsModal = BsModal;
window.openobserveRum = openobserveRum;
window.openobserveLogs = openobserveLogs;
