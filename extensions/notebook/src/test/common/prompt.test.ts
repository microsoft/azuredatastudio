/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';

import { IPrompter, confirm, IQuestion } from '../../prompts/question';
import CodeAdapter from '../../prompts/adapter';
import { ApiWrapper } from '../../common/apiWrapper';


describe('Prompt', () => {

	let prompter: IPrompter;
	let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;


	before(function () {
		prompter = new CodeAdapter();
	});

	beforeEach(function () {
		mockApiWrapper = TypeMoq.Mock.ofType<ApiWrapper>();
		mockApiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny()));
	});

	it('Should not find prompt for invalid question type', async function (): Promise<void> {
		await prompter.promptSingle<boolean>(<IQuestion>{
			type: 'invalidType',
			message: 'sample message',
			default: false
		}, mockApiWrapper.object);
		mockApiWrapper.verify(s => s.showErrorMessage(TypeMoq.It.isAny()), TypeMoq.Times.once());
		mockApiWrapper.verify(s => s.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
	});

	it('Should find prompt for confirm type', async function (): Promise<void> {
		mockApiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('Yes'));
		await prompter.promptSingle<boolean>(<IQuestion>{
			type: confirm,
			message: 'sample message',
			default: false
		}, mockApiWrapper.object);
		mockApiWrapper.verify(s => s.showErrorMessage(TypeMoq.It.isAny()), TypeMoq.Times.never());
		mockApiWrapper.verify(s => s.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
	});
});


