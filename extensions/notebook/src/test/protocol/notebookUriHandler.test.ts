/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as nock from 'nock';
import * as loc from '../../common/localizedConstants';
import * as constants from '../../common/constants';

import { NotebookUriHandler } from '../../protocol/notebookUriHandler';

describe('Notebook URI Handler', function (): void {
	let notebookUriHandler: NotebookUriHandler;
	let showErrorMessageSpy: sinon.SinonSpy;
	let executeCommandSpy: sinon.SinonSpy;

	beforeEach(() => {
		showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');
		executeCommandSpy = sinon.spy(vscode.commands, 'executeCommand');
		notebookUriHandler = new NotebookUriHandler();
	});

	afterEach(function (): void {
		sinon.restore();
		nock.cleanAll();
		nock.enableNetConnect();
	});

	it('should handle empty string gracefully', async function (): Promise<void> {
		await notebookUriHandler.handleUri(vscode.Uri.parse(''));
		sinon.assert.calledOnce(showErrorMessageSpy);
		const showNotebookDocumentStub = sinon.stub(azdata.nb, 'showNotebookDocument');

		sinon.assert.neverCalledWith(executeCommandSpy, constants.notebookCommandNew);
		sinon.assert.notCalled(showNotebookDocumentStub);
	});

	it('should create new notebook when new passed in', async function (): Promise<void> {
		await notebookUriHandler.handleUri(vscode.Uri.parse('azuredatastudio://microsoft.notebook/new'));
		sinon.assert.calledWith(executeCommandSpy, constants.notebookCommandNew);
	});

	it('should show error message when no query passed into open', async function (): Promise<void> {
		await notebookUriHandler.handleUri(vscode.Uri.parse('azuredatastudio://microsoft.notebook/open'));
		sinon.assert.calledOnce(showErrorMessageSpy);
	});

	it('should show error message when file uri scheme is not https or http', async function (): Promise<void> {
		await notebookUriHandler.handleUri(vscode.Uri.parse('azuredatastudio://microsoft.notebook/open?file://hello.ipynb'));
		sinon.assert.calledOnce(showErrorMessageSpy);
	});

	it('should open notebook when file uri scheme is https', async function (): Promise<void> {
		const notebookContent = 'test content';
		const showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick').returns(Promise.resolve(loc.msgYes) as any);
		const showNotebookDocumentStub = sinon.stub(azdata.nb, 'showNotebookDocument');
		nock('https://127.0.0.1')
			.get(`/Hello.ipynb`)
			.reply(200, notebookContent);
		await notebookUriHandler.handleUri(vscode.Uri.parse('azuredatastudio://microsoft.notebook/open?url=https%3A%2F%2F127.0.0.1/Hello.ipynb'));
		sinon.assert.callCount(showErrorMessageSpy, 0);
		sinon.assert.calledOnce(showQuickPickStub);
		sinon.assert.calledWith(showNotebookDocumentStub, sinon.match.any, sinon.match({ initialContent: notebookContent }));
	});

	it('should not download when user declines download', async function (): Promise<void> {
		const showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick').returns(Promise.resolve(loc.msgNo) as any);
		const showNotebookDocumentStub = sinon.stub(azdata.nb, 'showNotebookDocument');

		await notebookUriHandler.handleUri(vscode.Uri.parse('azuredatastudio://microsoft.notebook/open?url=https%3A%2F%2F127.0.0.1/Hello.ipynb'));

		sinon.assert.callCount(showErrorMessageSpy, 0);
		sinon.assert.calledOnce(showQuickPickStub);
		sinon.assert.notCalled(showNotebookDocumentStub);
	});

	[403, 404, 500].forEach(httpErrorCode => {
		it(`should reject when HTTP error ${httpErrorCode} occurs`, async function (): Promise<void> {
			sinon.stub(vscode.window, 'showQuickPick').returns(Promise.resolve(loc.msgYes) as any);
			const showNotebookDocumentStub = sinon.stub(azdata.nb, 'showNotebookDocument');
			nock('https://127.0.0.1')
				.get(`/Hello.ipynb`)
				.reply(httpErrorCode);

			await notebookUriHandler.handleUri(vscode.Uri.parse('azuredatastudio://microsoft.notebook/open?url=https%3A%2F%2F127.0.0.1/Hello.ipynb'));
			sinon.assert.callCount(showErrorMessageSpy, 1);
			sinon.assert.notCalled(showNotebookDocumentStub);
		});
	});
});
