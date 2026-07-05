// Vendor JS bundle — Tabler + SweetAlert2 + Huebee + JSURL + FilePond + Tagify + Tom Select
export { Collapse, Dropdown, Modal, Offcanvas, Tab, Toast, Tooltip } from '@tabler/core';
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
	checkCircle: 'circle-check',
	cancel: 'circle-x',
	warning: 'alert-triangle',
	info: 'info-circle',
	question: 'help-circle',
};

const decorateSwalOptions = (options) => {
	if (!options || typeof options !== 'object') return options;
	if (!options.icon || !alertIcons[options.icon] || options.iconHtml) return options;
	const glyph = alertGlyphs[alertIcons[options.icon]];
	return {
		...options,
		iconHtml: `<span class="st-icon ti ti-${glyph}" aria-hidden="true"></span>`,
		customClass: {
			...options.customClass,
			icon: ['swal2-st-icon', options.customClass?.icon].filter(Boolean).join(' '),
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

// Make SweetAlert2 + JSURL + FilePond + Tagify + Tom Select + marked + Tabler Modal/Dropdown available globally for non-module scripts
import { Modal as BsModal, Dropdown as BsDropdown } from '@tabler/core';
window.Swal = Swal;
window.JSURL = JSURL;
window.FilePond = FilePond;
window.Tagify = Tagify;
window.TomSelect = TomSelect;
window.marked = marked;
window.BsModal = BsModal;
window.BsDropdown = BsDropdown;
