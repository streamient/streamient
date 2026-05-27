import assert from 'node:assert/strict';
import test from 'node:test';

import {
	colorLuminance,
	colorSaturation,
	parseCssColor,
	shouldDarkenBackground,
	shouldLightenText,
	shouldMuteBorder,
	shouldPreserveColor,
} from '../src/email_dark_mode_rules.js';

test('parses common email color formats', () => {
	assert.deepEqual(parseCssColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
	assert.deepEqual(parseCssColor('#000000'), { r: 0, g: 0, b: 0, a: 1 });
	assert.deepEqual(parseCssColor('rgb(255, 255, 255)'), { r: 255, g: 255, b: 255, a: 1 });
	assert.deepEqual(parseCssColor('rgba(0, 0, 0, 0.5)'), { r: 0, g: 0, b: 0, a: 0.5 });
});

test('detects light neutral backgrounds for dark rendering', () => {
	assert.equal(shouldDarkenBackground('#ffffff'), true);
	assert.equal(shouldDarkenBackground('rgb(245, 247, 250)'), true);
	assert.equal(shouldDarkenBackground('#f6f9fc'), true);
	assert.equal(shouldDarkenBackground('#635bff'), false);
	assert.equal(shouldDarkenBackground('transparent'), false);
});

test('detects dark neutral text without changing brand colors', () => {
	assert.equal(shouldLightenText('#000000'), true);
	assert.equal(shouldLightenText('rgb(33, 37, 41)'), true);
	assert.equal(shouldLightenText('#635bff'), false);
	assert.equal(shouldPreserveColor('#635bff'), true);
});

test('mutes very light or dark neutral borders', () => {
	assert.equal(shouldMuteBorder('#eeeeee'), true);
	assert.equal(shouldMuteBorder('#111111'), true);
	assert.equal(shouldMuteBorder('#4aa3df'), false);
});

test('computes luminance and saturation in expected ranges', () => {
	assert.equal(colorLuminance(parseCssColor('#ffffff')) > colorLuminance(parseCssColor('#000000')), true);
	assert.equal(colorSaturation(parseCssColor('#635bff')) > colorSaturation(parseCssColor('#eeeeee')), true);
});
