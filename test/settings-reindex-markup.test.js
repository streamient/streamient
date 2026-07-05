import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import pug from 'pug';
import { fileURLToPath } from 'node:url';

function localPath(url) {
	return fileURLToPath(url);
}

describe('settings search reindex markup', () => {
	it('renders status controls and count rows', () => {
		const render = pug.compileFile(localPath(new URL('../views/ajax/section/settings/typesense.pug', import.meta.url)));
		const html = render({
			title: 'Typesense',
			v: 'test',
			can_manage_team: true,
			can_manage_restricted_settings: true,
			byo_ai_enabled: false,
			email_feature_enabled: true,
			is_hosted: false,
			icon(name, classes = '') {
				return `<span class="st-icon ${classes}">${name}</span>`;
			},
		});

		assert.match(html, /id="reindex-status-message"/);
		assert.match(html, /id="reindex-counts"/);
		assert.match(html, /data-index-count-total/);
		assert.match(html, /data-index-count-type="notes"/);
		assert.match(html, /data-index-count-type="memory"/);
		assert.match(html, /data-index-count-type="urls"/);
		assert.match(html, /data-index-count-type="emails"/);
		assert.match(html, /settings_reindex\.js/);
	});
});
