(function () {
	window.StreamientListItems = {
		create: function (options) {
			var records = new Map();
			var deleted = new Map();
			var requests = new Map();
			var active = true;
			var generation = 0;
			var list = options.list;
			var selector = '.' + options.type + '-item';
			function version(item) { return new Date(item?.updatedAt || 0).getTime() || 0; }
			function sortDate(item) { return new Date((options.type === 'memory' ? item?.git_commit?.committed_at || item?.updatedAt : item?.[options.sortField || 'updatedAt']) || 0).getTime() || 0; }
			function empty() {
				if (list.querySelector(selector)) list.querySelector('.' + options.type + '-empty')?.remove();
				else if (!list.querySelector('.' + options.type + '-empty')) list.appendChild(document.getElementById(options.endpoint + '-empty-template').content.cloneNode(true));
			}
			function apply(item) {
				if (!active || !item?._id) return;
				var id = String(item._id);
				var previous = records.get(id);
				if ((deleted.has(id) && version(item) <= deleted.get(id)) || (previous && version(previous) > version(item))) return;
				var existing = list.querySelector(selector + '[data-id="' + CSS.escape(id) + '"]');
				var projectId = String(item.project?._id || item.project || '');
				var root = document.getElementById('main-content');
				var scrollTop = root?.scrollTop;
				if (item.in_trash || (currentProjectId && projectId !== String(currentProjectId))) {
					records.set(id, item);
					existing?.remove();
				} else {
					if (!item.html) return;
					if (existing && previous?.html === item.html) { records.set(id, item); return; }
					var template = document.createElement('template');
					template.innerHTML = item.html;
					var row = template.content.firstElementChild;
					if (!row || row.dataset.id !== id) return;
					var focused = existing?.contains(document.activeElement) ? document.activeElement : null;
					row.querySelector('.batch-cb').checked = !!existing?.querySelector('.batch-cb')?.checked;
					options.bind(row);
					records.set(id, item);
					if (existing) existing.replaceWith(row);
					else {
						var date = sortDate(item);
						var next = Array.from(list.querySelectorAll(selector)).find(function (other) {
							var otherDate = sortDate(records.get(other.dataset.id));
							return otherDate < date || (otherDate === date && other.dataset.id < id);
						});
						list.insertBefore(row, next || null);
					}
					window.StreamientDateFormat?.refresh(row);
					if (focused) (focused.matches('.batch-cb') ? row.querySelector('.batch-cb') : focused.matches('.url-link') ? row.querySelector('.url-link') : row)?.focus({ preventScroll: true });
				}
				empty();
				if (root) root.scrollTop = scrollTop;
				window.updateBatchBar?.();
			}
			return {
				apply: apply,
				empty: empty,
				update: async function (event) {
					var nested = event.detail?.[options.type];
					var item = nested && typeof nested === 'object' ? nested : event.detail || {};
					var id = String(item._id || item.id || '');
					if (!active || !id || (deleted.has(id) && version(item) <= deleted.get(id))) return;
					if (item.html) return apply(item);
					var seq = generation;
					var request = (requests.get(id) || 0) + 1;
					requests.set(id, request);
					try {
						var data = await api('GET', '/' + options.endpoint + '/' + encodeURIComponent(id));
						if (active && seq === generation && request === requests.get(id)) apply(data[options.type]);
					} catch (err) { if (active && seq === generation && !deleted.has(id)) showError('Failed to update item: ' + (err.message || 'Unknown error')); }
				},
				remove: function (event) {
					var item = event.detail || {};
					var id = String(item._id || item.id || '');
					if (!active || !id || (records.has(id) && version(item) && version(item) < version(records.get(id)))) return;
					deleted.set(id, Math.max(deleted.get(id) || 0, version(item) || Infinity));
					requests.delete(id);
					records.delete(id);
					var root = document.getElementById('main-content');
					var scrollTop = root?.scrollTop;
					list.querySelector(selector + '[data-id="' + CSS.escape(id) + '"]')?.remove();
					empty();
					if (root) root.scrollTop = scrollTop;
					window.updateBatchBar?.();
				},
				reset: function () { generation++; records.clear(); deleted.clear(); requests.clear(); list.replaceChildren(); },
				destroy: function () { active = false; generation++; },
			};
		},
	};
})();
