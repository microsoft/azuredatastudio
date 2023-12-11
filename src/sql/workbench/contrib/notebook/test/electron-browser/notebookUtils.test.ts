/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';

import { nb } from 'azdata';
import { isStream, getProvidersForFileName, asyncForEach, getStandardKernelsForProvider, IStandardKernelWithProvider } from 'sql/workbench/services/notebook/browser/models/notebookUtils';
import { INotebookService, DEFAULT_NOTEBOOK_PROVIDER, SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookServiceStub } from 'sql/workbench/contrib/notebook/test/browser/stubs';
import { tryMatchCellMagic, extractCellMagicCommandPlusArgs } from 'sql/workbench/services/notebook/browser/utils';
import { RichTextEditStack } from 'sql/workbench/contrib/notebook/browser/cellViews/textCell.component';
import { notebookConstants } from 'sql/workbench/services/notebook/browser/interfaces';
import { DEFAULT_NOTEBOOK_FILETYPE } from 'sql/workbench/common/constants';

suite('notebookUtils', function (): void {
	const mockNotebookService = TypeMoq.Mock.ofType<INotebookService>(NotebookServiceStub);
	const defaultTestProvider = 'testDefaultProvider';
	const testProvider = 'testProvider';
	const testKernel: nb.IStandardKernel = {
		name: 'testName',
		displayName: 'testDisplayName',
		connectionProviderIds: ['testId1', 'testId2'],
		supportedLanguages: ['python']
	};
	const sqlStandardKernel: nb.IStandardKernel = {
		name: notebookConstants.SQL,
		displayName: notebookConstants.SQL,
		connectionProviderIds: [notebookConstants.SQL_CONNECTION_PROVIDER],
		supportedLanguages: ['sql']
	};

	function setupMockNotebookService() {
		mockNotebookService.setup(n => n.getProvidersForFileType(TypeMoq.It.isAnyString()))
			.returns((fileName, service) => {
				if (fileName === DEFAULT_NOTEBOOK_FILETYPE) {
					return [defaultTestProvider];
				} else {
					return [testProvider];
				}
			});

		// getStandardKernelsForProvider
		let returnHandler = (provider) => {
			let result = undefined;
			if (provider === testProvider) {
				result = [testKernel];
			} else if (provider === SQL_NOTEBOOK_PROVIDER) {
				result = [sqlStandardKernel];
			}
			return Promise.resolve(result);
		};
		mockNotebookService.setup(n => n.getStandardKernelsForProvider(TypeMoq.It.isAnyString())).returns(returnHandler);
		mockNotebookService.setup(n => n.getStandardKernelsForProvider(TypeMoq.It.isAnyString())).returns(returnHandler);
	}

	test('isStream Test', async function (): Promise<void> {
		let result = isStream(<nb.ICellOutput>{
			output_type: 'stream'
		});
		assert.strictEqual(result, true);

		result = isStream(<nb.ICellOutput>{
			output_type: 'display_data'
		});
		assert.strictEqual(result, false);

		result = isStream(<nb.ICellOutput>{
			output_type: undefined
		});
		assert.strictEqual(result, false);
	});

	test('getProvidersForFileName Test', async function (): Promise<void> {
		setupMockNotebookService();

		let result = getProvidersForFileName('', mockNotebookService.object);
		assert.deepStrictEqual(result, [defaultTestProvider]);

		result = getProvidersForFileName('fileWithoutExtension', mockNotebookService.object);
		assert.deepStrictEqual(result, [defaultTestProvider]);

		result = getProvidersForFileName('test.sql', mockNotebookService.object);
		assert.deepStrictEqual(result, [testProvider]);

		mockNotebookService.setup(n => n.getProvidersForFileType(TypeMoq.It.isAnyString()))
			.returns(() => undefined);
		result = getProvidersForFileName('test.sql', mockNotebookService.object);
		assert.deepStrictEqual(result, [DEFAULT_NOTEBOOK_PROVIDER]);
	});

	test('getStandardKernelsForProvider Test', async function (): Promise<void> {
		setupMockNotebookService();

		let result = await getStandardKernelsForProvider(undefined, undefined);
		assert.deepStrictEqual(result, []);

		result = await getStandardKernelsForProvider(undefined, mockNotebookService.object);
		assert.deepStrictEqual(result, []);

		result = await getStandardKernelsForProvider('testProvider', undefined);
		assert.deepStrictEqual(result, []);

		result = await getStandardKernelsForProvider('NotARealProvider', mockNotebookService.object);
		assert.deepStrictEqual(result, [Object.assign({ notebookProvider: 'NotARealProvider' }, sqlStandardKernel)]);

		result = await getStandardKernelsForProvider('testProvider', mockNotebookService.object);
		assert.deepStrictEqual(result, [<IStandardKernelWithProvider>{
			name: 'testName',
			displayName: 'testDisplayName',
			connectionProviderIds: ['testId1', 'testId2'],
			notebookProvider: 'testProvider',
			supportedLanguages: ['python']
		}]);
	});

	test('tryMatchCellMagic Test', async function (): Promise<void> {
		let result = tryMatchCellMagic(undefined);
		assert.strictEqual(result, undefined);

		result = tryMatchCellMagic('    ');
		assert.strictEqual(result, null);

		result = tryMatchCellMagic('text');
		assert.strictEqual(result, null);

		result = tryMatchCellMagic('%%sql');
		assert.strictEqual(result, 'sql');

		result = tryMatchCellMagic('%%sql\nselect @@VERSION\nselect * from TestTable');
		assert.strictEqual(result, 'sql');

		result = tryMatchCellMagic('%%sql\n%%help');
		assert.strictEqual(result, 'sql');

		result = tryMatchCellMagic('%%');
		assert.strictEqual(result, null);

		result = tryMatchCellMagic('%% sql');
		assert.strictEqual(result, null);
	});

	test('extractCellMagicCommandPlusArgs Test', async function (): Promise<void> {
		let result = extractCellMagicCommandPlusArgs(undefined, undefined);
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs('test', undefined);
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs(undefined, 'test');
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs('%%magic', 'magic');
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs('%%magic ', 'magic');
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs('magic', 'magic');
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs('magic ', 'magic');
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs('%%magic command', 'otherMagic');
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs('%%magiccommand', 'magic');
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs('%%magic command', 'magic');
		assert.strictEqual(result.commandId, 'command');
		assert.strictEqual(result.args, '');

		result = extractCellMagicCommandPlusArgs('%%magic command arg1', 'magic');
		assert.strictEqual(result.commandId, 'command');
		assert.strictEqual(result.args, 'arg1');

		result = extractCellMagicCommandPlusArgs('%%magic command arg1 arg2', 'magic');
		assert.strictEqual(result.commandId, 'command');
		assert.strictEqual(result.args, 'arg1 arg2');

		result = extractCellMagicCommandPlusArgs('%%magic command.id arg1 arg2 arg3', 'magic');
		assert.strictEqual(result.commandId, 'command.id');
		assert.strictEqual(result.args, 'arg1 arg2 arg3');
	});

	test('asyncForEach Test', async function (): Promise<void> {
		let totalResult = 0;
		await asyncForEach([1, 2, 3, 4], async (value) => {
			totalResult += value;
		});
		assert.strictEqual(totalResult, 10);

		totalResult = 0;
		await asyncForEach([], async (value) => {
			totalResult += value;
		});
		assert.strictEqual(totalResult, 0);

		// Shouldn't throw exceptions for these cases
		await asyncForEach(undefined, async (value) => {
			totalResult += value;
		});
		assert.strictEqual(totalResult, 0);

		await asyncForEach([1, 2, 3, 4], undefined);
	});

	test('EditStack test', async function (): Promise<void> {
		let maxStackSize = 200;
		let stack = new RichTextEditStack(maxStackSize);
		assert.strictEqual(stack.count, 0);

		stack.push('1');
		stack.push('2');
		stack.push('3');
		assert.strictEqual(stack.count, 3);

		assert.strictEqual(stack.peek(), '3');

		let topElement = stack.pop();
		assert.strictEqual(topElement, '3');

		topElement = stack.pop();
		assert.strictEqual(topElement, '2');

		stack.push('4');
		assert.strictEqual(stack.count, 2);
		topElement = stack.pop();
		assert.strictEqual(topElement, '4');

		stack.clear();
		assert.strictEqual(stack.count, 0);
		topElement = stack.pop();
		assert.strictEqual(topElement, undefined);
		assert.strictEqual(stack.peek(), undefined);

		// Check max stack size
		stack.clear();
		for (let i = 0; i < maxStackSize; i++) {
			stack.push('a');
		}
		stack.push('b');
		assert.strictEqual(stack.count, maxStackSize);
		assert.strictEqual(stack.peek(), 'b');

		// update max stack size and add new element
		maxStackSize = 20;
		stack.maxStackSize = maxStackSize;
		stack.push('c');
		assert.strictEqual(stack.count, maxStackSize);
		assert.strictEqual(stack.peek(), 'c');
	});
});
