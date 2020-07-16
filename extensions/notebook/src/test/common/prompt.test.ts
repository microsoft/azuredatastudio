/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { IPrompter, confirm, IQuestion } from '../../prompts/question';
import CodeAdapter from '../../prompts/adapter';


describe('Prompt', () => {

	let prompter: IPrompter;
	let showErrorMessageSpy: sinon.SinonSpy;

	before(function () {
		prompter = new CodeAdapter();
	});

	beforeEach(function(): void {
		showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');
	});

	afterEach(function () {
		sinon.restore();
	});

	it('Should not find prompt for invalid question type', async function (): Promise<void> {
		const showQuickPickSpy = sinon.spy(vscode.window, 'showQuickPick');
		await prompter.promptSingle<boolean>(<IQuestion>{
			type: 'invalidType',
			message: 'sample message',
			default: false
		});
		should(showErrorMessageSpy.calledOnce).be.true('showErrorMessage should be called exactly once');
		should(showQuickPickSpy.notCalled).be.true('showQuickPick should never have been called');
	});

	it('Should find prompt for confirm type', async function (): Promise<void> {
		const quickPickSpy = sinon.stub(vscode.window, 'showQuickPick').returns(Promise.resolve('Yes') as any);
		await prompter.promptSingle<boolean>(<IQuestion>{
			type: confirm,
			message: 'sample message',
			default: false
		});
		should(showErrorMessageSpy.notCalled).be.true('showErrorMessage should never be called');
		should(quickPickSpy.calledOnce).be.true('showQuickPick should have been called once');
	});
});


