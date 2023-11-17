/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as azdata from 'azdata';
import * as nock from 'nock';
import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';
import uuid = require('uuid');


import * as loc from '../../common/localizedConstants';
import * as constants from '../../common/constants';

import { NotebookUriHandler } from '../../protocol/notebookUriHandler';
import { CellTypes } from '../../contracts/content';

describe('Notebook URI Handler', function (): void {
	let notebookUriHandler: NotebookUriHandler;
	let showErrorMessageSpy: sinon.SinonSpy;
	let executeCommandSpy: sinon.SinonSpy;
	let showNotebookDocumentStub: sinon.SinonStub;
	const notebookUri = vscode.Uri.parse('azuredatastudio://microsoft.notebook/open?url=https%3A%2F%2F127.0.0.1/Hello.ipynb');
	const notebookContent = 'test content';

	beforeEach(() => {
		showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');
		executeCommandSpy = sinon.spy(vscode.commands, 'executeCommand');
		notebookUriHandler = new NotebookUriHandler();
		showNotebookDocumentStub = sinon.stub(azdata.nb, 'showNotebookDocument');
	});

	afterEach(function (): void {
		sinon.restore();
		nock.cleanAll();
		nock.enableNetConnect();
	});

	it('should handle empty string gracefully', async function (): Promise<void> {
		await notebookUriHandler.handleUri(vscode.Uri.parse(''));
		sinon.assert.calledOnce(showErrorMessageSpy);
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

	it('should show error message when uri scheme is not https, http, or file', async function (): Promise<void> {
		await notebookUriHandler.handleUri(vscode.Uri.parse('azuredatastudio://microsoft.notebook/open?//url=aaa%3A%2F%2Fhello.ipynb'));
		sinon.assert.calledOnce(showErrorMessageSpy);
	});

	it('should show error when file is not found given file uri scheme https', async function (): Promise<void> {
		let showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves(Promise.resolve(loc.msgYes) as any);
		await notebookUriHandler.handleUri(notebookUri);

		sinon.assert.calledOnce(showQuickPickStub);
		sinon.assert.callCount(showErrorMessageSpy, 1);
	});

	it('should show error when file is not found given file uri scheme http', async function (): Promise<void> {
		let notebookUriHttp = vscode.Uri.parse('azuredatastudio://microsoft.notebook/open?url=http%3A%2F%2F127.0.0.1/Hello.ipynb');
		let showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves(Promise.resolve(loc.msgYes) as any);

		await notebookUriHandler.handleUri(notebookUriHttp);

		sinon.assert.calledOnce(showQuickPickStub);
		sinon.assert.callCount(showErrorMessageSpy, 1);

	});

	it('should open the notebook when https uri file is valid', async function (): Promise<void> {
		let showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves(Promise.resolve(loc.msgYes) as any);
		nock('https://127.0.0.1')
			.get(`/Hello.ipynb`)
			.reply(200, notebookContent);

		await notebookUriHandler.handleUri(notebookUri);

		sinon.assert.calledOnce(showQuickPickStub);
		sinon.assert.neverCalledWith(showErrorMessageSpy);
		sinon.assert.calledWith(showNotebookDocumentStub, sinon.match.any, sinon.match({ initialContent: notebookContent }));
	});

	it('should not download notebook when user declines prompt', async function (): Promise<void> {
		let showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves(Promise.resolve(loc.msgNo) as any);

		await notebookUriHandler.handleUri(notebookUri);

		sinon.assert.calledOnce(showQuickPickStub);
		sinon.assert.notCalled(showNotebookDocumentStub);
		sinon.assert.callCount(showErrorMessageSpy, 0);
	});

	[403, 404, 500].forEach(httpErrorCode => {
		it(`should reject when HTTP error ${httpErrorCode} occurs`, async function (): Promise<void> {
			sinon.stub(vscode.window, 'showQuickPick').returns(Promise.resolve(loc.msgYes) as any);
			nock('https://127.0.0.1')
				.get(`/Hello.ipynb`)
				.reply(httpErrorCode);

			await notebookUriHandler.handleUri(notebookUri);
			sinon.assert.callCount(showErrorMessageSpy, 1);
			sinon.assert.notCalled(showNotebookDocumentStub);
		});
	});

	it('should open notebook when file uri is valid', async function (): Promise<void> {
		let notebookDir: string = path.join(os.tmpdir(), `notebook_${uuid.v4()}`);
		let notebookPath: string = path.join(notebookDir, 'hello.ipynb');

		await fs.mkdir(notebookDir);
		let baseUrl = 'azuredatastudio://microsoft.notebook/open?url=file://';
		if (process.platform === constants.winPlatform) {
			// URI paths are formatted as "hostname/path", but since we're using a local path
			// we omit the host part and just add the slash. Unix paths already start with a
			// forward slash, but we have to prepend it manually when using Windows paths.
			baseUrl = baseUrl + '/';
		}
		let fileURI = baseUrl + notebookPath;
		let fileNotebookUri = vscode.Uri.parse(fileURI);
		let notebookContent: azdata.nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Code,
				source: ['x = 1 \ny = 2'],
				metadata: { language: 'python', tags: ['parameters'] },
				execution_count: 1
			}],
			metadata: {
				kernelspec: {
					name: 'python3',
					language: 'python',
					display_name: 'Python 3'
				}
			},
			nbformat: constants.NBFORMAT,
			nbformat_minor: constants.NBFORMAT_MINOR
		};

		await fs.writeFile(notebookPath, JSON.stringify(notebookContent));

		await notebookUriHandler.handleUri(fileNotebookUri);

		sinon.assert.calledWith(showNotebookDocumentStub, sinon.match.any, sinon.match({ initialContent: notebookContent }));
		sinon.assert.callCount(showErrorMessageSpy, 0);
	});
});
