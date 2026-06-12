import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('settings search reindex UI source', () => {
	it('keeps progress copy out of the running button', () => {
		const source = fs.readFileSync(new URL('../public/js/settings_reindex.js', import.meta.url), 'utf8');

		assert.ok(source.includes("if (reindexBtnSpinner) reindexBtnSpinner.classList.add('d-none');"));
		assert.ok(source.includes("if (reindexBtnText) reindexBtnText.textContent = 'Reindex All My Data';"));
		assert.ok(!source.includes("reindexBtnText.textContent = running ? 'Reindexing...' : 'Reindex All My Data';"));
	});
});
