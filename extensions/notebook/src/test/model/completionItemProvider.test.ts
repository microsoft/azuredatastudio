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
import { ApiWrapper } from '../../common/apiWrapper';
import { JupyterNotebookManager } from '../../jupyter/jupyterNotebookManager';
import { JupyterSessionManager, JupyterSession } from '../../jupyter/jupyterSessionManager';
import { LocalJupyterServerManager } from '../../jupyter/jupyterServerManager';

describe('Completion Item Provider', function () {
	let completionItemProvider: NotebookCompletionItemProvider;
	let notebookProviderMock: TypeMoq.IMock<JupyterNotebookProvider>;
	let notebookUtils: NotebookUtils;
	let notebookManager: JupyterNotebookManager;
	let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
	let mockSessionManager: TypeMoq.IMock<JupyterSessionManager>;
	let mockServerManager: TypeMoq.IMock<LocalJupyterServerManager>;
	let mockJupyterSession: TypeMoq.IMock<JupyterSession>;
	let mockKernel: TypeMoq.IMock<azdata.nb.IKernel>;

	this.beforeAll(async () => {
		mockKernel = TypeMoq.Mock.ofType<azdata.nb.IKernel>();
		mockJupyterSession = TypeMoq.Mock.ofType<JupyterSession>();
		mockApiWrapper = TypeMoq.Mock.ofType<ApiWrapper>();
		notebookUtils = new NotebookUtils(new ApiWrapper());
		mockSessionManager = TypeMoq.Mock.ofType<JupyterSessionManager>();
		mockServerManager = TypeMoq.Mock.ofType<LocalJupyterServerManager>();
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
		notebookManager = new JupyterNotebookManager(mockServerManager.object, mockSessionManager.object, mockApiWrapper.object);
	});

	this.beforeEach(() => {
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

	it('should not provide items when session does not exist in notebook provider', async() => {
		mockSessionManager.setup(m => m.listRunning()).returns(() => [mockJupyterSession.object]);

		await notebookUtils.newNotebook();
		await notebookUtils.addCell('code');
		should(azdata.nb.notebookDocuments.length).not.equal(0, 'Notebook documents length is 0');
		should(vscode.workspace.textDocuments.length).not.equal(0, 'Text documents length is 0');
		let document = vscode.workspace.textDocuments.find(d => d.uri.path === azdata.nb.notebookDocuments[0].cells[0].uri.path)
		should(document).not.equal(undefined, 'Could not find text document that matched cell uri path');

		let completionItems = await completionItemProvider.provideCompletionItems(document, undefined, undefined, undefined);
		should(completionItems).deepEqual([]);
	});

	it('should not provide items when kernel does not exist in notebook provider', async() => {
		mockSessionManager.setup(m => m.listRunning()).returns(() => [mockJupyterSession.object]);

		await notebookUtils.newNotebook();
		await notebookUtils.addCell('code');
		should(azdata.nb.notebookDocuments.length).not.equal(0, 'Notebook documents length is 0');
		should(vscode.workspace.textDocuments.length).not.equal(0, 'Text documents length is 0');
		let document = vscode.workspace.textDocuments.find(d => d.uri.path === azdata.nb.notebookDocuments[0].cells[0].uri.path)
		should(document).not.equal(undefined, 'Could not find text document that matched cell uri path');

		mockJupyterSession.setup(s => s.path).returns(() => azdata.nb.notebookDocuments[0].uri.path);

		let completionItems = await completionItemProvider.provideCompletionItems(document, undefined, undefined, undefined);
		should(completionItems).deepEqual([]);
	});

	it('should not provide items when kernel exists but is not ready in notebook provider', async() => {
		mockSessionManager.setup(m => m.listRunning()).returns(() => [mockJupyterSession.object]);

		await notebookUtils.newNotebook();
		await notebookUtils.addCell('code');
		should(azdata.nb.notebookDocuments.length).not.equal(0, 'Notebook documents length is 0');
		should(vscode.workspace.textDocuments.length).not.equal(0, 'Text documents length is 0');
		let document = vscode.workspace.textDocuments.find(d => d.uri.path === azdata.nb.notebookDocuments[0].cells[0].uri.path)
		should(document).not.equal(undefined, 'Could not find text document that matched cell uri path');

		mockJupyterSession.setup(s => s.path).returns(() => azdata.nb.notebookDocuments[0].uri.path);

		let completionItems = await completionItemProvider.provideCompletionItems(document, undefined, undefined, undefined);
		should(completionItems).deepEqual([]);
	});

	it('should not provide items when kernel exists but is not ready in notebook provider', async() => {
		mockSessionManager.setup(m => m.listRunning()).returns(() => [mockJupyterSession.object]);

		await notebookUtils.newNotebook();
		await notebookUtils.addCell('code');
		should(azdata.nb.notebookDocuments.length).not.equal(0, 'Notebook documents length is 0');
		should(vscode.workspace.textDocuments.length).not.equal(0, 'Text documents length is 0');
		let document = vscode.workspace.textDocuments.find(d => d.uri.path === azdata.nb.notebookDocuments[0].cells[0].uri.path)
		should(document).not.equal(undefined, 'Could not find text document that matched cell uri path');

		mockJupyterSession.setup(s => s.path).returns(() => azdata.nb.notebookDocuments[0].uri.path);
		let readyPromise = Promise.resolve();
		mockKernel.setup(s => s.ready).returns(() => readyPromise);
		mockKernel.setup(k => k.isReady).returns(() => true);
		mockKernel.setup(k => k.supportsIntellisense).returns(() => true);
		mockJupyterSession.setup(s => s.kernel).returns(() => mockKernel.object);

		let completionItems = await completionItemProvider.provideCompletionItems(document, undefined, undefined, undefined);
		should(completionItems).deepEqual([]);
	});





	it('resolveCompletionItems returns items back', async() => {
		let sampleItem: vscode.CompletionItem = {
			label: 'item label'
		};
		let item = await completionItemProvider.resolveCompletionItem(sampleItem, undefined);
		should(item).deepEqual(sampleItem);

		item = await completionItemProvider.resolveCompletionItem(undefined, undefined);
		should(item).deepEqual(undefined);
	});
});
