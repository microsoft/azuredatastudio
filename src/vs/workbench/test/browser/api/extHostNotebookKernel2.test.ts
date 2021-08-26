/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { TestRPCProtocol } from 'vs/workbench/test/browser/api/testRPCProtocol';
import { ExtHostNotebookController } from 'vs/workbench/api/common/extHostNotebook';
import { nullExtensionDescription } from 'vs/workbench/services/extensions/common/extensions';
import { mock } from 'vs/workbench/test/common/workbenchTestServices';
import { INotebookKernelDto2, MainContext, MainThreadCommandsShape, MainThreadNotebookDocumentsShape, MainThreadNotebookKernelsShape, MainThreadNotebookShape } from 'vs/workbench/api/common/extHost.protocol';
import { ExtHostNotebookKernels } from 'vs/workbench/api/common/extHostNotebookKernels';
import { ExtensionIdentifier } from 'vs/platform/extensions/common/extensions';
import { IExtHostInitDataService } from 'vs/workbench/api/common/extHostInitDataService';
import { NullLogService } from 'vs/platform/log/common/log';
import { ExtHostDocumentsAndEditors } from 'vs/workbench/api/common/extHostDocumentsAndEditors';
import { ExtHostDocuments } from 'vs/workbench/api/common/extHostDocuments';
import { ExtHostNotebookDocument } from 'vs/workbench/api/common/extHostNotebookDocument';
import { IExtensionStoragePaths } from 'vs/workbench/api/common/extHostStoragePaths';
import { URI } from 'vs/base/common/uri';
import { generateUuid } from 'vs/base/common/uuid';
import { ExtHostCommands } from 'vs/workbench/api/common/extHostCommands';
import { CellKind, CellUri, NotebookCellsChangeType } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { ExtHostNotebookDocuments } from 'vs/workbench/api/common/extHostNotebookDocuments';

suite('NotebookKernel', function () {

	let rpcProtocol: TestRPCProtocol;
	let extHostNotebookKernels: ExtHostNotebookKernels;
	let notebook: ExtHostNotebookDocument;
	let extHostDocumentsAndEditors: ExtHostDocumentsAndEditors;
	let extHostDocuments: ExtHostDocuments;
	let extHostNotebooks: ExtHostNotebookController;
	let extHostNotebookDocuments: ExtHostNotebookDocuments;

	const notebookUri = URI.parse('test:///notebook.file');
	const kernelData = new Map<number, INotebookKernelDto2>();
	const disposables = new DisposableStore();

	teardown(function () {
		disposables.clear();
	});
	setup(async function () {

		kernelData.clear();

		rpcProtocol = new TestRPCProtocol();
		rpcProtocol.set(MainContext.MainThreadCommands, new class extends mock<MainThreadCommandsShape>() {
			override $registerCommand() { }
		});
		rpcProtocol.set(MainContext.MainThreadNotebookKernels, new class extends mock<MainThreadNotebookKernelsShape>() {
			override async $addKernel(handle: number, data: INotebookKernelDto2): Promise<void> {
				kernelData.set(handle, data);
			}
			override $removeKernel(handle: number) {
				kernelData.delete(handle);
			}
			override $updateKernel(handle: number, data: Partial<INotebookKernelDto2>) {
				assert.strictEqual(kernelData.has(handle), true);
				kernelData.set(handle, { ...kernelData.get(handle)!, ...data, });
			}
		});
		rpcProtocol.set(MainContext.MainThreadNotebookDocuments, new class extends mock<MainThreadNotebookDocumentsShape>() {
			override async $applyEdits() { }
		});
		rpcProtocol.set(MainContext.MainThreadNotebook, new class extends mock<MainThreadNotebookShape>() {
			override async $registerNotebookProvider() { }
			override async $unregisterNotebookProvider() { }
		});
		extHostDocumentsAndEditors = new ExtHostDocumentsAndEditors(rpcProtocol, new NullLogService());
		extHostDocuments = new ExtHostDocuments(rpcProtocol, extHostDocumentsAndEditors);
		const extHostStoragePaths = new class extends mock<IExtensionStoragePaths>() {
			override workspaceValue() {
				return URI.from({ scheme: 'test', path: generateUuid() });
			}
		};
		extHostNotebooks = new ExtHostNotebookController(rpcProtocol, new ExtHostCommands(rpcProtocol, new NullLogService()), extHostDocumentsAndEditors, extHostDocuments, extHostStoragePaths);

		extHostNotebookDocuments = new ExtHostNotebookDocuments(new NullLogService(), extHostNotebooks);

		extHostNotebooks.$acceptDocumentAndEditorsDelta({
			addedDocuments: [{
				uri: notebookUri,
				viewType: 'test',
				versionId: 0,
				cells: [{
					handle: 0,
					uri: CellUri.generate(notebookUri, 0),
					source: ['### Heading'],
					eol: '\n',
					language: 'markdown',
					cellKind: CellKind.Markup,
					outputs: [],
				}, {
					handle: 1,
					uri: CellUri.generate(notebookUri, 1),
					source: ['console.log("aaa")', 'console.log("bbb")'],
					eol: '\n',
					language: 'javascript',
					cellKind: CellKind.Code,
					outputs: [],
				}],
			}],
			addedEditors: [{
				documentUri: notebookUri,
				id: '_notebook_editor_0',
				selections: [{ start: 0, end: 1 }],
				visibleRanges: []
			}]
		});
		extHostNotebooks.$acceptDocumentAndEditorsDelta({ newActiveEditor: '_notebook_editor_0' });

		notebook = extHostNotebooks.notebookDocuments[0]!;

		disposables.add(notebook);
		disposables.add(extHostDocuments);


		extHostNotebookKernels = new ExtHostNotebookKernels(
			rpcProtocol,
			new class extends mock<IExtHostInitDataService>() { },
			extHostNotebooks,
			new NullLogService()
		);
	});

	test('create/dispose kernel', async function () {

		const kernel = extHostNotebookKernels.createNotebookController(nullExtensionDescription, 'foo', '*', 'Foo');

		assert.throws(() => (<any>kernel).id = 'dd');
		assert.throws(() => (<any>kernel).notebookType = 'dd');

		assert.ok(kernel);
		assert.strictEqual(kernel.id, 'foo');
		assert.strictEqual(kernel.label, 'Foo');
		assert.strictEqual(kernel.notebookType, '*');

		await rpcProtocol.sync();
		assert.strictEqual(kernelData.size, 1);

		let [first] = kernelData.values();
		assert.strictEqual(first.id, 'nullExtensionDescription/foo');
		assert.strictEqual(ExtensionIdentifier.equals(first.extensionId, nullExtensionDescription.identifier), true);
		assert.strictEqual(first.label, 'Foo');
		assert.strictEqual(first.notebookType, '*');

		kernel.dispose();
		await rpcProtocol.sync();
		assert.strictEqual(kernelData.size, 0);
	});

	test('update kernel', async function () {

		const kernel = extHostNotebookKernels.createNotebookController(nullExtensionDescription, 'foo', '*', 'Foo');

		await rpcProtocol.sync();
		assert.ok(kernel);

		let [first] = kernelData.values();
		assert.strictEqual(first.id, 'nullExtensionDescription/foo');
		assert.strictEqual(first.label, 'Foo');

		kernel.label = 'Far';
		assert.strictEqual(kernel.label, 'Far');

		await rpcProtocol.sync();
		[first] = kernelData.values();
		assert.strictEqual(first.id, 'nullExtensionDescription/foo');
		assert.strictEqual(first.label, 'Far');
	});

	test('execute - simple createNotebookCellExecution', function () {
		const kernel = extHostNotebookKernels.createNotebookController(nullExtensionDescription, 'foo', '*', 'Foo');

		extHostNotebookKernels.$acceptNotebookAssociation(0, notebook.uri, true);

		const cell1 = notebook.apiNotebook.cellAt(0);
		const task = kernel.createNotebookCellExecution(cell1);
		task.start();
		task.end(undefined);
	});

	test('createNotebookCellExecution, must be selected/associated', function () {
		const kernel = extHostNotebookKernels.createNotebookController(nullExtensionDescription, 'foo', '*', 'Foo');
		assert.throws(() => {
			kernel.createNotebookCellExecution(notebook.apiNotebook.cellAt(0));
		});

		extHostNotebookKernels.$acceptNotebookAssociation(0, notebook.uri, true);
		kernel.createNotebookCellExecution(notebook.apiNotebook.cellAt(0));
	});

	test('createNotebookCellExecution, cell must be alive', function () {
		const kernel = extHostNotebookKernels.createNotebookController(nullExtensionDescription, 'foo', '*', 'Foo');

		const cell1 = notebook.apiNotebook.cellAt(0);

		extHostNotebookKernels.$acceptNotebookAssociation(0, notebook.uri, true);
		extHostNotebookDocuments.$acceptModelChanged(notebook.uri, {
			versionId: 12,
			rawEvents: [{
				kind: NotebookCellsChangeType.ModelChange,
				changes: [[0, notebook.apiNotebook.cellCount, []]]
			}]
		}, true);

		assert.strictEqual(cell1.index, -1);

		assert.throws(() => {
			kernel.createNotebookCellExecution(cell1);
		});
	});

	test('interrupt handler, cancellation', async function () {

		let interruptCallCount = 0;
		let tokenCancelCount = 0;

		const kernel = extHostNotebookKernels.createNotebookController(nullExtensionDescription, 'foo', '*', 'Foo');
		kernel.interruptHandler = () => { interruptCallCount += 1; };
		extHostNotebookKernels.$acceptNotebookAssociation(0, notebook.uri, true);

		const cell1 = notebook.apiNotebook.cellAt(0);

		const task = kernel.createNotebookCellExecution(cell1);
		task.token.onCancellationRequested(() => tokenCancelCount += 1);

		await extHostNotebookKernels.$cancelCells(0, notebook.uri, [0]);
		assert.strictEqual(interruptCallCount, 1);
		assert.strictEqual(tokenCancelCount, 0);

		await extHostNotebookKernels.$cancelCells(0, notebook.uri, [0]);
		assert.strictEqual(interruptCallCount, 2);
		assert.strictEqual(tokenCancelCount, 0);
	});
});
