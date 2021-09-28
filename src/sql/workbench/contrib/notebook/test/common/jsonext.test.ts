/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { isPrimitive } from 'sql/workbench/services/notebook/common/jsonext';

suite('jsonext', function (): void {
	test('Validate null object is primitive', async function (): Promise<void> {
		let object = null;
		assert.strictEqual(isPrimitive(object), true, 'null object should be primitive');
		object = undefined;
		assert.strictEqual(isPrimitive(object), false, 'undefined object should not be primitive');
	});
	test('Validate boolean types are primitive', async function (): Promise<void> {
		let object: boolean = false;
		assert.strictEqual(isPrimitive(object), true, 'false boolean object should be primitive');
		object = true;
		assert.strictEqual(isPrimitive(object), true, 'true boolean object should be primitive');
	});
	test('Validate number types are primitive', async function (): Promise<void> {
		let object: number = 0;
		assert.strictEqual(isPrimitive(object), true, 'number with value 0 should be primitive');
		object = 1;
		assert.strictEqual(isPrimitive(object), true, 'number with value 1 should be primitive');
	});
	test('Validate string types are primitive', async function (): Promise<void> {
		let object: string = '';
		assert.strictEqual(isPrimitive(object), true, 'empty strings should be primitive');
		object = 'nonempty string';
		assert.strictEqual(isPrimitive(object), true, 'non-empty strings should be primitive');
	});
	test('custom object is not primitive', async function (): Promise<void> {
		let object = {
			prop1: 'val1'
		};
		assert.strictEqual(isPrimitive(object), false, 'custom object should not be primitive');
		object = undefined;
		assert.strictEqual(isPrimitive(object), false, 'undefined object should not be primitive');
	});
});
