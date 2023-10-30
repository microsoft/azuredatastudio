/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { convertSize, convertSizeToNumber, validateCalcExpression } from 'sql/base/browser/dom';

suite('DOM Tests', () => {

	test('Convert size should add px', () => {
		const expected = '100px';
		const actual = convertSize(100);
		assert.strictEqual(expected, actual);
	});

	test('Convert size should not add px if it already has it', () => {
		const expected = '100px';
		const actual = convertSize('100px');
		assert.strictEqual(expected, actual);
	});

	test('Convert size should not add px if it is a percent value', () => {
		const expected = '100%';
		const actual = convertSize('100%');
		assert.strictEqual(expected, actual);
	});

	test('Convert size should return the default value given undefined value', () => {
		const expected = '200';
		const actual = convertSize(undefined, '200');
		assert.strictEqual(expected, actual);
	});

	test('Convert to number should return size without px', () => {
		const expected = 200;
		const actual = convertSizeToNumber('200px');
		assert.strictEqual(expected, actual);
	});

	test('Convert to number should return same value if already plain text number', () => {
		const expected = 200;
		const actual = convertSizeToNumber('200');
		assert.strictEqual(expected, actual);
	});

	test('Convert to number should return same value if already plain number', () => {
		const expected = 200;
		const actual = convertSizeToNumber(200);
		assert.strictEqual(expected, actual);
	});

	test('Convert to number should return 0 given undefined', () => {
		const expected = 0;
		const actual = convertSizeToNumber(undefined);
		assert.strictEqual(expected, actual);
	});

	test('Validating different calc expressions', () => {
		const calcExpressionsTestInputs = [
			{ input: 'calc(10px+10px)', expected: false },
			{ input: 'calc(76.8px--50%)', expected: false },
			{ input: 'calc(10px +10px)', expected: false },
			{ input: 'calc(10px- -50%)', expected: false },
			{ input: 'calc(10vmin + 10px)', expected: true },
			{ input: 'calc(10% - -50.7%)', expected: true },
			{ input: 'calc(103px - -50%)', expected: true },
			{ input: 'calc(10px +10px)', expected: false },
			{ input: 'calc(10px --50%)', expected: false },
			{ input: 'calc(10vmin + 10px )', expected: true },
			{ input: 'calc( 10% - -50.7%)', expected: true },
			{ input: 'calc( 103px - -50%)', expected: true },
			{ input: 'calc( 10%  - -50.7%)', expected: true },
			{ input: 'calc( 10% --50.7% )', expected: false },
			{ input: 'calc( 10.89% - -50.7% )', expected: true },
			{ input: 'calc( 103px  - -50%)', expected: true },
			{ input: 'calc', expected: false },
			{ input: 'calc(sdfs   - sdf)', expected: false },
			{ input: 'calc(15sdfs   - 456svbdf)', expected: false },
			{ input: 'calc( bpx45 - 45px)', expected: false },
			{ input: 'calc( 34px - 45g)', expected: false }
		];

		calcExpressionsTestInputs.forEach((run) => {
			assert.strictEqual(run.expected, validateCalcExpression(run.input), `error validating calc expression: ${run.input}`);
		});
	});
});
