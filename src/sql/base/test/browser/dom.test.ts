/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { convertSize, convertSizeToNumber } from 'sql/base/browser/dom';

suite('DOM Tests', () => {

	test('Convert size should add px', () => {
		const expected = '100px';
		const actual = convertSize(100);
		assert.equal(expected, actual);
	});

	test('Convert size should not add px if it already has it', () => {
		const expected = '100px';
		const actual = convertSize('100px');
		assert.equal(expected, actual);
	});

	test('Convert size should not add px if it is a percent value', () => {
		const expected = '100%';
		const actual = convertSize('100%');
		assert.equal(expected, actual);
	});

	test('Convert size should return the default value given undefined value', () => {
		const expected = '200';
		const actual = convertSize(undefined, '200');
		assert.equal(expected, actual);
	});

	test('Convert to number should return size without px', () => {
		const expected = 200;
		const actual = convertSizeToNumber('200px');
		assert.equal(expected, actual);
	});

	test('Convert to number should return same value if already plain text number', () => {
		const expected = 200;
		const actual = convertSizeToNumber('200');
		assert.equal(expected, actual);
	});

	test('Convert to number should return same value if already plain number', () => {
		const expected = 200;
		const actual = convertSizeToNumber(200);
		assert.equal(expected, actual);
	});

	test('Convert to number should return 0 given undefined', () => {
		const expected = 0;
		const actual = convertSizeToNumber(undefined);
		assert.equal(expected, actual);
	});
});
