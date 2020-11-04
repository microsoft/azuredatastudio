/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as should from 'should';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';

import { NotebookCompletionItemProvider } from '../../intellisense/completionItemProvider';
import { JupyterNotebookProvider } from '../../jupyter/jupyterNotebookProvider';
import { NotebookUtils } from '../../common/notebookUtils';
import { JupyterNotebookManager } from '../../jupyter/jupyterNotebookManager';
import { JupyterSessionManager, JupyterSession } from '../../jupyter/jupyterSessionManager';
import { LocalJupyterServerManager } from '../../jupyter/jupyterServerManager';
import { TestKernel } from '../common';
import { sleep } from '../common/testUtils';

describe('Completion Item Provider', function () {
	let completionItemProvider: NotebookCompletionItemProvider;
	let notebookProviderMock: TypeMoq.IMock<JupyterNotebookProvider>;
	let notebookUtils: NotebookUtils;
	let notebookManager: JupyterNotebookManager;
	let mockSessionManager: TypeMoq.IMock<JupyterSessionManager>;
	let mockServerManager: TypeMoq.IMock<LocalJupyterServerManager>;
	let mockJupyterSession: TypeMoq.IMock<JupyterSession>;
	let kernel: TestKernel;
	let testEvent: vscode.EventEmitter<unknown>;
	let token: vscode.CancellationToken;

	this.beforeAll(async () => {
		notebookUtils = new NotebookUtils();
		mockServerManager = TypeMoq.Mock.ofType<LocalJupyterServerManager>();
		testEvent = new vscode.EventEmitter();
		token = {
			isCancellationRequested: false,
			onCancellationRequested: testEvent.event
		};

		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	this.beforeEach(() => {
		mockSessionManager = TypeMoq.Mock.ofType<JupyterSessionManager>();
		mockJupyterSession = TypeMoq.Mock.ofType<JupyterSession>();
		kernel = new TestKernel(true, true);
		notebookManager = new JupyterNotebookManager(mockServerManager.object, mockSessionManager.object);
		notebookProviderMock = TypeMoq.Mock.ofType<JupyterNotebookProvider>();
		notebookProviderMock.setup(n => n.getNotebookManager(TypeMoq.It.isAny())).returns(() => Promise.resolve(notebookManager));
		completionItemProvider = new NotebookCompletionItemProvider(notebookProviderMock.object);
	});

	it('should not return items when undefined passed in for every parameter', async () => {
		let completionItems = await completionItemProvider.provideCompletionItems(undefined, undefined, undefined, undefined);
		should(completionItems).deepEqual([]);
	});

	it('should not return items when no notebook provider passed in', async () => {
		completionItemProvider = new NotebookCompletionItemProvider(undefined);
		let completionItems = await completionItemProvider.provideCompletionItems(undefined, undefined, undefined, undefined);
		should(completionItems).deepEqual([]);
	});

	it('should not provide items when session does not exist in notebook provider', async () => {
		let notebook = await notebookUtils.newNotebook();
		await notebookUtils.addCell('code');
		let document = await tryFindTextDocument(notebook);
		should(document).not.equal(undefined, 'Could not find text document that matched cell uri path');

		let completionItems = await completionItemProvider.provideCompletionItems(document, undefined, undefined, undefined);
		should(completionItems).deepEqual([]);
	});

	it('should not provide items when session list throws exception', async () => {
		mockSessionManager.setup(m => m.listRunning()).throws(new Error('Test Error'));

		let notebook = await notebookUtils.newNotebook();
		await notebookUtils.addCell('code');
		let document = await tryFindTextDocument(notebook);

		let completionItems = await completionItemProvider.provideCompletionItems(document, undefined, undefined, undefined);
		should(completionItems).deepEqual([]);
	});

	it('should not provide items when kernel does not exist in notebook provider', async () => {
		mockSessionManager.setup(m => m.listRunning()).returns(() => [mockJupyterSession.object]);

		let notebook = await notebookUtils.newNotebook();
		await notebookUtils.addCell('code');
		let document = await tryFindTextDocument(notebook);

		mockJupyterSession.setup(s => s.path).returns(() => document.uri.path);

		let completionItems = await completionItemProvider.provideCompletionItems(document, undefined, undefined, undefined);
		should(completionItems).deepEqual([]);
	});

	it('should not provide items when kernel exists but is not ready in notebook provider', async () => {
		kernel = new TestKernel();
		mockJupyterSession.setup(s => s.kernel).returns(() => kernel);
		mockSessionManager.setup(m => m.listRunning()).returns(() => [mockJupyterSession.object]);
		mockJupyterSession.setup(s => s.path).returns(() => notebook.document.uri.path);

		let notebook = await notebookUtils.newNotebook();
		await notebookUtils.addCell('code');
		let document = await tryFindTextDocument(notebook);

		mockJupyterSession.setup(s => s.path).returns(() => document.uri.path);

		let completionItems = await completionItemProvider.provideCompletionItems(document, undefined, undefined, undefined);
		should(completionItems).deepEqual([]);
	});

	it('should provide items source has unicode characters', async () => {
		let document = await setupSessionAndNotebookCells('🌉sample code\nline 2\n');

		let completionItems = await completionItemProvider.provideCompletionItems(document, new vscode.Position(2, 2), token, undefined);
		should(Array.isArray(completionItems));
		if (Array.isArray(completionItems)) {
			should(completionItems.length).equal(3);
		}
	});

	it('should provide items source has no unicode characters', async () => {
		let document = await setupSessionAndNotebookCells('sample code\nline 2\n');

		let completionItems = await completionItemProvider.provideCompletionItems(document, new vscode.Position(1, 1), token, undefined);
		should(Array.isArray(completionItems));
		if (Array.isArray(completionItems)) {
			should(completionItems.length).equal(3);
		}
	});

	it('should not provide items when no content exists in the first cell', async () => {
		let document = await setupSessionAndNotebookCells();

		let completionItems = await completionItemProvider.provideCompletionItems(document, new vscode.Position(1, 1), token, undefined);
		should(completionItems).deepEqual([]);
	});

	it('should not provide items when kernel returns error status', async () => {
		kernel = new TestKernel(true, true, [], 'error');
		mockJupyterSession.setup(s => s.path).returns(() => notebook.document.uri.path);
		mockJupyterSession.setup(s => s.kernel).returns(() => kernel);
		mockSessionManager.setup(m => m.listRunning()).returns(() => [mockJupyterSession.object]);

		let notebook = await notebookUtils.newNotebook();
		await notebook.edit((editBuilder: azdata.nb.NotebookEditorEdit) => {
			editBuilder.insertCell({
				cell_type: 'code',
				source: 'sample text'
			});
		});
		let document = await tryFindTextDocument(notebook);

		let completionItems = await completionItemProvider.provideCompletionItems(document, new vscode.Position(1, 1), token, undefined);
		should(completionItems).deepEqual([]);
	});

	it('resolveCompletionItems returns items back', async () => {
		let sampleItem: vscode.CompletionItem = {
			label: 'item label'
		};
		let item = await completionItemProvider.resolveCompletionItem(sampleItem, undefined);
		should(item).deepEqual(sampleItem);

		item = await completionItemProvider.resolveCompletionItem(undefined, undefined);
		should(item).deepEqual(undefined);

		item = await completionItemProvider.resolveCompletionItem(null, undefined);
		should(item).deepEqual(null);
	});

	/**
	 * Setup session manager mocks, and create code cell.
	 * Return a document representing the first cell's editor document
	 * @param source Cell source to insert; if empty, create new cell with no source edit
	 */
	async function setupSessionAndNotebookCells(source?: string): Promise<vscode.TextDocument> {
		mockJupyterSession.setup(s => s.path).returns(() => notebook.document.uri.path);
		mockJupyterSession.setup(s => s.kernel).returns(() => kernel);
		mockSessionManager.setup(m => m.listRunning()).returns(() => [mockJupyterSession.object]);

		let notebook = await notebookUtils.newNotebook();
		if (source) {
			await notebook.edit((editBuilder: azdata.nb.NotebookEditorEdit) => {
				editBuilder.insertCell({
					cell_type: 'code',
					source: source
				});
			});
		} else {
			await notebookUtils.addCell('code');
		}
		let document = await tryFindTextDocument(notebook);
		return document;
	}

	async function tryFindTextDocument(notebook: azdata.nb.NotebookEditor): Promise<vscode.TextDocument> {
		let document = vscode.workspace.textDocuments.find(d => d.uri.path === notebook.document.cells[0].uri.path);
		let triesRemaining = 10;
		while (!document && triesRemaining > 0) {
			await sleep(500);
			document = vscode.workspace.textDocuments.find(d => d.uri.path === notebook.document.cells[0].uri.path);
			triesRemaining--;
		}
		return document;
	}
});
