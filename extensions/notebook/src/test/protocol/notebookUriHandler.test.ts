/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

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

	afterEach(function(): void {
		sinon.restore();
	});

	it('should handle empty string null undefined gracefully', function (done): void {
		notebookUriHandler.handleUri(vscode.Uri.parse(''));
		sinon.assert.calledOnce(showErrorMessageSpy);

		notebookUriHandler.handleUri(null);
		sinon.assert.calledTwice(showErrorMessageSpy);

		notebookUriHandler.handleUri(undefined);
		sinon.assert.calledThrice(showErrorMessageSpy);

		sinon.assert.neverCalledWith(executeCommandSpy, 'notebook.command.new');
		done();
	});

	it('should create new notebook when new passed in', function (): void {
		notebookUriHandler.handleUri(vscode.Uri.parse('azuredatastudio://microsoft.notebook/new'));
		sinon.assert.calledOnce(executeCommandSpy);
	});

	it('should show error message when no query passed into open', function (): void {
		notebookUriHandler.handleUri(vscode.Uri.parse('azuredatastudio://microsoft.notebook/open'));
		sinon.assert.calledOnce(showErrorMessageSpy);
	});

	it('should show error message when file uri scheme is not https or http', function (): void {
		notebookUriHandler.handleUri(vscode.Uri.parse('azuredatastudio://microsoft.notebook/open?file://hello.ipynb'));
		sinon.assert.calledOnce(showErrorMessageSpy);
	});
});
