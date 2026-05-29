const API = '/api/v1';

// Redirect to login when session is expired
function redirectToLogin() {
	window.location.href = '/login';
}

// Check if a fetch response was redirected to the login page
function isLoginRedirect(res) {
	return res.redirected && new URL(res.url).pathname.startsWith('/login');
}

async function api(method, path, body) {
	const options = {
		method,
		headers: { 'Content-Type': 'application/json' },
	};
	if (body && method !== 'GET') options.body = JSON.stringify(body);

	const res = await fetch(`${API}${path}`, options);
	if (res.status === 401) return redirectToLogin();
	if (isLoginRedirect(res)) return redirectToLogin();
	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: res.statusText }));
		throw new Error(err.error || 'Request failed');
	}
	return res.json();
}

// (pageshow bfcache handler removed — SPA handles navigation)

// SweetAlert2 confirm helper
async function confirmAction(title, text) {
	const { Swal } = await import('/static/js/vendor.js');
	const result = await Swal.fire({
		title,
		text,
		icon: 'warning',
		showCancelButton: true,
		confirmButtonColor: '#d33',
		confirmButtonText: 'Yes, do it',
	});
	return result.isConfirmed;
}

async function showSuccess(title) {
	const { Swal } = await import('/static/js/vendor.js');
	Swal.fire({ title, icon: 'success', timer: 1500, showConfirmButton: false });
}

async function showError(message) {
	const { Swal } = await import('/static/js/vendor.js');
	Swal.fire({ title: 'Error', text: message, icon: 'error' });
}

// Current project
window.currentProjectId = null;

function setActiveProject(projectId) {
	currentProjectId = projectId;
	document.querySelectorAll('.project-item').forEach((el) => {
		el.classList.toggle('active', el.dataset.id === projectId);
	});
}

async function importFilesToProject(files, projectId) {
	if (!files || !files.length || !projectId) return;
	var ok = 0;
	var fail = 0;
	for (var i = 0; i < files.length; i++) {
		var f = files[i];
		if (f.size === 0) continue;
		var fd = new FormData();
		fd.append('file', f);
		fd.append('project', projectId);
		try {
			var res = await fetch('/api/v1/notes/import', { method: 'POST', body: fd });
			if (res.ok) ok++;
			else fail++;
		} catch (e) {
			fail++;
		}
	}
	if (ok > 0) {
		showSuccess(ok + ' file' + (ok > 1 ? 's' : '') + ' imported as notes');
		refreshCounts();
	}
	if (fail > 0) showError(fail + ' file' + (fail > 1 ? 's' : '') + ' could not be imported');
}

// Load projects sidebar with counts
async function loadProjects() {
	try {
		const list = document.getElementById('project-list');
		if (!list) return;

		const res = await fetch(`/ajax/project-list?active=${currentProjectId || ''}`);
		if (isLoginRedirect(res)) return redirectToLogin();
		const html = await res.text();
		list.innerHTML = html;

		list.querySelectorAll('.project-item').forEach((el) => {
			// Clicking project name -> SPA navigate to dashboard
			el.addEventListener('click', (e) => {
				if (e.target.closest('a')) return;
				setActiveProject(el.dataset.id);
				navigateTo('/dashboard');
			});

			// Intercept section links (Notes, Memories, URLs, Emails) — SPA navigate with project context
			el.querySelectorAll('.project-item-section a').forEach((link) => {
				link.addEventListener('click', (e) => {
					e.preventDefault();
					setActiveProject(el.dataset.id);
					navigateTo(link.getAttribute('href'));
				});
			});

			// Drag-and-drop upload on project card
			var dragCount = 0;
			var overlay = el.querySelector('.project-drop-overlay');
			el.addEventListener('dragenter', (e) => {
				e.preventDefault();
				dragCount++;
				if (dragCount === 1 && overlay) overlay.classList.remove('d-none');
			});
			el.addEventListener('dragover', (e) => { e.preventDefault(); });
			el.addEventListener('dragleave', (e) => {
				e.preventDefault();
				dragCount--;
				if (dragCount <= 0) { dragCount = 0; if (overlay) overlay.classList.add('d-none'); }
			});
			el.addEventListener('drop', (e) => {
				e.preventDefault();
				dragCount = 0;
				if (overlay) overlay.classList.add('d-none');
				if (e.dataTransfer?.files?.length) {
					importFilesToProject(Array.from(e.dataTransfer.files), el.dataset.id);
				}
			});
		});

		if (!currentProjectId) {
			const first = list.querySelector('.project-item');
			if (first) {
				setActiveProject(first.dataset.id);
			}
		}
	} catch (err) {
		console.error('Failed to load projects:', err);
	}
}

// Load project overview into main content
async function loadProjectOverview(projectId) {
	const container = document.getElementById('project-overview');
	if (!container) return;

	try {
		const res = await fetch(`/ajax/project-overview/${projectId}`);
		if (isLoginRedirect(res)) return redirectToLogin();
		if (!res.ok) throw new Error('Failed to load');
		const html = await res.text();
		container.innerHTML = html;

		// Intercept overview card links for SPA navigation
		container.querySelectorAll('.project-section-link').forEach((link) => {
			link.addEventListener('click', (e) => {
				e.preventDefault();
				const pid = link.dataset.project;
				if (pid) {
					currentProjectId = pid;
				}
				navigateTo(link.getAttribute('href'));
			});
		});

		const copyForwardingEmailBtn = container.querySelector('#copy-forwarding-email-btn');
		copyForwardingEmailBtn?.addEventListener('click', async () => {
			const value = copyForwardingEmailBtn.dataset.copyValue || container.querySelector('#project-forwarding-email')?.value || '';
			if (!value) return;
			try {
				await navigator.clipboard.writeText(value);
			} catch {
				const input = container.querySelector('#project-forwarding-email');
				input?.select();
				document.execCommand('copy');
			}
			showSuccess('Forwarding email copied');
		});
	} catch (err) {
		container.innerHTML = '<div class="text-danger">Failed to load project</div>';
		console.error('Failed to load project overview:', err);
	}
}

// Edit project
async function editProject(projectId) {
	await openProjectSettingsModal(projectId, 'details');
}

// Delete project
async function deleteProject(projectId) {
	const confirmed = await confirmAction('Delete Project', 'This will permanently delete this project and cannot be undone.');
	if (!confirmed) return;

	try {
		await api('DELETE', `/projects/${projectId}`);
		currentProjectId = null;
		await loadProjects();
		showSuccess('Project deleted');
	} catch (err) {
		showError(err.message);
	}
}

// Project color picker options
const huebeeOptions = {
	notation: 'hex',
	hues: 12,
	saturations: 3,
	shades: 5,
	staticOpen: true,
	customColors: ['#C25', '#E62', '#EA0', '#19F', '#2D2', '#6c757d', '#333', '#F8F'],
};

const projectSettingsHuebeeOptions = {
	...huebeeOptions,
	staticOpen: false,
	setBGColor: '#project-settings-color-preview',
};

// New project — inline
document.getElementById('new-project-btn')?.addEventListener('click', async () => {
	const { Swal, Huebee } = await import('/static/js/vendor.js');
	let selectedColor = '#6c757d';
	const { value: formValues } = await Swal.fire({
		title: 'New Project',
		html: `
			<input id="swal-name" class="swal2-input" placeholder="Project name">
			<div class="mt-3"><label class="form-label">Color</label><div id="swal-color-container"><input id="swal-color" value="${selectedColor}"></div></div>
		`,
		showCancelButton: true,
		focusConfirm: false,
		didOpen: () => {
			const colorInput = document.getElementById('swal-color');
			const hueb = new Huebee(colorInput, huebeeOptions);
			hueb.on('change', (color) => { selectedColor = color; });
		},
		preConfirm: () => {
			const name = document.getElementById('swal-name').value.trim();
			if (!name) { Swal.showValidationMessage('Name is required'); return false; }
			return { name, color: selectedColor };
		},
	});
	if (formValues) {
		await api('POST', '/projects', formValues);
		loadProjects();
	}
});

// Logout
function logout() {
	fetch('/logout', { method: 'POST' }).then(() => (window.location.href = '/login'));
}

// ── SPA Router ──

var __currentRoute = null;
var __isNavigating = false;

var ROUTES = {
	'/dashboard': { section: 'dashboard', title: 'Dashboard', partial: '/ajax/section/dashboard' },
	'/notes': { section: 'notes', title: 'Notes', partial: '/ajax/section/notes', batch: true },
	'/memories': { section: 'memories', title: 'Memories', partial: '/ajax/section/memories', batch: true },
	'/urls': { section: 'urls', title: 'URLs', partial: '/ajax/section/urls', batch: true },
	'/emails': { section: 'emails', title: 'Emails', partial: '/ajax/section/emails', batch: true },
	'/ecc': { section: 'ecc', title: 'Email Command Center', partial: '/ajax/section/ecc' },
	'/trash': { section: 'trash', title: 'Trash', partial: '/ajax/section/trash' },
	'/settings': { title: 'Profile', partial: '/ajax/section/settings/profile' },
	'/settings/profile': { title: 'Profile', partial: '/ajax/section/settings/profile' },
	'/settings/security': { title: 'Security', partial: '/ajax/section/settings/security' },
	'/settings/team': { title: 'My Team', partial: '/ajax/section/settings/team' },
	'/settings/tokens': { title: 'API Tokens', partial: '/ajax/section/settings/tokens' },
	'/settings/byo-ai': { title: 'AI', partial: '/ajax/section/settings/byo-ai' },
	'/settings/email': { title: 'Email settings', partial: '/ajax/section/settings/email' },
	'/settings/typesense': { title: 'Search', partial: '/ajax/section/settings/typesense' },
	'/settings/usage': { title: 'Usage', partial: '/ajax/section/settings/usage' },
	'/settings/export': { title: 'Export', partial: '/ajax/section/settings/export' },
	'/settings/activity-logs': { title: 'Activity Logs', partial: '/ajax/section/settings/activity-logs' },
	'/settings/subscription': { title: 'Subscription', partial: '/ajax/section/settings/subscription' },
};

function shouldHideChatSidebar(path) {
	return path === '/settings' || path.indexOf('/settings/') === 0;
}

function syncLayoutForPath(path) {
	document.body.classList.toggle('kk-no-chat-sidebar', shouldHideChatSidebar(path));
	document.body.classList.toggle('kk-ecc-page', path === '/ecc');
}

// Dashboard section — managed here since it depends on app.js functions
window.__sections = window.__sections || {};
window.__sections.dashboard = {
	mount: function () {
		if (currentProjectId) loadProjectOverview(currentProjectId);
		setupOverviewDropZone();
	},
	unmount: function () {},
};

function setupOverviewDropZone() {
	var zone = document.getElementById('project-overview');
	if (!zone || zone.__dropBound) return;
	zone.__dropBound = true;
	var overlay = zone.querySelector('.project-drop-overlay');
	var dragCount = 0;
	zone.addEventListener('dragenter', function (e) {
		e.preventDefault();
		dragCount++;
		if (dragCount === 1 && overlay) overlay.classList.remove('d-none');
	});
	zone.addEventListener('dragover', function (e) { e.preventDefault(); });
	zone.addEventListener('dragleave', function (e) {
		e.preventDefault();
		dragCount--;
		if (dragCount <= 0) { dragCount = 0; if (overlay) overlay.classList.add('d-none'); }
	});
	zone.addEventListener('drop', function (e) {
		e.preventDefault();
		dragCount = 0;
		if (overlay) overlay.classList.add('d-none');
		if (e.dataTransfer?.files?.length && currentProjectId) {
			importFilesToProject(Array.from(e.dataTransfer.files), currentProjectId);
		}
	});
}

function executeScripts(container) {
	var scripts = container.querySelectorAll('script');
	scripts.forEach(function (old) {
		var el = document.createElement('script');
		Array.from(old.attributes).forEach(function (attr) {
			el.setAttribute(attr.name, attr.value);
		});
		if (!old.src) el.textContent = old.textContent;
		old.parentNode.replaceChild(el, old);
	});
}

function unmountCurrent() {
	if (!__currentRoute) return;
	var route = ROUTES[__currentRoute];
	if (!route) return;
	if (route.batch && window.__sections?.batch) window.__sections.batch.unmount();
	if (route.section && window.__sections?.[route.section]) window.__sections[route.section].unmount();
}

function mountCurrent(path) {
	var route = ROUTES[path];
	if (!route) return;
	__currentRoute = path;
	if (route.section && window.__sections?.[route.section]) window.__sections[route.section].mount();
	if (route.batch && window.__sections?.batch) window.__sections.batch.mount();
}

function isSettingsPath(path) {
	return path === '/settings' || path.indexOf('/settings/') === 0;
}

async function ensureBootstrapModal() {
	if (window.BsModal) return window.BsModal;
	var vendor = await import('/static/js/vendor.js');
	window.BsModal = vendor.Modal;
	return window.BsModal;
}

function renderSettingsLoading() {
	return '<div class="text-center py-5 text-muted"><span class="spinner-border spinner-border-sm me-2"></span><span>Loading settings...</span></div>';
}

function renderProjectSettingsLoading() {
	return '<div class="text-center py-5 text-muted"><span class="spinner-border spinner-border-sm me-2"></span><span>Loading project settings...</span></div>';
}

var __currentProjectSettingsId = null;
var __currentProjectSettingsTab = 'details';

function setProjectSettingsTab(bodyEl, tab) {
	var selected = tab || 'details';
	__currentProjectSettingsTab = selected;
	bodyEl.querySelectorAll('[data-project-settings-tab]').forEach(function (button) {
		button.classList.toggle('active', button.dataset.projectSettingsTab === selected);
	});
	bodyEl.querySelectorAll('[data-project-settings-pane]').forEach(function (pane) {
		pane.classList.toggle('d-none', pane.dataset.projectSettingsPane !== selected);
	});
}

async function loadProjectSettingsBody(projectId, tab) {
	var bodyEl = document.getElementById('project-settings-modal-body');
	if (!bodyEl) return;
	bodyEl.innerHTML = renderProjectSettingsLoading();
	try {
		var res = await fetch(`/ajax/project-settings/${projectId}`);
		if (isLoginRedirect(res)) return redirectToLogin();
		var html = await res.text();
		if (!res.ok) throw new Error(html || 'Failed to load project settings');
		bodyEl.innerHTML = html;
		executeScripts(bodyEl);
		bindProjectSettingsModal(projectId, tab || __currentProjectSettingsTab || 'details');
	} catch (err) {
		console.error('Project settings modal error:', err);
		bodyEl.innerHTML = '<div class="alert alert-danger mb-0">Failed to load project settings.</div>';
	}
}

async function openProjectSettingsModal(projectId, tab) {
	var modalEl = document.getElementById('projectSettingsModal');
	var titleEl = document.getElementById('projectSettingsModalLabel');
	if (!modalEl) return;
	__currentProjectSettingsId = projectId;
	__currentProjectSettingsTab = tab || 'details';
	if (titleEl) titleEl.textContent = 'Project settings';
	var Modal = await ensureBootstrapModal();
	Modal.getOrCreateInstance(modalEl, { backdrop: 'static', keyboard: false }).show();
	await loadProjectSettingsBody(projectId, __currentProjectSettingsTab);
}

function refreshProjectSettingsIfOpen(tab) {
	var modalEl = document.getElementById('projectSettingsModal');
	if (!modalEl || !modalEl.classList.contains('show') || !__currentProjectSettingsId) return;
	loadProjectSettingsBody(__currentProjectSettingsId, tab || __currentProjectSettingsTab);
}

function projectSelector(projectId) {
	return String(projectId || '').replace(/["\\]/g, '\\$&');
}

function updateProjectDetailsInDom(projectId, name, color) {
	var selector = projectSelector(projectId);
	document.querySelectorAll(`.project-item[data-id="${selector}"]`).forEach(function (item) {
		var nameEl = item.querySelector('.project-item-name');
		var colorEl = item.querySelector('.project-color');
		if (nameEl) nameEl.textContent = name;
		if (colorEl) colorEl.style.background = color;
	});

	var overview = document.getElementById('project-overview');
	if (overview) {
		var overviewName = overview.querySelector('.project-overview-name');
		var overviewColor = overview.querySelector('.project-overview-color');
		if (overviewName) overviewName.textContent = name;
		if (overviewColor) overviewColor.style.background = color;
	}
}

function bindProjectSettingsModal(projectId, activeTab) {
	var bodyEl = document.getElementById('project-settings-modal-body');
	if (!bodyEl) return;

	var colorInput = bodyEl.querySelector('#project-settings-color');
	var colorPreview = bodyEl.querySelector('#project-settings-color-preview');
	var projectColorHuebee = null;
	var projectColorHuebeeInit = null;

	function isHexColor(value) {
		return /^#[0-9a-f]{6}$/i.test(value || '');
	}

	function setProjectColorControls(color) {
		if (!color) return;
		if (colorPreview) colorPreview.style.background = color;
		if (colorInput) colorInput.value = color;
		if (projectColorHuebee && isHexColor(color)) projectColorHuebee.setColor(color);
	}

	async function openProjectColorPicker() {
		if (!colorInput) return;
		if (!projectColorHuebeeInit) {
			projectColorHuebeeInit = import('/static/js/vendor.js').then(function ({ Huebee }) {
				projectColorHuebee = new Huebee(colorInput, projectSettingsHuebeeOptions);
				colorInput.__projectSettingsHuebee = projectColorHuebee;
				projectColorHuebee.on('change', function (color) {
					setProjectColorControls(color);
				});
				return projectColorHuebee;
			});
		}
		var hueb = await projectColorHuebeeInit;
		if (isHexColor(colorInput.value.trim())) hueb.setColor(colorInput.value.trim());
		hueb.open();
	}

	bodyEl.querySelectorAll('[data-project-settings-tab]').forEach(function (button) {
		button.addEventListener('click', function () {
			setProjectSettingsTab(bodyEl, button.dataset.projectSettingsTab);
		});
	});
	setProjectSettingsTab(bodyEl, activeTab || 'details');

	if (colorInput) {
		colorInput.addEventListener('input', function () {
			setProjectColorControls(colorInput.value.trim());
		});
		colorInput.addEventListener('click', openProjectColorPicker);
		colorInput.addEventListener('focus', openProjectColorPicker);
	}

	var detailsForm = bodyEl.querySelector('#project-details-form');
	detailsForm?.addEventListener('submit', async function (e) {
		e.preventDefault();
		var name = bodyEl.querySelector('#project-settings-name')?.value.trim();
		var color = bodyEl.querySelector('#project-settings-color')?.value.trim();
		if (!name) return showError('Name is required');
		if (!isHexColor(color)) return showError('Color must be a valid hex value.');
		try {
			var result = await api('PUT', `/projects/${projectId}`, { name, color });
			var project = result.project || { _id: projectId, name, color };
			updateProjectDetailsInDom(project._id || projectId, project.name, project.color);
			setProjectColorControls(project.color);
			showSuccess('Project updated');
		} catch (err) {
			showError(err.message);
		}
	});

	var copyForwardingEmailBtn = bodyEl.querySelector('#project-settings-copy-forwarding-email');
	copyForwardingEmailBtn?.addEventListener('click', async function () {
		var value = copyForwardingEmailBtn.dataset.copyValue || bodyEl.querySelector('#project-settings-forwarding-email')?.value || '';
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
		} catch {
			var input = bodyEl.querySelector('#project-settings-forwarding-email');
			input?.select();
			document.execCommand('copy');
		}
		showSuccess('Forwarding email copied');
	});

	bindProjectEmailIdentityForm(bodyEl, projectId);
}

function bindProjectEmailIdentityForm(bodyEl, projectId) {
	var addBtn = bodyEl.querySelector('#project-email-identity-add');
	var formWrap = bodyEl.querySelector('#project-email-identity-form-wrap');
	var form = bodyEl.querySelector('#project-email-identity-form');
	var cancelBtn = bodyEl.querySelector('#project-email-identity-cancel');
	if (!formWrap || !form) return;
	var formHomeParent = formWrap.parentNode;
	var formHomeNextSibling = formWrap.nextSibling;

	function field(id) {
		return bodyEl.querySelector(id);
	}

	function dataBool(value) {
		return value === true || value === 'true' || value === '1' || value === 'on';
	}

	var SMTP_FIELD_IDS = [
		'#project-email-identity-smtp-host',
		'#project-email-identity-smtp-port',
		'#project-email-identity-smtp-user',
		'#project-email-identity-smtp-password',
		'#project-email-identity-smtp-tls',
		'#project-email-identity-smtp-ssl',
	];

	function toggleSystemSmtp() {
		var useSystem = field('#project-email-identity-use-system-smtp').checked;
		SMTP_FIELD_IDS.forEach(function (id) {
			var el = field(id);
			if (!el) return;
			el.disabled = useSystem;
			var group = el.closest('.col-md-8, .col-md-6, .col-md-4');
			if (group) group.classList.toggle('opacity-50', useSystem);
		});
	}

	function placeIdentityForm(row) {
		var divider = field('#project-email-identity-form-wrap .project-email-identity-form-divider');
		if (row) {
			row.insertAdjacentElement('afterend', formWrap);
			formWrap.classList.add('list-group-item');
			divider?.classList.add('d-none');
			return;
		}
		formWrap.classList.remove('list-group-item');
		divider?.classList.remove('d-none');
		if (formHomeParent && formWrap.parentNode !== formHomeParent) {
			formHomeParent.insertBefore(formWrap, formHomeNextSibling);
		}
	}

	function showIdentityForm(identity, row) {
		placeIdentityForm(row);
		var isEdit = Boolean(identity?.id);
		field('#project-email-identity-id').value = identity?.id || '';
		field('#project-email-identity-name').value = identity?.name || '';
		field('#project-email-identity-email').value = identity?.email || '';
		field('#project-email-identity-signature').value = identity?.signature || '';
		field('#project-email-identity-smtp-host').value = identity?.smtpHost || '';
		field('#project-email-identity-smtp-port').value = identity?.smtpPort || '587';
		field('#project-email-identity-smtp-user').value = identity?.smtpAuthUser || '';
		field('#project-email-identity-smtp-password').value = '';
		field('#project-email-identity-smtp-tls').checked = dataBool(identity?.smtpTls);
		field('#project-email-identity-smtp-ssl').checked = dataBool(identity?.smtpSsl);
		field('#project-email-identity-use-system-smtp').checked = dataBool(identity?.useSystemSmtp);
		toggleSystemSmtp();
		field('#project-email-identity-clear-password').checked = false;
		field('#project-email-identity-form-title').textContent = isEdit ? 'Edit outbound email address' : 'Add outbound email address';
		var passwordConfigured = dataBool(identity?.smtpPasswordConfigured);
		field('#project-email-identity-password-help').textContent = isEdit && passwordConfigured ? 'Leave empty to keep the stored password.' : '';
		field('#project-email-identity-clear-password-wrap').classList.toggle('d-none', !isEdit || !passwordConfigured);
		formWrap.classList.remove('d-none');
		field('#project-email-identity-name')?.focus();
	}

	function toggleIdentityForm(identity, row) {
		if (!formWrap.classList.contains('d-none') && field('#project-email-identity-id').value === identity?.id) {
			hideIdentityForm();
			return;
		}
		showIdentityForm(identity, row);
	}

	function hideIdentityForm() {
		form.reset();
		field('#project-email-identity-id').value = '';
		formWrap.classList.add('d-none');
		placeIdentityForm(null);
	}

	addBtn?.addEventListener('click', function () {
		showIdentityForm(null);
	});

	cancelBtn?.addEventListener('click', hideIdentityForm);

	field('#project-email-identity-use-system-smtp')?.addEventListener('change', toggleSystemSmtp);

	bodyEl.querySelectorAll('.project-email-identity-row').forEach(function (row) {
		row.addEventListener('click', function () {
			toggleIdentityForm(row.dataset, row);
		});
		row.addEventListener('keydown', function (e) {
			if (e.key !== 'Enter' && e.key !== ' ') return;
			e.preventDefault();
			toggleIdentityForm(row.dataset, row);
		});
	});

	bodyEl.querySelectorAll('.project-email-identity-edit').forEach(function (button) {
		button.addEventListener('click', function (e) {
			e.stopPropagation();
			var row = button.closest('.project-email-identity-row');
			toggleIdentityForm(row?.dataset || button.dataset, row);
		});
	});

	bodyEl.querySelectorAll('.project-email-identity-delete').forEach(function (button) {
		button.addEventListener('click', async function (e) {
			e.stopPropagation();
			var confirmed = await confirmAction('Delete email address', 'This removes the outbound SMTP configuration.');
			if (!confirmed) return;
			try {
				await api('DELETE', `/email-identities/${button.dataset.id}`);
				await loadProjectSettingsBody(projectId, 'email');
				showSuccess('Email address deleted');
			} catch (err) {
				showError(err.message);
			}
		});
	});

	form.addEventListener('submit', async function (e) {
		e.preventDefault();
		var identityId = field('#project-email-identity-id').value;
		var payload = {
			name: field('#project-email-identity-name').value.trim(),
			email: field('#project-email-identity-email').value.trim(),
			signature: field('#project-email-identity-signature').value.trim(),
			use_system_smtp: field('#project-email-identity-use-system-smtp').checked,
			smtp: {
				host: field('#project-email-identity-smtp-host').value.trim(),
				port: parseInt(field('#project-email-identity-smtp-port').value, 10) || 587,
				auth_user: field('#project-email-identity-smtp-user').value.trim(),
				auth_password: field('#project-email-identity-smtp-password').value.trim(),
				tls: field('#project-email-identity-smtp-tls').checked,
				ssl: field('#project-email-identity-smtp-ssl').checked,
			},
			clear_auth_password: field('#project-email-identity-clear-password').checked,
		};
		try {
			if (identityId) {
				await api('PUT', `/email-identities/${identityId}`, payload);
				showSuccess('Email address updated');
			} else {
				await api('POST', `/projects/${projectId}/email-identities`, payload);
				showSuccess('Email address added');
			}
			await loadProjectSettingsBody(projectId, 'email');
		} catch (err) {
			showError(err.message);
		}
	});
}

async function openSettingsModal(path) {
	var route = ROUTES[path] || ROUTES['/settings/profile'];
	if (!route || !isSettingsPath(path)) {
		window.location.href = path;
		return;
	}

	var modalEl = document.getElementById('settingsModal');
	var bodyEl = document.getElementById('settings-modal-body');
	var titleEl = document.getElementById('settingsModalLabel');
	if (!modalEl || !bodyEl || !titleEl) {
		window.location.href = path;
		return;
	}

	var Modal = await ensureBootstrapModal();
	titleEl.textContent = 'Settings';
	bodyEl.innerHTML = renderSettingsLoading();
	Modal.getOrCreateInstance(modalEl, { backdrop: 'static', keyboard: false }).show();

	try {
		var res = await fetch(route.partial);
		if (isLoginRedirect(res)) return redirectToLogin();
		if (!res.ok) throw new Error('Failed to load settings');

		var html = await res.text();
		bodyEl.innerHTML = html;
		executeScripts(bodyEl);
	} catch (err) {
		console.error('Settings modal error:', err);
		bodyEl.innerHTML = '<div class="alert alert-danger mb-0">Failed to load settings.</div>';
	}
}

window.openSettingsModal = openSettingsModal;

async function navigateTo(path, opts) {
	opts = opts || {};
	if (isSettingsPath(path) && !opts.allowSettingsPage) {
		await openSettingsModal(path);
		return;
	}
	var route = ROUTES[path];
	if (!route) {
		window.location.href = path;
		return;
	}
	if (__isNavigating) return;
	__isNavigating = true;
	syncLayoutForPath(path);

	try {
		unmountCurrent();

		var pageContent = document.getElementById('page-content');
		pageContent.style.opacity = '0.5';

		var res = await fetch(route.partial);
		if (isLoginRedirect(res)) return redirectToLogin();
		if (!res.ok) throw new Error('Failed to load section');

		var html = await res.text();
		pageContent.innerHTML = html;
		pageContent.style.opacity = '';

		executeScripts(pageContent);
		mountCurrent(path);

		document.title = route.title + ' — Kumbukum';

		if (!opts.popstate) {
			var qs = '';
			if (currentProjectId) qs = '?g=' + JSURL.stringify({ project_id: currentProjectId });
			history.pushState({ spaPath: path }, '', path + qs);
		}
	} catch (err) {
		console.error('Navigation error:', err);
		var pc = document.getElementById('page-content');
		if (pc) pc.style.opacity = '';
		window.location.href = path;
	} finally {
		__isNavigating = false;
	}
}

window.navigateTo = navigateTo;

// Popstate for back/forward
window.addEventListener('popstate', function (e) {
	var state = e.state;
	if (state && state.spaPath) {
		// Restore project context from URL
		var params = new URLSearchParams(window.location.search);
		var g = params.get('g');
		if (g) {
			var parsed = JSURL.tryParse(g, {});
			if (parsed.project_id) {
				currentProjectId = parsed.project_id;
				document.querySelectorAll('.project-item').forEach(function (el) {
					el.classList.toggle('active', el.dataset.id === currentProjectId);
				});
			}
		}
		navigateTo(state.spaPath, { popstate: true });
	}
});

// Global link interception for SPA routes
document.addEventListener('click', function (e) {
	var accountSwitchLink = e.target.closest('.account-switch-link');
	if (accountSwitchLink) {
		e.preventDefault();
		var tenantId = accountSwitchLink.dataset.tenantId;
		if (!tenantId) return;
		api('POST', '/account/switch', { tenant_id: tenantId })
			.then(function () {
				window.location.href = '/dashboard';
			})
			.catch(function (err) {
				showError(err.message);
			});
		return;
	}

	if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey) return;
	var link = e.target.closest('a[href]');
	if (!link || link.target === '_blank') return;
	if (link.classList.contains('kk-navbtn') || link.classList.contains('navbar-brand')) return;
	var href = link.getAttribute('href');
	if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript')) return;
	var pathname = href.split('?')[0];
	if (ROUTES[pathname]) {
		e.preventDefault();
		if (isSettingsPath(pathname)) {
			openSettingsModal(pathname);
			return;
		}
		// Extract g param if present
		var qIdx = href.indexOf('?');
		if (qIdx !== -1) {
			var params = new URLSearchParams(href.slice(qIdx));
			var g = params.get('g');
			if (g) {
				var parsed = JSURL.tryParse(g, {});
				if (parsed.project_id) {
					currentProjectId = parsed.project_id;
					document.querySelectorAll('.project-item').forEach(function (el) {
						el.classList.toggle('active', el.dataset.id === currentProjectId);
					});
				}
			}
		}
		navigateTo(pathname);
	}
});

// Init
function getCurrentTheme() {
	return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function setTheme(theme) {
	const next = theme === 'light' ? 'light' : 'dark';
	document.documentElement.setAttribute('data-theme', next);
	try { localStorage.setItem('kk-theme', next); } catch (e) {}
	window.dispatchEvent(new CustomEvent('kk-theme-change', { detail: { theme: next } }));
}

function initThemeToggle() {
	const btn = document.getElementById('theme-toggle');
	if (!btn) return;
	btn.addEventListener('click', (e) => {
		e.preventDefault();
		setTheme(getCurrentTheme() === 'light' ? 'dark' : 'light');
	});
}

document.addEventListener('DOMContentLoaded', async () => {
	initThemeToggle();
	const params = new URLSearchParams(window.location.search);
	const g = params.get('g');
	const hasExplicitProject = !!(g && JSURL.tryParse(g, {}).project_id);
	if (hasExplicitProject) {
		currentProjectId = JSURL.tryParse(g, {}).project_id;
	}
	await loadProjects();
	loadTrashCount();

	// Mount initial section for SPA
	var path = window.location.pathname;
	syncLayoutForPath(path);
	if (ROUTES[path]) {
		history.replaceState({ spaPath: path }, '');
		mountCurrent(path);
	}

	if (typeof initResultModalHandlers === 'function') initResultModalHandlers();
	if (typeof initChat === 'function') initChat();

	// ── Socket.IO: live count updates ──
	if (typeof io === 'function' && typeof __host_id === 'string' && __host_id) {
		const socket = io(__ws_url || undefined, { 'transports': ['websocket'], 'reconnection': true, 'autoConnect': true, 'timeout': 40000, 'withCredentials': true, 'reconnectionAttempts': 50, 'reconnectionDelay': 1000, 'reconnectionDelayMax': 10000, 'forceNew': false });
		socket.on('connect', () => {
			socket.emit('subscribe', `tenant:${__host_id}`);
		});
		socket.on('reindex:status', (data) => {
			window.dispatchEvent(new CustomEvent('reindex-status', { detail: data || {} }));
			if (data?.status === 'complete') {
				refreshCounts();
				loadTrashCount();
			}
		});
		const crudEvents = [
			'note:created', 'note:updated', 'note:deleted',
			'memory:created', 'memory:updated', 'memory:deleted',
			'url:created', 'url:updated', 'url:deleted',
			'email:created', 'email:updated', 'email:deleted',
			'email-draft:created', 'email-draft:updated', 'email-draft:deleted',
			'email-internal-note:created', 'email-internal-note:updated', 'email-internal-note:deleted',
			'outgoing-email:queued', 'outgoing-email:canceled', 'outgoing-email:sent', 'outgoing-email:error',
			'counts:refresh',
		];
		for (const evt of crudEvents) {
			socket.on(evt, (data) => {
				window.dispatchEvent(new CustomEvent(evt, { detail: data || {} }));
				refreshCounts();
				loadTrashCount();
			});
		}
	}

	// ── Same-tab CRUD: refresh counts immediately when items change via modals / batch ──
	for (const evt of ['item-modal-saved', 'item-modal-deleted', 'batch-done']) {
		window.addEventListener(evt, () => {
			refreshCounts();
			loadTrashCount();
		});
	}

	// ── Refresh counts when tab regains focus (catches events missed while backgrounded) ──
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') {
			refreshCounts();
			loadTrashCount();
		}
	});
});

// Refresh sidebar counts via API
let countDebounce = null;
async function refreshCounts() {
	clearTimeout(countDebounce);
	countDebounce = setTimeout(async () => {
		try {
			const counts = await api('GET', '/counts');
			document.querySelectorAll('.project-item').forEach(el => {
				const pid = el.dataset.id;
				const pc = counts[pid] || { notes: 0, memory: 0, urls: 0, emails: 0 };
				const sectionCounts = el.querySelectorAll('.section-count');
				if (sectionCounts[0]) sectionCounts[0].textContent = pc.notes;
				if (sectionCounts[1]) sectionCounts[1].textContent = pc.memory;
				if (sectionCounts[2]) sectionCounts[2].textContent = pc.urls;
				if (sectionCounts[3]) sectionCounts[3].textContent = pc.emails;
			});
			// Also update overview cards if visible
			const overview = document.getElementById('project-overview');
			if (overview && currentProjectId) {
				const pc = counts[currentProjectId] || { notes: 0, memory: 0, urls: 0, emails: 0 };
				const cards = overview.querySelectorAll('.fw-bold');
				if (cards[0]) cards[0].textContent = pc.notes;
				if (cards[1]) cards[1].textContent = pc.memory;
				if (cards[2]) cards[2].textContent = pc.urls;
				if (cards[3]) cards[3].textContent = pc.emails;
			}
		} catch (err) {
			console.error('Failed to refresh counts:', err);
		}
	}, 300);
}

let trashDebounce = null;
async function loadTrashCount() {
	clearTimeout(trashDebounce);
	trashDebounce = setTimeout(async () => {
		try {
			const { count } = await api('GET', '/trash/count');
			const badge = document.getElementById('trash-count-badge');
			if (badge) {
				badge.textContent = count || '';
				badge.classList.toggle('d-none', !count);
			}
		} catch (e) {
			// ignore
		}
	}, 300);
}

// ---- Git Sync ----

async function addGitRepo(projectId) {
	const { value: formValues } = await Swal.fire({
		title: 'Add Git Repository',
		html: `
			<label class="swal-label" for="swal-git-name">Label</label>
			<input id="swal-git-name" class="swal2-input">
			<label class="swal-label" for="swal-git-url">Repository URL</label>
			<div class="input-group">
				<span class="input-group-text">https://</span>
				<input id="swal-git-url" class="form-control">
			</div>
			<label class="swal-label" for="swal-git-branch">Branch</label>
			<input id="swal-git-branch" class="swal2-input">
			<span class="swal-hint">Default: main</span>
			<label class="swal-label" for="swal-git-token">Access token <small class="fw-normal text-muted">(private repos)</small></label>
			<input id="swal-git-token" class="swal2-input" type="password">
			<label class="swal-label" for="swal-git-notes">Notes directory</label>
			<input id="swal-git-notes" class="swal2-input">
			<span class="swal-hint">Default: notes</span>
			<label class="swal-label" for="swal-git-memories">Memories directory</label>
			<input id="swal-git-memories" class="swal2-input">
			<span class="swal-hint">Default: memories</span>
			<div class="swal2-checkbox-container mt-2" style="margin:0 1em">
				<label><input type="checkbox" id="swal-git-commit-sync" checked> Import commits as memories</label>
			</div>
			<label class="swal-label" for="swal-git-commit-days">Commit history days</label>
			<input id="swal-git-commit-days" class="swal2-input" type="number" min="1" value="90">
		`,
		focusConfirm: false,
		showCancelButton: true,
		confirmButtonText: 'Add',
		preConfirm: () => {
			let url = document.getElementById('swal-git-url').value.trim();
			if (!url) { Swal.showValidationMessage('Repository URL is required'); return false; }
			if (!url.startsWith('https://') && !url.startsWith('http://')) url = 'https://' + url;
			return {
				name: document.getElementById('swal-git-name').value.trim(),
				repo_url: url,
				branch: document.getElementById('swal-git-branch').value.trim() || 'main',
				auth_token: document.getElementById('swal-git-token').value.trim(),
				notes_path: document.getElementById('swal-git-notes').value.trim() || 'notes',
				memories_path: document.getElementById('swal-git-memories').value.trim() || 'memories',
				commit_sync_enabled: document.getElementById('swal-git-commit-sync').checked,
				commit_history_days: parseInt(document.getElementById('swal-git-commit-days').value, 10) || 90,
			};
		},
	});
	if (!formValues) return;
	try {
		await api('POST', `/projects/${projectId}/git-repos`, formValues);
		loadProjectOverview(projectId);
		refreshProjectSettingsIfOpen('git');
		Swal.fire({ icon: 'success', title: 'Git repo added', timer: 1500, showConfirmButton: false });
	} catch (err) {
		Swal.fire('Error', err.message, 'error');
	}
}

async function editGitRepo(repoId) {
	try {
		const { repo } = await api('GET', `/git-repos/${repoId}`);
		const editUrl = (repo.repo_url || '').replace(/^https?:\/\//, '');
		const { value: formValues } = await Swal.fire({
			title: 'Edit Git Repository',
			html: `
				<label class="swal-label" for="swal-git-name">Label</label>
				<input id="swal-git-name" class="swal2-input" value="${repo.name || ''}">
				<label class="swal-label" for="swal-git-url">Repository URL</label>
				<div class="input-group">
					<span class="input-group-text">https://</span>
					<input id="swal-git-url" class="form-control" value="${editUrl}">
				</div>
				<label class="swal-label" for="swal-git-branch">Branch</label>
				<input id="swal-git-branch" class="swal2-input" value="${repo.branch || 'main'}">
				<span class="swal-hint">Default: main</span>
				<label class="swal-label" for="swal-git-token">Access token <small class="fw-normal text-muted">(leave empty to keep)</small></label>
				<input id="swal-git-token" class="swal2-input" type="password">
				<label class="swal-label" for="swal-git-notes">Notes directory</label>
				<input id="swal-git-notes" class="swal2-input" value="${repo.notes_path || 'notes'}">
				<span class="swal-hint">Default: notes</span>
				<label class="swal-label" for="swal-git-memories">Memories directory</label>
				<input id="swal-git-memories" class="swal2-input" value="${repo.memories_path || 'memories'}">
				<span class="swal-hint">Default: memories</span>
				<div class="swal2-checkbox-container mt-2" style="margin:0 1em">
					<label><input type="checkbox" id="swal-git-commit-sync" ${repo.commit_sync_enabled !== false ? 'checked' : ''}> Import commits as memories</label>
				</div>
				<label class="swal-label" for="swal-git-commit-days">Commit history days</label>
				<input id="swal-git-commit-days" class="swal2-input" type="number" min="1" value="${repo.commit_history_days || 90}">
				<div class="swal2-checkbox-container mt-2" style="margin:0 1em">
					<label><input type="checkbox" id="swal-git-enabled" ${repo.enabled ? 'checked' : ''}> Enabled</label>
				</div>
			`,
			focusConfirm: false,
			showCancelButton: true,
			confirmButtonText: 'Save',
			preConfirm: () => {
				let rawUrl = document.getElementById('swal-git-url').value.trim();
				if (rawUrl && !rawUrl.startsWith('https://') && !rawUrl.startsWith('http://')) rawUrl = 'https://' + rawUrl;
				const data = {
					name: document.getElementById('swal-git-name').value.trim(),
					repo_url: rawUrl,
					branch: document.getElementById('swal-git-branch').value.trim(),
					notes_path: document.getElementById('swal-git-notes').value.trim(),
					memories_path: document.getElementById('swal-git-memories').value.trim(),
					commit_sync_enabled: document.getElementById('swal-git-commit-sync').checked,
					commit_history_days: parseInt(document.getElementById('swal-git-commit-days').value, 10) || 90,
					enabled: document.getElementById('swal-git-enabled').checked,
				};
				const tok = document.getElementById('swal-git-token').value.trim();
				if (tok) data.auth_token = tok;
				return data;
			},
		});
		if (!formValues) return;
		await api('PUT', `/git-repos/${repoId}`, formValues);
		const activeProject = document.querySelector('.project-item.active')?.dataset?.id;
		if (activeProject) loadProjectOverview(activeProject);
		refreshProjectSettingsIfOpen('git');
		Swal.fire({ icon: 'success', title: 'Updated', timer: 1500, showConfirmButton: false });
	} catch (err) {
		Swal.fire('Error', err.message, 'error');
	}
}

async function deleteGitRepo(repoId) {
	const result = await Swal.fire({
		title: 'Remove git repo?',
		text: 'This removes the sync configuration. Synced items remain.',
		icon: 'warning',
		showCancelButton: true,
		confirmButtonColor: '#d33',
		confirmButtonText: 'Remove',
	});
	if (!result.isConfirmed) return;
	try {
		await api('DELETE', `/git-repos/${repoId}`);
		const activeProject = document.querySelector('.project-item.active')?.dataset?.id;
		if (activeProject) loadProjectOverview(activeProject);
		refreshProjectSettingsIfOpen('git');
	} catch (err) {
		Swal.fire('Error', err.message, 'error');
	}
}

function escapeHtml(value) {
	return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	}[ch]));
}

function gitSyncSummaryText(summary = {}) {
	return `${summary.imported_files || 0} imported, ${summary.exported_files || 0} exported, ${summary.imported_commits || 0} commits, ${summary.conflicts || 0} conflicts`;
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForGitSync(repoId) {
	const startedAt = Date.now();
	while (Date.now() - startedAt < 10 * 60 * 1000) {
		const status = await api('GET', `/git-repos/${repoId}/status`);
		if (status.status !== 'in_progress') return status;
		await sleep(2000);
	}
	throw new Error('Sync is still running. Check the sync log for progress.');
}

async function triggerGitSync(repoId) {
	try {
		Swal.fire({ title: 'Syncing…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
		await api('POST', `/git-repos/${repoId}/sync`, { background: true });
		const result = await waitForGitSync(repoId);
		const activeProject = document.querySelector('.project-item.active')?.dataset?.id;
		if (activeProject) loadProjectOverview(activeProject);
		refreshProjectSettingsIfOpen('git');
		const summary = result.summary || {};
		if (result.status === 'failed') {
			Swal.fire('Sync failed', result.error || summary.message || 'Sync failed', 'error');
			return;
		}
		const detail = gitSyncSummaryText(summary);
		Swal.fire({ icon: 'success', title: 'Sync complete', text: detail, timer: 2500, showConfirmButton: false });
	} catch (err) {
		Swal.fire('Sync failed', err.message, 'error');
	}
}

async function showGitSyncLogs(repoId) {
	try {
		const { logs } = await api('GET', `/git-repos/${repoId}/logs?limit=200`);
		const rows = logs.map((log) => {
			const date = new Date(log.createdAt).toLocaleString();
			const details = log.details && Object.keys(log.details).length
				? `<div class="text-muted small">${escapeHtml(JSON.stringify(log.details))}</div>`
				: '';
			const badgeClass = {
				success: 'bg-success',
				warning: 'bg-warning text-dark',
				error: 'bg-danger',
				info: 'bg-secondary',
			}[log.level] || 'bg-secondary';
			return `
				<div class="border-bottom py-2 text-start">
					<div class="d-flex justify-content-between gap-3">
						<span><span class="badge ${badgeClass} me-2">${escapeHtml(log.level)}</span>${escapeHtml(log.message)}</span>
						<span class="text-muted small text-nowrap">${escapeHtml(date)}</span>
					</div>
					${details}
				</div>
			`;
		}).join('');
		await Swal.fire({
			title: 'Git Sync Log',
			html: `<div style="max-height:60vh;overflow:auto">${rows || '<p class="text-muted text-start mb-0">No sync logs in the last 14 days.</p>'}</div>`,
			width: 900,
			confirmButtonText: 'Close',
		});
	} catch (err) {
		Swal.fire('Error', err.message, 'error');
	}
}
