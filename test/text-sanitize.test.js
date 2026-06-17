import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeDeep, sanitizeText } from '../modules/text_sanitize.js';

function hasLoneSurrogate(value) {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code >= 0xD800 && code <= 0xDBFF) {
			const nextCode = value.charCodeAt(i + 1);
			if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
				i++;
				continue;
			}
			return true;
		}
		if (code >= 0xDC00 && code <= 0xDFFF) return true;
	}
	return false;
}

describe('text sanitizer', () => {
	it('removes lone surrogates and preserves valid surrogate pairs', () => {
		const validPair = '\uD835\uDC00';
		const sanitized = sanitizeText(`Hello \uD835 paid link \uDC00 ${validPair}`);

		assert.equal(sanitized, `Hello  paid link  ${validPair}`);
		assert.equal(hasLoneSurrogate(sanitized), false);
	});

	it('sanitizes nested strings before JSON import/export paths', () => {
		const value = sanitizeDeep({
			text_content: 'Bad high \uD835',
			items: ['Bad low \uDC00', { body: 'Safe \uD835\uDC00' }],
		});

		assert.equal(value.text_content, 'Bad high ');
		assert.equal(value.items[0], 'Bad low ');
		assert.equal(value.items[1].body, 'Safe \uD835\uDC00');
		assert.equal(hasLoneSurrogate(JSON.stringify(value)), false);
	});
});
