// Vendor JS bundle — Bootstrap + SweetAlert2 + Huebee + JSURL + FilePond + Tagify + Tom Select
export { Collapse, Dropdown, Modal, Offcanvas, Tab, Toast, Tooltip } from 'bootstrap';
export { default as Huebee } from 'huebee';
import * as JSURL from 'jsurl2';
export { JSURL };
import * as FilePond from 'filepond';
export { FilePond };
import Tagify from '@yaireo/tagify';
export { Tagify };
import TomSelect from 'tom-select';
export { TomSelect };
import Swal from 'sweetalert2';
export { Swal };

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

// Make SweetAlert2 + JSURL + FilePond + Tagify + Tom Select + marked + Bootstrap Modal/Dropdown available globally for non-module scripts
import { Modal as BsModal, Dropdown as BsDropdown } from 'bootstrap';
window.Swal = Swal;
window.JSURL = JSURL;
window.FilePond = FilePond;
window.Tagify = Tagify;
window.TomSelect = TomSelect;
window.marked = marked;
window.BsModal = BsModal;
window.BsDropdown = BsDropdown;
