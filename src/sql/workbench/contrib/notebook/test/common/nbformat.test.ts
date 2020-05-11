/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nbformat } from 'sql/workbench/services/notebook/common/nbformat';
import * as assert from 'assert';

suite('nbformat', function (): void {
	let sampleOutput: nbformat.IOutput = {
		data: undefined,
		ename: '',
		evalue: undefined,
		execution_count: 0,
		name: undefined,
		output_type: 'display_data'
	};
	test('Validate display_data Output Type', async function (): Promise<void> {
		sampleOutput.output_type = 'display_data';
		assert.equal(nbformat.isDisplayData(sampleOutput), true, 'display_data output type not recognized correctly');
		assert.equal(nbformat.isDisplayUpdate(sampleOutput), false, 'update_display_data output type incorrectly recognized');
		assert.equal(nbformat.isError(sampleOutput), false, 'error output type incorrectly recognized');
		assert.equal(nbformat.isExecuteResult(sampleOutput), false, 'execute_result output type incorrectly recognized');
		assert.equal(nbformat.isStream(sampleOutput), false, 'stream output type incorrectly recognized');
	});
	test('Validate update_display_data Output Type', async function (): Promise<void> {
		sampleOutput.output_type = 'update_display_data';
		assert.equal(nbformat.isDisplayData(sampleOutput), false, 'display_data output type incorrectly recognized');
		assert.equal(nbformat.isDisplayUpdate(sampleOutput), true, 'update_display_data output type not recognized correctly');
		assert.equal(nbformat.isError(sampleOutput), false, 'error output type incorrectly recognized');
		assert.equal(nbformat.isExecuteResult(sampleOutput), false, 'execute_result output type incorrectly recognized');
		assert.equal(nbformat.isStream(sampleOutput), false, 'stream output type incorrectly recognized');
	});
	test('Validate error Output Type', async function (): Promise<void> {
		sampleOutput.output_type = 'error';
		assert.equal(nbformat.isDisplayData(sampleOutput), false, 'display_data output type incorrectly recognized');
		assert.equal(nbformat.isDisplayUpdate(sampleOutput), false, 'update_display_data output type incorrectly recognized');
		assert.equal(nbformat.isError(sampleOutput), true, 'error output type not recognized correctly');
		assert.equal(nbformat.isExecuteResult(sampleOutput), false, 'execute_result output type incorrectly recognized');
		assert.equal(nbformat.isStream(sampleOutput), false, 'stream output type incorrectly recognized');
	});
	test('Validate execute_result Output Type', async function (): Promise<void> {
		sampleOutput.output_type = 'execute_result';
		assert.equal(nbformat.isDisplayData(sampleOutput), false, 'display_data output type incorrectly recognized');
		assert.equal(nbformat.isDisplayUpdate(sampleOutput), false, 'update_display_data output type incorrectly recognized');
		assert.equal(nbformat.isError(sampleOutput), false, 'error output type incorrectly recognized');
		assert.equal(nbformat.isExecuteResult(sampleOutput), true, 'execute_result output type not recognized correctly');
		assert.equal(nbformat.isStream(sampleOutput), false, 'stream output type incorrectly recognized');
	});
	test('Validate stream Output Type', async function (): Promise<void> {
		sampleOutput.output_type = 'stream';
		assert.equal(nbformat.isDisplayData(sampleOutput), false, 'display_data output type incorrectly recognized');
		assert.equal(nbformat.isDisplayUpdate(sampleOutput), false, 'update_display_data output type incorrectly recognized');
		assert.equal(nbformat.isError(sampleOutput), false, 'error output type incorrectly recognized');
		assert.equal(nbformat.isExecuteResult(sampleOutput), false, 'execute_result output type incorrectly recognized');
		assert.equal(nbformat.isStream(sampleOutput), true, 'stream output type not recognized correctly');
	});
});
