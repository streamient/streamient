/**
* AI Chat sidebar logic
*/
let currentConversationId = null;
let currentChatResults = [];

function chatResultRef(item) {
	if (!item) return null;
	const id = String(item.id || item._id || item.source_id || '').trim();
	const type = String(item._type || item.type || '').trim();
	if (!id || !type) return null;
	return {
		id,
		type,
		project_id: String(item.project_id || item.project || '').trim(),
	};
}

function compactChatResults(results) {
	if (!Array.isArray(results)) return [];
	return results.map(chatResultRef).filter(Boolean).slice(0, 100);
}

function dismissChatResults() {
	currentChatResults = [];
	document.getElementById('chat-results-panel')?.classList.add('d-none');
	document.getElementById('page-content')?.classList.remove('d-none');
}

function initChat() {
	const input = document.getElementById('chat-input');
	const sendBtn = document.getElementById('chat-send');
	const messagesEl = document.getElementById('chat-messages');
	const clearBtn = document.getElementById('clear-chat');
	const historyBtn = document.getElementById('chat-history-btn');
	const projectFilter = document.getElementById('chat-project-filter');
	const resultsPanel = document.getElementById('chat-results-panel');
	const resultsList = document.getElementById('chat-results-list');
	const closeResultsBtn = document.getElementById('close-chat-results');
	const assistantAvatarTemplate = document.getElementById('chat-assistant-avatar-template');

	if (!input || !sendBtn || !messagesEl || !assistantAvatarTemplate) return;

	function createAssistantAvatar() {
		return assistantAvatarTemplate.content.cloneNode(true);
	}

	function resizeChatInput() {
		input.style.height = 'auto';
		const maxHeight = 140;
		const nextHeight = Math.min(input.scrollHeight, maxHeight);
		input.style.height = nextHeight + 'px';
		input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
	}

	// Populate project filter
	const projectFilterReady = loadProjectFilter();
	let scopeProject = window.currentProjectId || '';
	let activeProject = scopeProject;
	let scopeRevision = 0;
	Promise.resolve(projectFilterReady).then(() => {
		scopeProject = window.currentProjectId || '';
		activeProject = scopeProject;
		if (projectFilter) projectFilter.value = scopeProject;
	});
	projectFilter?.addEventListener('change', () => {
		scopeProject = projectFilter.value;
		scopeRevision++;
		currentConversationId = null;
		currentChatResults = [];
	});
	window.addEventListener('search-project-changed', (event) => {
		scopeProject = event.detail.project_id;
		activeProject = scopeProject;
		scopeRevision++;
		if (projectFilter) projectFilter.value = scopeProject;
		currentConversationId = null;
		currentChatResults = [];
	});

	// Welcome state — hide on first interaction
	const chatWelcome = document.getElementById('chat-welcome');
	function hideWelcome() {
		if (chatWelcome) chatWelcome.classList.add('d-none');
	}
	function showWelcome() {
		if (chatWelcome) chatWelcome.classList.remove('d-none');
	}
	chatWelcome?.querySelectorAll('.chat-example-btn').forEach((btn) => {
		btn.addEventListener('click', () => {
			input.value = btn.textContent;
			resizeChatInput();
			hideWelcome();
			sendMessage();
		});
	});

	// Close results panel — restore page content
	closeResultsBtn?.addEventListener('click', dismissChatResults);

	function addMessage(role, text) {
		const row = document.createElement('div');
		row.className = `chat-msg-row ${role}`;

		const bubble = document.createElement('div');
		bubble.className = `chat-message ${role}`;
		if (role === 'assistant' && window.marked) {
			bubble.innerHTML = window.marked.parse(text);
		} else {
			bubble.textContent = text;
		}

		if (role === 'user') {
			row.innerHTML = makeAvatar(__user_name, 'xs');
		} else {
			row.appendChild(createAssistantAvatar());
		}
		row.appendChild(bubble);
		var scrollBefore = messagesEl.scrollTop;
		messagesEl.appendChild(row);
		if (role === 'user') {
			messagesEl.scrollTop = messagesEl.scrollHeight;
		} else {
			messagesEl.scrollTop = scrollBefore;
		}
		return bubble;
	}

	function createAssistantRow() {
		const row = document.createElement('div');
		row.className = 'chat-msg-row assistant';
		row.appendChild(createAssistantAvatar());
		const bubble = document.createElement('div');
		bubble.className = 'chat-message assistant';
		row.appendChild(bubble);
		messagesEl.appendChild(row);
		return bubble;
	}

	async function sendMessage() {
		const query = input.value.trim();
		if (!query) return;
		hideWelcome();

		addMessage('user', query);
		input.value = '';
		resizeChatInput();
		sendBtn.disabled = true;

		// Show thinking indicator
		const thinkingRow = document.createElement('div');
		thinkingRow.className = 'chat-msg-row assistant';
		thinkingRow.appendChild(createAssistantAvatar());
		const thinkingBubble = document.createElement('div');
		thinkingBubble.className = 'chat-message assistant';
		thinkingBubble.innerHTML = '<span class="chat-thinking"><span>.</span><span>.</span><span>.</span></span>';
		thinkingRow.appendChild(thinkingBubble);
		messagesEl.appendChild(thinkingRow);
		messagesEl.scrollTop = messagesEl.scrollHeight;

		try {
			await projectFilterReady;
			if (activeProject !== (window.currentProjectId || '')) {
				activeProject = window.currentProjectId || '';
				scopeProject = activeProject;
				scopeRevision++;
				projectFilter.value = scopeProject;
				currentConversationId = null;
				currentChatResults = [];
			}
			const projectId = scopeProject || undefined;
			const requestScope = scopeRevision;
			const body = {
				query,
				conversation_id: currentConversationId,
				project_id: projectId,
				context_results: currentChatResults,
			};

			const res = await fetch('/api/v1/chat/stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...(typeof __streamient_demo_mode === 'boolean' && __streamient_demo_mode ? { 'X-Streamient-Demo': '1' } : {}) },
				body: JSON.stringify(body),
			});
			if (typeof __streamient_demo_mode === 'boolean' && __streamient_demo_mode && res.status === 410) {
				window.location.href = '/dashboard?demo=false';
				return;
			}

			if (res.status === 401 || (res.redirected && new URL(res.url).pathname.startsWith('/login'))) {
				window.location.href = '/login';
				return;
			}

			if (res.status === 429) {
				let data = null;
				try { data = await res.json(); } catch { /* non-JSON body */ }
				thinkingRow.remove();
				let message = data?.error || 'Daily AI limit reached — please try again tomorrow.';
				if (data?.code === 'AI_DAILY_LIMIT' && data?.upgrade_url) {
					message += ` [View account limits](${data.upgrade_url})`;
				}
				addMessage('assistant', message);
				return;
			}

			if (!res.ok || !res.body) {
				let message = 'Stream request failed';
				try {
					const contentType = res.headers.get('Content-Type') || '';
					if (contentType.includes('application/json')) {
						const data = await res.json();
						message = data?.error || message;
					} else {
						const text = await res.text();
						if (text) message = text;
					}
				} catch {
					// Keep generic fallback.
				}
				throw new Error(message);
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let sseBuffer = '';
			let markdown = '';
			let bubble = null;
			let currentEvent = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				sseBuffer += decoder.decode(value, { stream: true });
				const lines = sseBuffer.split('\n');
				sseBuffer = lines.pop() || '';

				for (const line of lines) {
					if (line.startsWith('event: ')) {
						currentEvent = line.slice(7).trim();
					} else if (line.startsWith('data: ')) {
						const payload = line.slice(6);
						try {
							const data = JSON.parse(payload);

							if (requestScope !== scopeRevision) continue;
							if (currentEvent === 'token') {
								if (!bubble) {
									thinkingRow.remove();
									bubble = createAssistantRow();
								}
								markdown += data.text;
								if (window.marked) {
									bubble.innerHTML = window.marked.parse(markdown);
								} else {
									bubble.textContent = markdown;
								}
							} else if (currentEvent === 'done') {
								if (data.conversation_id) {
									currentConversationId = data.conversation_id;
								}
								if (data.conversation_reset) {
									addMessage('assistant', 'Your previous chat thread expired, so I started a new conversation for this reply.');
								}
								if (data.search_filters) {
									currentConversationId = null;
									await window.__sections.search.open(data.search_filters);
								} else if (data.results?.length && data.display_in === 'panel') {
									renderResults(data.results, resultsList, resultsPanel);
								}
								if (data.action?.completed) {
									if (data.action.type === 'move_to_project') {
										currentChatResults = [];
										resultsPanel?.classList.add('d-none');
										pageContent?.classList.remove('d-none');
									}
									addMessage('assistant', `✓ Action completed: ${data.action.type}`);
								}
							} else if (currentEvent === 'error') {
								throw new Error(data.error || 'Stream error');
							}
						} catch (parseErr) {
							if (currentEvent === 'error') throw parseErr;
						}
						currentEvent = '';
					}
				}
			}

			// If no tokens were received, remove thinking indicator
			if (!bubble) {
				thinkingRow.remove();
			}
		} catch (err) {
			thinkingRow.remove();
			addMessage('assistant', 'Error: ' + (err.message || 'Failed to send message'));
		} finally {
			sendBtn.disabled = false;
			input.focus();
		}
	}

	sendBtn.addEventListener('click', sendMessage);
	input.addEventListener('input', resizeChatInput);
	input.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	});
	resizeChatInput();

	// New conversation
	clearBtn?.addEventListener('click', () => {
		currentConversationId = null;
		currentChatResults = [];
		messagesEl.innerHTML = '';
		resultsPanel?.classList.add('d-none');
		pageContent?.classList.remove('d-none');
		showWelcome();
		messagesEl.appendChild(chatWelcome);
	});

	// Conversation history
	historyBtn?.addEventListener('click', async () => {
		try {
			currentChatResults = [];
			resultsPanel?.classList.add('d-none');
			pageContent?.classList.remove('d-none');
			const res = await api('GET', '/chat/conversations?limit=10');
			if (!res.conversations?.length) {
				addMessage('assistant', 'No previous conversations.');
				return;
			}
			messagesEl.innerHTML = '';
			const header = document.createElement('div');
			header.className = 'chat-message assistant';
			header.innerHTML = '<strong>Recent conversations:</strong>';
			messagesEl.appendChild(header);

			res.conversations.forEach((c) => {
				const item = document.createElement('div');
				item.className = 'chat-history-item p-2 rounded mb-1';
				item.style.cursor = 'pointer';
				item.textContent = c.title || `Conversation ${c.conversation_id.slice(0, 8)}`;
				item.addEventListener('click', async () => {
					currentConversationId = c.conversation_id;
					messagesEl.innerHTML = '';
					try {
						const msgRes = await api('GET', `/chat/conversations/${c.conversation_id}/messages`);
						const messages = msgRes.messages || [];
						if (messages.length) {
							// Messages are oldest → newest; addMessage() appends, so render in order.
							messages.forEach((m) => addMessage(m.role === 'user' ? 'user' : 'assistant', m.message));
							messagesEl.scrollTop = messagesEl.scrollHeight;
						} else {
							addMessage('assistant', `Resumed conversation: ${c.title || c.conversation_id.slice(0, 8)}`);
						}
					} catch {
						addMessage('assistant', `Resumed conversation: ${c.title || c.conversation_id.slice(0, 8)}`);
					}
				});
				messagesEl.appendChild(item);
			});
		} catch {
			addMessage('assistant', 'Could not load conversations.');
		}
	});

	if (typeof __streamient_demo_mode === 'boolean' && __streamient_demo_mode && __streamient_demo_scene?.name === 'search' && __streamient_demo_scene.path === window.location.pathname && __streamient_demo_scene.chat_query && !window.__streamientDemoChatSceneApplied) {
		window.__streamientDemoChatSceneApplied = true;
		Promise.resolve(projectFilterReady).then(() => {
			if (projectFilter && __streamient_demo_scene.project_id) projectFilter.value = __streamient_demo_scene.project_id;
			input.value = __streamient_demo_scene.chat_query;
			resizeChatInput();
			sendMessage();
		});
	}
}

async function loadProjectFilter() {
	const select = document.getElementById('chat-project-filter');
	if (!select) return;

	try {
		const res = await api('GET', '/projects');
		const projects = res.projects || res;
		if (!Array.isArray(projects)) return;

		projects.forEach((p) => {
			const opt = document.createElement('option');
			opt.value = p._id;
			opt.textContent = p.name;
			select.appendChild(opt);
		});

		// With a single project the "All projects" vs project distinction is
		// meaningless (e.g. the Free plan), so hide the filter entirely.
		const wrap = document.getElementById('chat-project-filter-wrap');
		if (wrap) wrap.classList.toggle('d-none', projects.length <= 1);
	} catch {
		// silently fail
	}
}

function renderResults(results, listEl, panelEl) {
	const pageContent = document.getElementById('page-content');
	currentChatResults = compactChatResults(results);
	listEl.innerHTML = '';
	panelEl.classList.remove('d-none');
	pageContent?.classList.add('d-none');

	results.forEach((item) => {
		const card = document.createElement('div');
		card.className = 'card mb-2 chat-result-card';
		card.style.cursor = 'pointer';
		card.addEventListener('click', () => openResultModal(item));

		const body = document.createElement('div');
		body.className = 'card-body p-3';

		const badge = document.createElement('span');
		badge.className = `badge st-result-type-badge ${typeBadgeClass(item._type)} me-2`;
		badge.textContent = item._type;

		const titleSpan = document.createElement('strong');
		titleSpan.className = 'text-truncate';
		titleSpan.textContent = item.title || item.url || 'Untitled';

		const titleRow = document.createElement('div');
		titleRow.className = 'd-flex align-items-center gap-1';
		titleRow.appendChild(badge);
		titleRow.appendChild(titleSpan);

		// Date
		const ts = item.updated_at || item.created_at || item.crawled_at;
		if (ts) {
			const dateEl = document.createElement('small');
			dateEl.className = 'text-muted text-nowrap flex-shrink-0 ms-auto';
			dateEl.dataset.dateValue = String(Number(ts) * 1000);
			dateEl.dataset.dateFormat = 'locale';
			dateEl.dataset.dateOptions = JSON.stringify({ year: 'numeric', month: 'short', day: 'numeric' });
			dateEl.textContent = window.StreamientDateFormat?.formatLocale(Number(ts) * 1000, { year: 'numeric', month: 'short', day: 'numeric' }) || '';
			titleRow.appendChild(dateEl);
		}

		body.appendChild(titleRow);

		const snippet = item.text_content || item.content || item.description || '';
		if (snippet) {
			const text = document.createElement('p');
			text.className = 'card-text text-muted small mb-0 mt-1';
			text.textContent = snippet.slice(0, 200) + (snippet.length > 200 ? '...' : '');
			body.appendChild(text);
		}

		card.appendChild(body);
		listEl.appendChild(card);
	});
}

// ── Universal Item Modal (create / edit / preview) ───────────────

let rmEditor = null;
let rmCurrentId = null;
let rmCurrentType = null;
let rmContent = '';
let rmTextContent = '';
let rmMarkdownContent = '';
let rmIsObsidianSynced = false;
let rmObsidianConnectionId = '';
let rmSelectedLinks = [];
let rmOriginalLinks = [];
let rmTagConnections = [];
let rmRelDropdown = null;
let rmRelDebounce = null;
let rmRelHighlightIdx = -1;
let rmUrlPagesRequestSeq = 0;
let rmUrlPagesPage = 1;
let rmUrlPagesPerPage = 100;
let rmUrlPagesTotal = 0;
let rmUrlPagesLoaded = 0;
let rmUrlCrawlEnabled = false;
let rmUrlCrawlDisableConfirmed = false;
let rmUrlPageTextCache = new Map();
let rmUrlPageTextRequestSeq = 0;
let rmUrlCrawlItemCounter = 0;
let rmEmailBodyText = '';
let rmEmailHtml = '';
let rmEmailHtmlHasRemoteImages = false;
let rmEmailBodyMode = 'text';
let rmEmailThemeMode = 'dark';
let rmEmailSubject = '';
let rmEmailFrom = '';
let rmEmailRemoteImagesLoaded = false;
let rmEmailBodyLoaded = false;

function rmIsDemoReadOnly() {
	return typeof __streamient_demo_mode === 'boolean' && __streamient_demo_mode;
}

function rmApplyDemoReadOnly() {
	if (!rmIsDemoReadOnly()) return;
	for (const id of ['rm-note-title', 'rm-note-tags', 'rm-memory-title', 'rm-memory-tags', 'rm-memory-source', 'rm-url-input', 'rm-url-title', 'rm-url-description']) {
		const element = document.getElementById(id);
		if (element) element.readOnly = true;
	}
	const crawl = document.getElementById('rm-url-crawl');
	if (crawl) crawl.disabled = true;
	document.querySelectorAll('.rm-link-search').forEach((element) => { element.disabled = true; });
}

function rmShowModal(modalEl) {
	const modal = BsModal.getOrCreateInstance(modalEl);
	if (!modalEl.classList.contains('show')) modal.show();
	return modal;
}

function rmCleanupModalBackdrops() {
	if (document.querySelector('.modal.show')) return;
	document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());
	document.body.classList.remove('modal-open');
	document.body.style.removeProperty('overflow');
	document.body.style.removeProperty('padding-right');
}

/**
 * Open the universal item modal.
 * @param {string} type - 'notes' | 'memory' | 'urls'
 * @param {string|null} id - Record ID for edit mode, null for create
 * @param {object} defaults - Optional default values for create mode
 */
async function openItemModal(type, id, defaults = {}) {
	const modalEl = document.getElementById('chat-result-modal');
	if (!modalEl) return;
	if (rmIsDemoReadOnly() && !id) return;

	const titleEl = document.getElementById('result-modal-title');
	const badgeEl = document.getElementById('result-modal-badge');
	const loadingEl = document.getElementById('result-modal-loading');
	const saveBtn = document.getElementById('rm-save-btn');
	const deleteBtn = document.getElementById('rm-delete-btn');

	// Reset
	rmCleanup();
	document.getElementById('result-modal-note').classList.add('d-none');
	document.getElementById('result-modal-memory').classList.add('d-none');
	document.getElementById('result-modal-url').classList.add('d-none');
	document.getElementById('result-modal-email').classList.add('d-none');
	loadingEl.classList.add('d-none');
	saveBtn.classList.toggle('d-none', rmIsDemoReadOnly());

	rmCurrentType = type;
	rmCurrentId = id || null;

	const typeLabels = { notes: 'Note', memory: 'Memory', urls: 'URL' };
	const isCreate = !id;
	titleEl.textContent = isCreate ? `New ${typeLabels[type] || type}` : (defaults.title || defaults.url || 'Loading...');
	badgeEl.className = `badge st-result-type-badge ${typeBadgeClass(type)} me-2`;
	badgeEl.textContent = typeLabels[type] || type;

	// Show/hide delete button (only for existing records)
	if (isCreate || rmIsDemoReadOnly()) {
		deleteBtn.classList.add('d-none');
	} else {
		deleteBtn.classList.remove('d-none');
	}

	rmShowModal(modalEl);

	if (isCreate) {
		rmPopulate(type, defaults);
		// Start in edit mode for create
		if (type === 'notes') rmShowNoteEdit();
		else if (type === 'memory') rmShowMemoryEdit();
	} else {
		loadingEl.classList.remove('d-none');
		try {
			const typeEndpoints = { notes: 'notes', memory: 'memories', urls: 'urls' };
			const endpoint = typeEndpoints[type];
			const res = await api('GET', `/${endpoint}/${id}`);
			const record = res.note || res.memory || res.url || res;
			if (record.obsidian_source?.file_id && (type === 'notes' || type === 'memory')) {
				const contentResponse = await fetch(`/api/v1/obsidian/files/${record.obsidian_source.file_id}/content`);
				if (!contentResponse.ok) throw new Error('Failed to load canonical Markdown');
				record.markdown_content = await contentResponse.text();
			}
			titleEl.textContent = record.title || record.url || 'Untitled';
			loadingEl.classList.add('d-none');
			rmPopulate(type, record);
		} catch (err) {
			loadingEl.innerHTML = `<p class="text-danger">Failed to load: ${err.message || 'Unknown error'}</p>`;
		}
	}
}

/**
 * Open modal from a chat search result item (may include pages/unknown types).
 */
async function openResultModal(item) {
	if (item._type === 'vault_files' && item.id) {
		window.open(`/api/v1/obsidian/files/${encodeURIComponent(item.id)}/content`, '_blank', 'noopener');
		return;
	}
	const editableTypes = ['notes', 'memory', 'urls'];
	if (editableTypes.includes(item._type) && item.id) {
		return openItemModal(item._type, item.id, item);
	}
	if (item._type === 'emails' && item.id) {
		return openEmailModal(item);
	}
	// Pages or unknown — read-only preview
	const modalEl = document.getElementById('chat-result-modal');
	if (!modalEl) return;

	rmCleanup();
	document.getElementById('result-modal-note').classList.add('d-none');
	document.getElementById('result-modal-memory').classList.add('d-none');
	document.getElementById('result-modal-url').classList.add('d-none');
	document.getElementById('result-modal-email').classList.add('d-none');
	document.getElementById('rm-save-btn').classList.add('d-none');
	document.getElementById('rm-delete-btn').classList.add('d-none');

	document.getElementById('result-modal-title').textContent = item.title || item.url || 'Untitled';
	document.getElementById('result-modal-badge').className = `badge st-result-type-badge ${typeBadgeClass(item._type)} me-2`;
	document.getElementById('result-modal-badge').textContent = item._type;

	const loadingEl = document.getElementById('result-modal-loading');
	loadingEl.classList.remove('d-none');
	let html = '';
	if (item.url) html += `<div class="mb-2"><a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.url)}</a></div>`;
	const text = item.text_content || item.attachment_text_content || item.content || item.description || '';
	if (text) html += `<div class="text-muted" style="white-space:pre-wrap">${escapeHtml(text.slice(0, 3000))}</div>`;
	loadingEl.innerHTML = html || '<p class="text-muted">No content available</p>';

	rmShowModal(modalEl);
}

function formatList(values) {
	if (!Array.isArray(values) || !values.length) return '—';
	return values.join(', ');
}

function rmShowEmailDetails() {
	document.getElementById('rm-email-tab-details')?.classList.add('active');
	document.getElementById('rm-email-tab-body')?.classList.remove('active');
	document.getElementById('rm-email-pane-details')?.classList.remove('d-none');
	document.getElementById('rm-email-pane-body')?.classList.add('d-none');
}

function rmShowEmailBody() {
	document.getElementById('rm-email-tab-details')?.classList.remove('active');
	document.getElementById('rm-email-tab-body')?.classList.add('active');
	document.getElementById('rm-email-pane-details')?.classList.add('d-none');
	document.getElementById('rm-email-pane-body')?.classList.remove('d-none');
	if (rmEmailBodyLoaded) return;
	rmRenderEmailBody();
	rmEmailBodyLoaded = true;
}

function rmEmailHtmlWithRemoteImages() {
	if (!window.kkEmailIframeRenderer) return rmEmailHtml;
	return window.kkEmailIframeRenderer.htmlWithRemoteImages(rmEmailHtml, rmEmailRemoteImagesLoaded);
}

function rmInitEmailFrameResize(frame) {
	window.kkEmailIframeRenderer?.initResize(frame);
}

function rmSetEmailBodyMode(mode) {
	rmEmailBodyMode = mode === 'html' && rmEmailHtml ? 'html' : 'text';
	document.getElementById('rm-email-html-btn')?.classList.toggle('active', rmEmailBodyMode === 'html');
	document.getElementById('rm-email-text-btn')?.classList.toggle('active', rmEmailBodyMode === 'text');
	rmRenderEmailBody();
}

function rmSetEmailThemeMode(mode) {
	rmEmailThemeMode = mode === 'original' ? 'original' : 'dark';
	document.getElementById('rm-email-dark-btn')?.classList.toggle('active', rmEmailThemeMode === 'dark');
	document.getElementById('rm-email-original-btn')?.classList.toggle('active', rmEmailThemeMode === 'original');
	rmRenderEmailBody();
}

function rmRenderEmailBody() {
	const frame = document.getElementById('rm-email-html-frame');
	const textEl = document.getElementById('rm-email-text-content');
	const htmlBtn = document.getElementById('rm-email-html-btn');
	const textBtn = document.getElementById('rm-email-text-btn');
	const themeGroup = document.getElementById('rm-email-theme-mode');
	const loadImagesBtn = document.getElementById('rm-email-load-images-btn');
	if (!frame || !textEl) return;

	const hasHtml = Boolean(rmEmailHtml);
	const hasRemoteImages = hasHtml && rmEmailHtmlHasRemoteImages && !rmEmailRemoteImagesLoaded;
	if (htmlBtn) htmlBtn.disabled = !hasHtml;
	if (textBtn) textBtn.disabled = !rmEmailBodyText;
	if (!hasHtml && rmEmailBodyMode === 'html') rmEmailBodyMode = 'text';
	if (themeGroup) themeGroup.classList.toggle('d-none', !hasHtml || rmEmailBodyMode !== 'html');
	if (loadImagesBtn) loadImagesBtn.classList.toggle('d-none', !hasRemoteImages || rmEmailBodyMode !== 'html');

	frame.classList.toggle('d-none', rmEmailBodyMode !== 'html');
	textEl.classList.toggle('d-none', rmEmailBodyMode !== 'text');

	if (rmEmailBodyMode === 'html') {
		rmInitEmailFrameResize(frame);
		if (window.kkEmailIframeRenderer) {
			frame.srcdoc = window.kkEmailIframeRenderer.buildSrcdoc({
				html: rmEmailHtmlWithRemoteImages(),
				loadRemoteImages: rmEmailRemoteImagesLoaded,
				theme: rmEmailThemeMode,
				subject: rmEmailSubject,
				from: rmEmailFrom,
			});
		}
	} else {
		frame.removeAttribute('srcdoc');
		textEl.textContent = rmEmailBodyText || 'No content available.';
	}

	document.getElementById('rm-email-html-btn')?.classList.toggle('active', rmEmailBodyMode === 'html');
	document.getElementById('rm-email-text-btn')?.classList.toggle('active', rmEmailBodyMode === 'text');
	document.getElementById('rm-email-dark-btn')?.classList.toggle('active', rmEmailThemeMode === 'dark');
	document.getElementById('rm-email-original-btn')?.classList.toggle('active', rmEmailThemeMode === 'original');
}

function rmSetEmailThreadVisibility(visible) {
	const mainCol = document.getElementById('rm-email-main-col');
	const threadCol = document.getElementById('rm-email-thread-col');
	if (!mainCol || !threadCol) return;
	threadCol.classList.toggle('d-none', !visible);
	mainCol.classList.toggle('col-md-8', !!visible);
	mainCol.classList.toggle('col-md-12', !visible);
}

function rmResetEmailView() {
	rmEmailBodyText = '';
	rmEmailHtml = '';
	rmEmailHtmlHasRemoteImages = false;
	rmEmailBodyMode = 'text';
	rmEmailThemeMode = window.kkEmailIframeRenderer?.defaultTheme() || 'dark';
	rmEmailSubject = '';
	rmEmailFrom = '';
	rmEmailRemoteImagesLoaded = false;
	rmEmailBodyLoaded = false;
	const frame = document.getElementById('rm-email-html-frame');
	const textEl = document.getElementById('rm-email-text-content');
	const loadImagesBtn = document.getElementById('rm-email-load-images-btn');
	const themeGroup = document.getElementById('rm-email-theme-mode');
	if (frame) {
		frame.classList.add('d-none');
		frame.removeAttribute('srcdoc');
		frame.style.height = '';
	}
	if (textEl) {
		textEl.classList.remove('d-none');
		textEl.textContent = 'Open the Body tab to load content.';
	}
	if (loadImagesBtn) loadImagesBtn.classList.add('d-none');
	if (themeGroup) themeGroup.classList.add('d-none');
	document.getElementById('rm-email-html-btn')?.classList.remove('active');
	document.getElementById('rm-email-text-btn')?.classList.add('active');
	document.getElementById('rm-email-dark-btn')?.classList.toggle('active', rmEmailThemeMode === 'dark');
	document.getElementById('rm-email-original-btn')?.classList.toggle('active', rmEmailThemeMode === 'original');
	if (document.getElementById('rm-email-thread')) {
		document.getElementById('rm-email-thread').innerHTML = '';
	}
	rmSetEmailThreadVisibility(false);
	rmShowEmailDetails();
}

function renderEmailThread(thread = [], currentId) {
	const threadEl = document.getElementById('rm-email-thread');
	if (!threadEl) return;
	const showThread = Array.isArray(thread) && thread.length > 1;
	rmSetEmailThreadVisibility(showThread);
	if (!showThread) {
		threadEl.innerHTML = '';
		return;
	}
	threadEl.innerHTML = thread.map((msg) => {
		const msgId = msg._id || msg.id || '';
		const subject = escapeHtml(msg.subject || '(No subject)');
		const date = msg.createdAt ? window.StreamientDateFormat?.formatLocale(msg.createdAt) || '' : '';
		const active = msgId === currentId ? ' is-active' : '';
		return `<button type="button" class="rm-email-thread-item${active}" data-email-id="${msgId}">
			<div class="rm-email-thread-subject fw-semibold text-truncate">${subject}</div>
			<small class="rm-email-thread-date">${escapeHtml(date)}</small>
		</button>`;
	}).join('');
	threadEl.querySelectorAll('[data-email-id]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const emailId = btn.dataset.emailId;
			if (!emailId) return;
			openEmailModal({ _type: 'emails', id: emailId });
		});
	});
}

function renderEmailDetails(email, thread = []) {
	document.getElementById('rm-email-subject').value = email.subject || '(No subject)';
	document.getElementById('rm-email-from').value = formatList(email.from);
	document.getElementById('rm-email-to').value = formatList(email.to);
	document.getElementById('rm-email-cc').value = formatList(email.cc);
	document.getElementById('rm-email-bcc').value = formatList(email.bcc);
	document.getElementById('rm-email-message-id').value = email.message_id || '—';
	document.getElementById('rm-email-references').value = formatList(email.references);
	rmEmailSubject = email.subject || '';
	rmEmailFrom = formatList(email.from);
	rmEmailBodyText = [email.text_content, email.attachment_text_content]
		.filter(Boolean)
		.join('\n\n');
	rmEmailHtml = email.html_content || '';
	rmEmailHtmlHasRemoteImages = Boolean(email.html_content_has_remote_images);
	rmEmailBodyMode = rmEmailHtml ? 'html' : 'text';
	rmEmailThemeMode = window.kkEmailIframeRenderer?.defaultTheme() || 'dark';
	rmEmailRemoteImagesLoaded = false;
	rmEmailBodyLoaded = false;
	document.getElementById('rm-email-text-content').textContent = 'Open the Body tab to load content.';
	document.getElementById('rm-email-html-btn')?.classList.toggle('active', Boolean(rmEmailHtml));
	if (document.getElementById('rm-email-html-btn')) document.getElementById('rm-email-html-btn').disabled = !rmEmailHtml;
	document.getElementById('rm-email-text-btn')?.classList.toggle('active', !rmEmailHtml);
	document.getElementById('rm-email-theme-mode')?.classList.toggle('d-none', !rmEmailHtml);
	document.getElementById('rm-email-dark-btn')?.classList.toggle('active', rmEmailThemeMode === 'dark');
	document.getElementById('rm-email-original-btn')?.classList.toggle('active', rmEmailThemeMode === 'original');
	document.getElementById('rm-email-load-images-btn')?.classList.toggle('d-none', !rmEmailHtmlHasRemoteImages);
	renderEmailThread(thread, email._id);
}

async function openEmailModal(item) {
	const modalEl = document.getElementById('chat-result-modal');
	if (!modalEl) return;
	const loadingEl = document.getElementById('result-modal-loading');
	const saveBtn = document.getElementById('rm-save-btn');
	const deleteBtn = document.getElementById('rm-delete-btn');
	const titleEl = document.getElementById('result-modal-title');
	const badgeEl = document.getElementById('result-modal-badge');

	rmCleanup();
	rmCurrentType = 'emails';
	rmCurrentId = item.id || null;
	document.getElementById('result-modal-note').classList.add('d-none');
	document.getElementById('result-modal-memory').classList.add('d-none');
	document.getElementById('result-modal-url').classList.add('d-none');
	document.getElementById('result-modal-email').classList.remove('d-none');
	saveBtn.classList.add('d-none');
	deleteBtn.classList.add('d-none');
	loadingEl.classList.remove('d-none');
	document.getElementById('rm-email-subject').value = '(Loading...)';
	document.getElementById('rm-email-from').value = '—';
	document.getElementById('rm-email-to').value = '—';
	document.getElementById('rm-email-cc').value = '—';
	document.getElementById('rm-email-bcc').value = '—';
	document.getElementById('rm-email-message-id').value = '—';
	document.getElementById('rm-email-references').value = '—';
	rmResetEmailView();

	titleEl.textContent = item.title || '(No subject)';
	badgeEl.className = `badge st-result-type-badge ${typeBadgeClass('emails')} me-2`;
	badgeEl.textContent = 'Email';

	rmShowModal(modalEl);

	try {
		const [emailRes, threadRes] = await Promise.all([
			api('GET', `/emails/${item.id}`),
			api('GET', `/emails/${item.id}/thread`).catch(() => ({ thread: [] })),
		]);
		const email = emailRes.email || emailRes;
		const thread = threadRes.thread || [];
		rmCurrentId = email._id || item.id || null;
		titleEl.textContent = email.subject || '(No subject)';
		renderEmailDetails(email, thread);
		loadingEl.classList.add('d-none');
	} catch (err) {
		loadingEl.innerHTML = `<p class="text-danger">Failed to load email: ${escapeHtml(err.message || 'Unknown error')}</p>`;
	}
}

function rmSetUrlParsedText(record = {}) {
	const content = document.getElementById('rm-url-text-content');
	const empty = document.getElementById('rm-url-text-empty');
	const status = document.getElementById('rm-url-text-index-status');
	const text = String(record.text_content || '');
	if (!content || !empty || !status) return;

	content.textContent = text;
	content.classList.toggle('d-none', !text);
	empty.classList.toggle('d-none', !!text);
	empty.textContent = rmCurrentId ? 'No text was parsed for this URL.' : 'Parsed text will appear after this URL is saved.';
	status.className = `badge ${record.is_indexed === true ? 'text-bg-success' : 'text-bg-secondary'}`;
	status.textContent = record.is_indexed === true ? 'Indexed' : 'Not indexed';
}

function rmSetUrlCrawlItemExpanded(item, expanded) {
	const button = item.querySelector('.rm-crawl-text-btn');
	const panel = item.querySelector('.rm-crawl-text-panel');
	const label = item.querySelector('.rm-crawl-text-label');
	if (!button || !panel || !label) return;

	button.setAttribute('aria-expanded', String(expanded));
	panel.classList.toggle('d-none', !expanded);
	label.textContent = expanded ? 'Hide indexed text' : 'View indexed text';
}

function rmSetUrlCrawlItemLoading(item, loading) {
	const button = item.querySelector('.rm-crawl-text-btn');
	const icon = item.querySelector('.rm-crawl-text-icon');
	const spinner = item.querySelector('.rm-crawl-text-spinner');
	const label = item.querySelector('.rm-crawl-text-label');
	if (!button || !icon || !spinner || !label) return;

	button.disabled = loading;
	icon.classList.toggle('d-none', loading);
	spinner.classList.toggle('d-none', !loading);
	if (loading) label.textContent = 'Loading...';
	else label.textContent = button.getAttribute('aria-expanded') === 'true' ? 'Hide indexed text' : 'View indexed text';
}

function rmCollapseUrlCrawlItems(exceptItem = null) {
	const list = document.getElementById('rm-url-crawl-list');
	if (!list) return;
	list.querySelectorAll('.rm-crawl-item').forEach((item) => {
		if (item !== exceptItem) rmSetUrlCrawlItemExpanded(item, false);
	});
}

function rmRenderUrlCrawlText(item, page) {
	const text = String(page.text_content || '');
	const content = item.querySelector('.rm-crawl-text');
	const empty = item.querySelector('.rm-crawl-text-empty');
	const warning = item.querySelector('.rm-crawl-text-warning');
	if (!content || !empty || !warning) return;

	content.textContent = text;
	content.classList.toggle('d-none', !text);
	empty.classList.toggle('d-none', !!text);
	warning.classList.toggle('d-none', page.index_complete !== false);
}

async function rmToggleUrlCrawlText(item, page) {
	const button = item.querySelector('.rm-crawl-text-btn');
	if (!button) return;
	if (button.getAttribute('aria-expanded') === 'true') {
		rmSetUrlCrawlItemExpanded(item, false);
		return;
	}

	const requestSeq = ++rmUrlPageTextRequestSeq;
	const urlId = rmCurrentId;
	rmCollapseUrlCrawlItems(item);
	const cached = rmUrlPageTextCache.get(page.id);
	if (cached) {
		rmRenderUrlCrawlText(item, cached);
		rmSetUrlCrawlItemExpanded(item, true);
		return;
	}

	rmSetUrlCrawlItemLoading(item, true);
	try {
		const res = await api('GET', `/urls/${urlId}/pages/${encodeURIComponent(page.id)}`);
		const indexedPage = res.page || res;
		rmUrlPageTextCache.set(page.id, indexedPage);
		if (requestSeq !== rmUrlPageTextRequestSeq || rmCurrentType !== 'urls' || rmCurrentId !== urlId || !item.isConnected) return;
		rmRenderUrlCrawlText(item, indexedPage);
		rmSetUrlCrawlItemExpanded(item, true);
	} catch (err) {
		if (requestSeq === rmUrlPageTextRequestSeq && rmCurrentType === 'urls' && rmCurrentId === urlId) {
			showError('Could not load indexed text: ' + (err.message || 'Unknown error'));
		}
	} finally {
		rmSetUrlCrawlItemLoading(item, false);
	}
}

function rmCreateUrlCrawlItem(page) {
	const template = document.getElementById('rm-url-crawl-item-template');
	if (!template?.content?.firstElementChild) return null;
	const item = template.content.firstElementChild.cloneNode(true);
	const link = item.querySelector('.rm-crawl-link');
	const title = item.querySelector('.rm-crawl-title');
	const url = item.querySelector('.rm-crawl-url');
	const button = item.querySelector('.rm-crawl-text-btn');
	const panel = item.querySelector('.rm-crawl-text-panel');
	const panelId = `rm-url-crawl-text-${++rmUrlCrawlItemCounter}`;

	item.dataset.pageId = page.id || '';
	link.href = /^https?:\/\//i.test(page.url || '') ? page.url : '#';
	title.textContent = page.title || page.url || 'Untitled page';
	url.textContent = page.url || '';
	panel.id = panelId;
	button.setAttribute('aria-controls', panelId);
	button.addEventListener('click', () => rmToggleUrlCrawlText(item, page));
	return item;
}

function rmSetUrlPagesState({ visible, metaText, pages = [], append = false, showLoadMore = false, loadingMore = false }) {
	const wrap = document.getElementById('rm-url-crawl-wrap');
	const meta = document.getElementById('rm-url-crawl-meta');
	const list = document.getElementById('rm-url-crawl-list');
	const loadMoreBtn = document.getElementById('rm-url-crawl-load-more-btn');
	if (!list || !loadMoreBtn) return;

	if (wrap) wrap.classList.toggle('d-none', !visible);
	if (meta) meta.textContent = metaText || '';
	if (!append) list.innerHTML = '';

	for (const page of pages) {
		const item = rmCreateUrlCrawlItem(page);
		if (item) list.appendChild(item);
	}

	loadMoreBtn.classList.toggle('d-none', !visible || !showLoadMore);
	loadMoreBtn.disabled = !!loadingMore;
	loadMoreBtn.textContent = loadingMore ? 'Loading...' : 'Load more';
	rmSetUrlPagesTabCount(rmUrlPagesTotal || 0);
	rmSetUrlCrawlActionState();
}

function rmSetUrlPagesTabVisibility(crawlEnabled = rmUrlCrawlEnabled) {
	const tabEl = document.getElementById('rm-url-tab-pages');
	if (!tabEl) return;

	tabEl.classList.toggle('d-none', !crawlEnabled);
	if (!crawlEnabled && tabEl.classList.contains('active')) {
		rmShowUrlDetails();
	}
}

function rmSetUrlPagesTabCount(count) {
	const countEl = document.getElementById('rm-url-tab-pages-count');
	rmSetUrlPagesTabVisibility();
	if (!countEl) {
		return;
	}
	countEl.textContent = String(Math.max(0, count || 0));
}

async function rmHandleUrlCrawlChange(event) {
	const input = event.target;
	const crawlEnabled = input.checked;
	const needsDisableConfirmation = !!rmCurrentId && rmUrlCrawlEnabled && !crawlEnabled && !rmUrlCrawlDisableConfirmed;

	if (needsDisableConfirmation) {
		const confirmed = await confirmAction('Stop Crawling?', 'This will stop crawling this URL and remove all indexed crawled pages when you save.');
		if (!confirmed) {
			input.checked = true;
			rmUrlCrawlEnabled = true;
			rmSetUrlPagesTabVisibility();
			rmSetUrlCrawlActionState();
			return;
		}
		rmUrlCrawlDisableConfirmed = true;
	}

	if (crawlEnabled) {
		rmUrlCrawlDisableConfirmed = false;
	}

	rmUrlCrawlEnabled = crawlEnabled;
	rmSetUrlPagesTabVisibility();
	rmSetUrlCrawlActionState();
}

function rmGetUrlPagesMetaText() {
	if (!rmUrlPagesTotal) {
		if (!rmUrlCrawlEnabled) {
			return 'No unique crawled pages indexed yet. Enable URL path crawling and save this URL to index pages under its path.';
		}
		return 'No unique crawled pages indexed yet. Crawling runs in the background after save, so new pages may appear shortly.';
	}
	if (rmUrlPagesLoaded < rmUrlPagesTotal) {
		return `Indexed unique pages: ${rmUrlPagesTotal}`;
	}
	return `Indexed unique pages: ${rmUrlPagesTotal}`;
}

async function rmLoadUrlPages(urlId, { append = false } = {}) {
	const requestSeq = ++rmUrlPagesRequestSeq;
	const nextPage = append ? (rmUrlPagesPage + 1) : 1;

	if (!append) {
		rmUrlPageTextRequestSeq++;
		rmUrlPageTextCache.clear();
		rmUrlCrawlItemCounter = 0;
		rmUrlPagesPage = 1;
		rmUrlPagesTotal = 0;
		rmUrlPagesLoaded = 0;
		rmSetUrlPagesState({ visible: true, metaText: 'Loading crawled pages...' });
	} else {
		rmSetUrlPagesState({
			visible: true,
			metaText: rmGetUrlPagesMetaText(),
			append: true,
			showLoadMore: rmUrlPagesLoaded < rmUrlPagesTotal,
			loadingMore: true,
		});
	}

	try {
		const res = await api('GET', `/urls/${urlId}/pages?limit=${rmUrlPagesPerPage}&page=${nextPage}`);
		if (requestSeq !== rmUrlPagesRequestSeq || rmCurrentType !== 'urls' || rmCurrentId !== urlId) return;

		const pages = res.pages || [];
		const count = typeof res.count === 'number' ? res.count : pages.length;
		if (!append) {
			rmUrlPagesTotal = count;
			rmUrlPagesLoaded = 0;
			rmUrlPagesPage = 0;
		}

		if (!pages.length && !append) {
			rmSetUrlPagesState({
				visible: true,
				metaText: count > 0 ? `Indexed unique pages: ${count}` : rmGetUrlPagesMetaText(),
				pages: [],
				showLoadMore: false,
			});
			return;
		}
		if (!pages.length && append) {
			rmSetUrlPagesState({
				visible: true,
				metaText: rmGetUrlPagesMetaText(),
				append: true,
				showLoadMore: false,
			});
			return;
		}

		rmUrlPagesPage = nextPage;
		rmUrlPagesLoaded += pages.length;

		rmSetUrlPagesState({
			visible: true,
			metaText: rmGetUrlPagesMetaText(),
			pages,
			append,
			showLoadMore: rmUrlPagesLoaded < rmUrlPagesTotal,
		});
	} catch {
		if (requestSeq !== rmUrlPagesRequestSeq || rmCurrentType !== 'urls' || rmCurrentId !== urlId) return;
		rmSetUrlPagesState({
			visible: true,
			metaText: append ? 'Could not load more crawled pages.' : 'Could not load crawled pages.',
			append: true,
			showLoadMore: append && rmUrlPagesLoaded < rmUrlPagesTotal,
		});
	}
}

function rmPopulate(type, record) {
	// Load links for any item type (manual links + tag connections)
	rmSelectedLinks = [];
	rmOriginalLinks = [];
	rmTagConnections = [];
	if (record._id) {
		api('GET', `/connections/${record._id}`).then(({ links, tag_connections }) => {
			// Manual links
			if (links?.length) {
				const ids = new Set();
				for (const l of links) {
					const otherId = l.source_id === record._id ? l.target_id : l.source_id;
					const otherType = l.source_id === record._id ? l.target_type : l.source_type;
					if (!ids.has(otherId)) {
						ids.add(otherId);
						rmSelectedLinks.push({ id: otherId, _type: otherType, title: '', link_id: l._id });
					}
				}
				// Resolve titles
				api('POST', '/resolve', { ids: [...ids] }).then(({ items }) => {
					for (const link of rmSelectedLinks) {
						const resolved = items.find(i => i.id === link.id);
						if (resolved) link.title = resolved.title;
					}
					rmOriginalLinks = rmSelectedLinks.map(l => ({ ...l }));
					rmRenderLinkTags();
				}).catch(() => {
					rmOriginalLinks = rmSelectedLinks.map(l => ({ ...l }));
					rmRenderLinkTags();
				});
			}
			// Tag-based connections
			rmTagConnections = tag_connections || [];
			rmRenderLinkTags();
		}).catch(() => {});
	}
	rmRenderLinkTags();

	if (type === 'notes') {
		const panel = document.getElementById('result-modal-note');
		panel.classList.remove('d-none');
		document.getElementById('rm-note-title').value = record.title || '';
		document.getElementById('rm-note-tags').value = (record.tags || []).join(', ');
		rmContent = record.content || '';
		rmTextContent = record.text_content || '';
		rmIsObsidianSynced = Boolean(record.obsidian_source?.file_id);
		rmObsidianConnectionId = record.obsidian_source?.connection_id || '';
		rmMarkdownContent = record.markdown_content || '';
		document.getElementById('rm-note-title').readOnly = rmIsObsidianSynced;
		document.getElementById('rm-note-tags').readOnly = rmIsObsidianSynced;
		document.getElementById('rm-note-markdown').value = rmMarkdownContent;
		rmShowNotePreview();
	} else if (type === 'memory') {
		const panel = document.getElementById('result-modal-memory');
		panel.classList.remove('d-none');
		document.getElementById('rm-memory-title').value = record.title || '';
		document.getElementById('rm-memory-tags').value = (record.tags || []).join(', ');
		document.getElementById('rm-memory-source').value = record.source || '';
		rmContent = record.content || '';
		rmTextContent = record.text_content || record.content || '';
		rmIsObsidianSynced = Boolean(record.obsidian_source?.file_id);
		rmObsidianConnectionId = record.obsidian_source?.connection_id || '';
		rmMarkdownContent = record.markdown_content || '';
		document.getElementById('rm-memory-title').readOnly = rmIsObsidianSynced;
		document.getElementById('rm-memory-tags').readOnly = rmIsObsidianSynced;
		document.getElementById('rm-memory-source').readOnly = rmIsObsidianSynced;
		document.getElementById('rm-memory-markdown').value = rmMarkdownContent;
		rmShowMemoryPreview();
	} else if (type === 'urls') {
		const panel = document.getElementById('result-modal-url');
		panel.classList.remove('d-none');
		rmShowUrlDetails();
		const urlInput = document.getElementById('rm-url-input');
		urlInput.value = record.url || '';
		urlInput.readOnly = !!rmCurrentId && !!record.url;
		rmSetUrlVisitLink(record.url);
		document.getElementById('rm-url-title').value = record.title || '';
		document.getElementById('rm-url-description').value = record.description || '';
		document.getElementById('rm-url-crawl').checked = !!record.crawl_enabled;
		rmUrlCrawlEnabled = !!record.crawl_enabled;
		rmUrlCrawlDisableConfirmed = false;
		rmSetUrlParsedText(record);
		rmSetUrlPagesTabVisibility();
		rmSetUrlCrawlActionState();

		const ogWrap = document.getElementById('rm-url-og-wrap');
		const ogImg = document.getElementById('rm-url-og-image');
		ogWrap.classList.add('d-none');
		const previewSrc = record.screenshot_url || record.og_image;
		if (previewSrc) {
			ogImg.src = previewSrc;
			ogWrap.classList.remove('d-none');
		}

		if (record._id) {
			rmLoadUrlPages(record._id);
		} else {
			rmSetUrlPagesState({ visible: false, metaText: '', pages: [] });
		}
	}
	rmApplyDemoReadOnly();
}

// ── Note preview/edit tabs ───────────────────────────────────────

function rmSanitizePreviewHtml(html) {
	const template = document.createElement('template');
	template.innerHTML = String(html || '');
	template.content.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((element) => element.remove());
	template.content.querySelectorAll('*').forEach((element) => {
		for (const attribute of [...element.attributes]) {
			const name = attribute.name.toLowerCase();
			const value = attribute.value.trim();
			if (name.startsWith('on') || name === 'style') element.removeAttribute(attribute.name);
			if ((name === 'href' || name === 'src') && !/^(?:https?:|mailto:|\/|#)/i.test(value)) element.removeAttribute(attribute.name);
		}
	});
	return template.innerHTML;
}

function rmRenderPreview(textContent, htmlContent) {
	if (!textContent && !htmlContent) return '<p class="text-muted">No content</p>';
	if (textContent && window.marked) return rmSanitizePreviewHtml(window.marked.parse(textContent));
	return rmSanitizePreviewHtml(htmlContent || `<pre>${escapeHtml(textContent)}</pre>`);
}

function rmCanonicalMarkdownBody() {
	if (!rmMarkdownContent.startsWith('---')) return rmMarkdownContent;
	return rmMarkdownContent.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

async function rmRenderObsidianPreview(element) {
	let markdown = rmCanonicalMarkdownBody();
	const references = [];
	for (const match of markdown.matchAll(/!?\[\[([^\]]+)\]\]/g)) references.push(match[1].split('|')[0].split('#')[0].trim());
	for (const match of markdown.matchAll(/!?\[[^\]]*\]\((?!https?:|data:|\/)([^)]+)\)/g)) references.push(match[1].split('#')[0].trim());
	if (rmObsidianConnectionId && references.length) {
		try {
			const result = await api('POST', `/obsidian/connections/${rmObsidianConnectionId}/resolve`, { paths: [...new Set(references)] });
			const resolved = new Map((result.files || []).map((file) => [file.input, file]));
			markdown = markdown.replace(/(!?)\[\[([^\]]+)\]\]/g, function (_match, embed, value) {
				const pieces = value.split('|');
				const target = pieces[0].split('#')[0].trim();
				const label = pieces[1] || target.split('/').pop();
				const file = resolved.get(target);
				if (!file) return _match;
				if (embed && String(file.mime_type || '').startsWith('image/')) return `![${label}](${file.download_url})`;
				const href = file.note_id ? `/notes?open=${file.note_id}` : file.memory_id ? `/memories?open=${file.memory_id}` : file.download_url;
				return `[${label}](${href})`;
			});
			markdown = markdown.replace(/(!?)\[([^\]]*)\]\((?!https?:|data:|\/)([^)]+)\)/g, function (_match, embed, label, targetValue) {
				const target = targetValue.split('#')[0].trim();
				const file = resolved.get(target);
				if (!file) return _match;
				return `${embed ? '!' : ''}[${label}](${file.download_url})`;
			});
		} catch {
			// Keep unresolved Obsidian syntax visible when link lookup is unavailable.
		}
	}
	element.innerHTML = rmRenderPreview(markdown, '');
}

function rmShowNotePreview() {
	if (rmIsObsidianSynced) rmMarkdownContent = document.getElementById('rm-note-markdown')?.value || '';
	document.getElementById('rm-note-tab-preview').classList.add('active');
	document.getElementById('rm-note-tab-edit').classList.remove('active');
	document.getElementById('rm-note-preview').classList.remove('d-none');
	document.getElementById('rm-note-editor').classList.add('d-none');
	document.getElementById('rm-note-markdown-wrap').classList.add('d-none');
	const preview = document.getElementById('rm-note-preview');
	if (rmIsObsidianSynced) void rmRenderObsidianPreview(preview);
	else preview.innerHTML = rmRenderPreview(rmTextContent, rmContent);
}

function rmShowNoteEdit() {
	document.getElementById('rm-note-tab-preview').classList.remove('active');
	document.getElementById('rm-note-tab-edit').classList.add('active');
	document.getElementById('rm-note-preview').classList.add('d-none');
	document.getElementById('rm-note-editor').classList.toggle('d-none', rmIsObsidianSynced);
	document.getElementById('rm-note-markdown-wrap').classList.toggle('d-none', !rmIsObsidianSynced);
	if (!rmIsObsidianSynced && !rmEditor) rmInitEditor('rm-note-editor', rmContent);
}

function rmShowMemoryPreview() {
	if (rmIsObsidianSynced) rmMarkdownContent = document.getElementById('rm-memory-markdown')?.value || '';
	document.getElementById('rm-memory-tab-preview').classList.add('active');
	document.getElementById('rm-memory-tab-edit').classList.remove('active');
	document.getElementById('rm-memory-preview').classList.remove('d-none');
	document.getElementById('rm-memory-editor').classList.add('d-none');
	document.getElementById('rm-memory-markdown-wrap').classList.add('d-none');
	const preview = document.getElementById('rm-memory-preview');
	if (rmIsObsidianSynced) void rmRenderObsidianPreview(preview);
	else preview.innerHTML = rmRenderPreview(rmTextContent, rmContent);
}

function rmShowMemoryEdit() {
	document.getElementById('rm-memory-tab-preview').classList.remove('active');
	document.getElementById('rm-memory-tab-edit').classList.add('active');
	document.getElementById('rm-memory-preview').classList.add('d-none');
	document.getElementById('rm-memory-editor').classList.toggle('d-none', rmIsObsidianSynced);
	document.getElementById('rm-memory-markdown-wrap').classList.toggle('d-none', !rmIsObsidianSynced);
	if (!rmIsObsidianSynced && !rmEditor) rmInitEditor('rm-memory-editor', rmContent);
}

function rmShowUrlPane(activePane) {
	for (const pane of ['details', 'text', 'pages']) {
		document.getElementById(`rm-url-tab-${pane}`)?.classList.toggle('active', pane === activePane);
		document.getElementById(`rm-url-pane-${pane}`)?.classList.toggle('d-none', pane !== activePane);
	}
}

function rmShowUrlDetails() {
	rmShowUrlPane('details');
}

function rmShowUrlText() {
	rmShowUrlPane('text');
}

function rmShowUrlPages() {
	rmShowUrlPane('pages');
}

function rmSetUrlCrawlActionState() {
	const resyncBtn = document.getElementById('rm-url-resync-btn');
	const deleteBtn = document.getElementById('rm-url-delete-pages-btn');
	const canManage = rmCurrentType === 'urls' && !!rmCurrentId;
	if (resyncBtn) resyncBtn.disabled = !canManage || !rmUrlCrawlEnabled;
	if (deleteBtn) deleteBtn.disabled = !canManage || rmUrlPagesTotal <= 0;
}

function rmSetUrlVisitLink(url) {
	const visitLink = document.getElementById('rm-url-visit-link');
	if (!visitLink) return;

	const href = (url || '').trim();
	if (/^https?:\/\//i.test(href)) {
		visitLink.href = href;
		visitLink.classList.remove('d-none');
		return;
	}

	visitLink.href = '#';
	visitLink.classList.add('d-none');
}

function rmInitEditor(containerId, content) {
	const container = document.getElementById(containerId);
	container.innerHTML = '';
	if (rmEditor) { rmEditor.destroy(); rmEditor = null; }
	if (window.StreamientEditor) {
		rmEditor = window.StreamientEditor.createEditor(container, { content });
	} else {
		container.innerHTML = content || '';
		container.setAttribute('contenteditable', 'true');
	}
}

function rmGetEditorContent() {
	if (rmIsObsidianSynced) {
		const id = rmCurrentType === 'notes' ? 'rm-note-markdown' : 'rm-memory-markdown';
		return { markdown_content: document.getElementById(id)?.value || '' };
	}
	if (rmEditor) return { content: rmEditor.getHTML(), text_content: rmEditor.getText() };
	return { content: rmContent, text_content: rmTextContent };
}

// ── Link search (all item types) ─────────────────────────────────

const rmTypeIcons = { notes: 'description', memory: 'lightbulb', urls: 'link', emails: 'email' };
const rmTypeLabels = { notes: 'Note', memory: 'Memory', urls: 'URL', emails: 'Email' };

function rmGetActiveLinkContainer() {
	const panels = ['result-modal-note', 'result-modal-memory', 'result-modal-url'];
	for (const id of panels) {
		const panel = document.getElementById(id);
		if (panel && !panel.classList.contains('d-none')) {
			return {
				search: panel.querySelector('.rm-link-search'),
				tags: panel.querySelector('.rm-link-tags'),
				searchWrap: panel.querySelector('.source-search-wrap'),
				wrap: panel.querySelector('.rm-link-search')?.closest('.position-relative'),
			};
		}
	}
	return {};
}

function rmEnsureRelDropdown() {
	if (rmRelDropdown) return rmRelDropdown;
	const { searchWrap } = rmGetActiveLinkContainer();
	if (!searchWrap) return null;
	searchWrap.style.position = 'relative';
	rmRelDropdown = document.createElement('div');
	rmRelDropdown.className = 'source-dropdown list-group position-absolute w-100 rm-link-search-dropdown';
	searchWrap.appendChild(rmRelDropdown);
	return rmRelDropdown;
}

function rmHideRelDropdown() {
	if (rmRelDropdown) rmRelDropdown.style.display = 'none';
	rmRelHighlightIdx = -1;
}

function rmRenderLinkTags() {
	// Render into whichever panel is visible
	const containers = document.querySelectorAll('.rm-link-tags');
	for (const container of containers) {
		let html = rmSelectedLinks.map((r, i) => `
			<span class="badge text-bg-secondary tag-badge rounded-pill d-inline-flex align-items-center gap-1 me-1 mb-1">
				${kkIcon(rmTypeIcons[r._type] || 'link')}
				${escapeHtml(r.title || r.url || r.id)}
				<button type="button" class="btn-close btn-close-white ms-1" style="font-size:0.5rem" data-index="${i}"></button>
			</span>
		`).join('');
		if (rmTagConnections.length) {
			html += '<div class="w-100 mt-2 mb-1"><small class="text-muted">' + kkIcon('tag', 'me-1') + 'Connected via shared tags</small></div>';
			html += rmTagConnections.map(c => `
				<span class="badge text-bg-light border tag-badge rounded-pill d-inline-flex align-items-center gap-1 me-1 mb-1 rm-tag-connection" role="button" data-type="${c.type}" data-id="${c.id}" title="Shared tags: ${escapeHtml(c.shared_tags?.join(', ') || '')}">
					${kkIcon(rmTypeIcons[c.type] || 'link', 'text-muted')}
					<span class="text-muted">${escapeHtml(c.title || c.id)}</span>
					${kkIcon('tag', 'text-success rm-shared-tag-icon')}
				</span>
			`).join('');
		}
		container.innerHTML = html;
		container.querySelectorAll('.btn-close').forEach(btn => {
			btn.addEventListener('click', () => {
				rmSelectedLinks.splice(parseInt(btn.dataset.index), 1);
				rmRenderLinkTags();
			});
		});
		container.querySelectorAll('.rm-tag-connection').forEach(el => {
			el.addEventListener('click', () => {
				window.openItemModal(el.dataset.type, el.dataset.id);
			});
		});
	}
}

function rmFormatLinkSearchTimestamp(result) {
	const timestamp = Number(result.updated_at || result.created_at);
	if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
	return window.StreamientDateFormat?.formatLocale(timestamp * 1000, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) || '';
}

function rmCreateLinkSearchResult(result) {
	const template = document.getElementById('rm-link-result-template');
	if (!template?.content?.firstElementChild) return null;
	const button = template.content.firstElementChild.cloneNode(true);
	const title = result.title || result.subject || result.url || result.id;
	const iconName = rmTypeIcons[result._type] || 'link';
	const glyph = window.StreamientIcons?.glyphs?.[iconName] || iconName;
	const timestamp = Number(result.updated_at || result.created_at);
	const formattedTimestamp = rmFormatLinkSearchTimestamp(result);

	button.dataset.id = result.id;
	button.dataset.type = result._type;
	button.dataset.title = title;
	button.querySelector('.rm-link-result-icon').classList.add(`ti-${glyph}`);
	button.querySelector('.rm-link-result-type').textContent = rmTypeLabels[result._type] || result._type;
	button.querySelector('.rm-link-result-title').textContent = title;
	button.querySelector('.rm-link-result-project').textContent = result.project_name || 'Deleted project';

	const updatedEl = button.querySelector('.rm-link-result-updated');
	const separatorEl = button.querySelector('.rm-link-result-separator');
	if (formattedTimestamp) {
		updatedEl.dateTime = new Date(timestamp * 1000).toISOString();
		updatedEl.textContent = `Updated ${formattedTimestamp}`;
	} else {
		separatorEl.remove();
		updatedEl.remove();
	}
	return button;
}

async function rmSearchLinks(query) {
	if (!query || query.length < 3) { rmHideRelDropdown(); return; }
	const { results } = await api('POST', '/search/all', { query });
	const currentId = rmCurrentId;
	const filtered = (results || []).filter(r => r.id !== currentId && !rmSelectedLinks.some(s => s.id === r.id));
	const dd = rmEnsureRelDropdown();
	if (!dd || !filtered.length) { rmHideRelDropdown(); return; }

	const resultElements = filtered.map(rmCreateLinkSearchResult).filter(Boolean);
	if (!resultElements.length) { rmHideRelDropdown(); return; }
	dd.replaceChildren(...resultElements);
	dd.style.display = 'block';

	rmRelHighlightIdx = -1;
	dd.querySelectorAll('button').forEach(btn => {
		btn.addEventListener('mousedown', (e) => {
			e.preventDefault();
			rmSelectDropdownItem(btn);
		});
	});
}

function rmSelectDropdownItem(btn) {
	rmSelectedLinks.push({ id: btn.dataset.id, _type: btn.dataset.type, title: btn.dataset.title });
	rmRenderLinkTags();
	const { search } = rmGetActiveLinkContainer();
	if (search) search.value = '';
	rmHideRelDropdown();
}

function rmHighlightDropdownItem(idx) {
	if (!rmRelDropdown) return;
	const items = rmRelDropdown.querySelectorAll('button');
	items.forEach((el, i) => el.classList.toggle('active', i === idx));
	if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
}

async function rmSyncLinks(itemId, itemType) {
	const typeMap = { notes: 'notes', memory: 'memory', urls: 'urls', emails: 'emails' };
	const currentType = typeMap[itemType] || itemType;

	// Find removed links (were in original but not in current)
	const removedLinks = rmOriginalLinks.filter(o => !rmSelectedLinks.some(s => s.id === o.id));
	// Find added links (in current but not in original)
	const addedLinks = rmSelectedLinks.filter(s => !rmOriginalLinks.some(o => o.id === s.id));

	const promises = [];

	// Delete removed links
	for (const link of removedLinks) {
		if (link.link_id) {
			promises.push(api('DELETE', `/links/${link.link_id}`).catch(() => {}));
		}
	}

	// Create new links
	for (const link of addedLinks) {
		promises.push(api('POST', '/links', {
			source_id: itemId,
			source_type: currentType,
			target_id: link.id,
			target_type: link._type,
		}).catch(() => {}));
	}

	if (promises.length) await Promise.all(promises);
}

// ── Cleanup ──────────────────────────────────────────────────────

function rmCleanup() {
	rmUrlPagesRequestSeq++;
	rmUrlPageTextRequestSeq++;
	rmUrlPagesPage = 1;
	rmUrlPagesTotal = 0;
	rmUrlPagesLoaded = 0;
	rmUrlCrawlEnabled = false;
	rmUrlCrawlDisableConfirmed = false;
	rmUrlPageTextCache.clear();
	rmUrlCrawlItemCounter = 0;
	rmSetUrlPagesTabVisibility(false);
	rmSetUrlPagesState({ visible: false, metaText: '', pages: [] });
	rmSetUrlCrawlActionState();
	rmResetEmailView();
	if (rmEditor) { rmEditor.destroy(); rmEditor = null; }
	rmCurrentId = null;
	rmCurrentType = null;
	rmSetUrlParsedText({});
	rmContent = '';
	rmTextContent = '';
	rmMarkdownContent = '';
	rmIsObsidianSynced = false;
	rmObsidianConnectionId = '';
	rmSelectedLinks = [];
	rmOriginalLinks = [];
	rmTagConnections = [];
	rmRenderLinkTags();
	if (rmRelDropdown) { rmRelDropdown.remove(); rmRelDropdown = null; }
	// Reset loading + form panels so modal is clean for next open
	const loadingEl = document.getElementById('result-modal-loading');
	if (loadingEl) {
		loadingEl.classList.add('d-none');
		loadingEl.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Loading...';
	}
	document.getElementById('result-modal-note')?.classList.add('d-none');
	document.getElementById('result-modal-memory')?.classList.add('d-none');
	document.getElementById('result-modal-url')?.classList.add('d-none');
	document.getElementById('result-modal-email')?.classList.add('d-none');
	document.getElementById('rm-note-markdown-wrap')?.classList.add('d-none');
	document.getElementById('rm-memory-markdown-wrap')?.classList.add('d-none');
	for (const id of ['rm-note-title', 'rm-note-tags', 'rm-memory-title', 'rm-memory-tags', 'rm-memory-source']) {
		const element = document.getElementById(id);
		if (element && !rmIsDemoReadOnly()) element.readOnly = false;
	}
	rmSetUrlVisitLink('');
	rmShowUrlDetails();
}

// ── Save & Delete handlers ───────────────────────────────────────

function initResultModalHandlers() {
	const modalEl = document.getElementById('chat-result-modal');
	if (!modalEl) return;

	// Tab clicks
	document.getElementById('rm-note-tab-preview')?.addEventListener('click', rmShowNotePreview);
	document.getElementById('rm-note-tab-edit')?.addEventListener('click', rmShowNoteEdit);
	document.getElementById('rm-memory-tab-preview')?.addEventListener('click', rmShowMemoryPreview);
	document.getElementById('rm-memory-tab-edit')?.addEventListener('click', rmShowMemoryEdit);
	document.getElementById('rm-url-tab-details')?.addEventListener('click', rmShowUrlDetails);
	document.getElementById('rm-url-tab-text')?.addEventListener('click', rmShowUrlText);
	document.getElementById('rm-url-tab-pages')?.addEventListener('click', rmShowUrlPages);
	document.getElementById('rm-url-crawl')?.addEventListener('change', rmHandleUrlCrawlChange);
	document.getElementById('rm-url-input')?.addEventListener('input', (e) => rmSetUrlVisitLink(e.target.value));
	document.getElementById('rm-email-tab-details')?.addEventListener('click', rmShowEmailDetails);
	document.getElementById('rm-email-tab-body')?.addEventListener('click', rmShowEmailBody);
	document.getElementById('rm-email-html-btn')?.addEventListener('click', () => rmSetEmailBodyMode('html'));
	document.getElementById('rm-email-text-btn')?.addEventListener('click', () => rmSetEmailBodyMode('text'));
	document.getElementById('rm-email-dark-btn')?.addEventListener('click', () => rmSetEmailThemeMode('dark'));
	document.getElementById('rm-email-original-btn')?.addEventListener('click', () => rmSetEmailThemeMode('original'));
	document.getElementById('rm-email-load-images-btn')?.addEventListener('click', () => {
		rmEmailRemoteImagesLoaded = true;
		rmRenderEmailBody();
	});
	document.getElementById('rm-url-crawl-load-more-btn')?.addEventListener('click', () => {
		if (rmCurrentType !== 'urls' || !rmCurrentId) return;
		rmLoadUrlPages(rmCurrentId, { append: true });
	});
	document.getElementById('rm-url-resync-btn')?.addEventListener('click', async () => {
		if (rmCurrentType !== 'urls' || !rmCurrentId || !rmUrlCrawlEnabled) return;
		try {
			await api('POST', `/urls/${rmCurrentId}/resync`);
			showSuccess('URL resync started');
		} catch (err) {
			showError('Resync failed: ' + (err.message || 'Unknown error'));
		}
	});
	document.getElementById('rm-url-delete-pages-btn')?.addEventListener('click', async () => {
		if (rmCurrentType !== 'urls' || !rmCurrentId) return;
		const confirmed = await confirmAction('Delete Crawled Pages', 'This will remove indexed crawled pages for this URL.');
		if (!confirmed) return;
		try {
			const res = await api('DELETE', `/urls/${rmCurrentId}/pages`);
			showSuccess(res?.message || 'Crawled pages deleted');
			rmLoadUrlPages(rmCurrentId);
		} catch (err) {
			showError('Delete failed: ' + (err.message || 'Unknown error'));
		}
	});
	// Link search (all item types)
	document.querySelectorAll('.rm-link-search').forEach(input => {
		input.addEventListener('input', () => {
			clearTimeout(rmRelDebounce);
			rmRelDebounce = setTimeout(() => rmSearchLinks(input.value.trim()), 150);
		});
		input.addEventListener('blur', () => setTimeout(rmHideRelDropdown, 150));
		input.addEventListener('keydown', (e) => {
			if (!rmRelDropdown || rmRelDropdown.style.display === 'none') return;
			const items = rmRelDropdown.querySelectorAll('button');
			if (!items.length) return;
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				rmRelHighlightIdx = Math.min(rmRelHighlightIdx + 1, items.length - 1);
				rmHighlightDropdownItem(rmRelHighlightIdx);
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				rmRelHighlightIdx = Math.max(rmRelHighlightIdx - 1, 0);
				rmHighlightDropdownItem(rmRelHighlightIdx);
			} else if (e.key === 'Enter') {
				e.preventDefault();
				if (rmRelHighlightIdx >= 0 && items[rmRelHighlightIdx]) {
					rmSelectDropdownItem(items[rmRelHighlightIdx]);
				}
			} else if (e.key === 'Escape') {
				rmHideRelDropdown();
			}
		});
	});

	// Save (create or update)
	document.getElementById('rm-save-btn')?.addEventListener('click', async () => {
		if (!rmCurrentType) return;

		try {
			const isCreate = !rmCurrentId;
			let savedUrl = null;

			if (rmCurrentType === 'notes') {
				const title = document.getElementById('rm-note-title').value.trim() || 'Untitled';
				const editorContent = rmGetEditorContent();
				const tags = document.getElementById('rm-note-tags').value.split(',').map((t) => t.trim()).filter(Boolean);
				const data = rmIsObsidianSynced ? { markdown_content: editorContent.markdown_content } : { title, content: editorContent.content, text_content: editorContent.text_content, tags, project: window.currentProjectId };
				if (isCreate) {
					const { note } = await api('POST', '/notes', data);
					rmCurrentId = note._id;
				} else {
					await api('PUT', `/notes/${rmCurrentId}`, data);
				}
				await rmSyncLinks(rmCurrentId, 'notes');
			} else if (rmCurrentType === 'memory') {
				const title = document.getElementById('rm-memory-title').value.trim();
				if (!title) return showError('Title is required');
				const editorContent = rmGetEditorContent();
				const tags = document.getElementById('rm-memory-tags').value.split(',').map((t) => t.trim()).filter(Boolean);
				const source = document.getElementById('rm-memory-source').value.trim();
				const data = rmIsObsidianSynced ? { markdown_content: editorContent.markdown_content } : { title, content: editorContent.content, text_content: editorContent.text_content, tags, source, project: window.currentProjectId };
				if (isCreate) {
					const { memory } = await api('POST', '/memories', data);
					rmCurrentId = memory._id;
				} else {
					await api('PUT', `/memories/${rmCurrentId}`, data);
				}
				await rmSyncLinks(rmCurrentId, 'memory');
			} else if (rmCurrentType === 'urls') {
				const url = document.getElementById('rm-url-input').value.trim();
				if (!url) return showError('URL is required');
				const title = document.getElementById('rm-url-title').value.trim();
				const description = document.getElementById('rm-url-description').value.trim();
				const crawl_enabled = document.getElementById('rm-url-crawl').checked;
				const data = { url, title, description, crawl_enabled, project: window.currentProjectId };
				if (isCreate) {
					const resp = await api('POST', '/urls', data);
					rmCurrentId = resp.url._id;
					savedUrl = resp.url;
				} else {
					const resp = await api('PUT', `/urls/${rmCurrentId}`, data);
					savedUrl = resp.url;
				}
				await rmSyncLinks(rmCurrentId, 'urls');
			}

			showSuccess(isCreate ? 'Created' : 'Saved');
			const savedDetail = { type: rmCurrentType, id: rmCurrentId, ...(savedUrl ? { url: savedUrl } : {}) };
			BsModal.getInstance(modalEl)?.hide();
			window.dispatchEvent(new CustomEvent('item-modal-saved', { detail: savedDetail }));
		} catch (err) {
			showError('Save failed: ' + (err.message || 'Unknown error'));
		}
	});

	// Delete
	document.getElementById('rm-delete-btn')?.addEventListener('click', async () => {
		if (!rmCurrentId || !rmCurrentType) return;

		try {
			const typeEndpoints = { notes: 'notes', memory: 'memories', urls: 'urls' };
			const endpoint = typeEndpoints[rmCurrentType];
			if (endpoint) await api('DELETE', `/${endpoint}/${rmCurrentId}`);
			showSuccess('Moved to trash');
			const deletedDetail = { type: rmCurrentType, id: rmCurrentId };
			BsModal.getInstance(modalEl)?.hide();
			window.dispatchEvent(new CustomEvent('item-modal-deleted', { detail: deletedDetail }));
		} catch (err) {
			showError('Delete failed: ' + (err.message || 'Unknown error'));
		}
	});

	// Cleanup on modal close
	modalEl.addEventListener('hidden.bs.modal', () => {
		rmCleanup();
		rmCleanupModalBackdrops();
	});
}

// Expose globally so page scripts can use it
window.openItemModal = openItemModal;
window.openResultModal = openResultModal;
window.initResultModalHandlers = initResultModalHandlers;
window.dismissChatResults = dismissChatResults;

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str;
	return div.innerHTML;
}

function typeBadgeClass(type) {
	switch (type) {
		case 'notes': return 'st-result-type-notes';
		case 'memory': return 'st-result-type-memory';
		case 'urls': return 'st-result-type-urls';
		case 'emails': return 'st-result-type-emails';
		case 'pages': return 'st-result-type-pages';
		default: return 'st-result-type-default';
	}
}
