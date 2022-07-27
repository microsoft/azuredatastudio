/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import 'mocha';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import { initializeWizardPage, InputComponent, InputComponentInfo, Validator, WizardPageContext } from '../../../ui/modelViewUtils';
import { FieldType } from '../../../interfaces';
import { IToolsService } from '../../../services/toolsService';
import { Deferred } from '../../utils';
import * as azdataTest from '@microsoft/azdata-test';
import * as should from 'should';
import * as sinon from 'sinon';

describe('WizardPage', () => {
	let stubCheckbox: azdataTest.stubs.modelView.StubCheckbox;
	let stubInputBox: azdataTest.stubs.modelView.StubInputBox;
	let testWizardPage: WizardPageContext;
	let contentRegistered: Deferred<void>;

	before(function () {
		contentRegistered = new Deferred<void>();
		const mockWizardPage = TypeMoq.Mock.ofType<azdata.window.WizardPage>();
		stubCheckbox = new azdataTest.stubs.modelView.StubCheckbox();
		stubInputBox = new azdataTest.stubs.modelView.StubInputBox();
		const mockModelView = azdataTest.mocks.modelView.createModelViewMock({
			checkBox: () => stubCheckbox,
			inputBox: () => stubInputBox
		});
		mockWizardPage.setup(p => p.registerContent(TypeMoq.It.isAny())).callback(async (handler: (view: azdata.ModelView) => Thenable<void>) => {
			await handler(mockModelView.modelViewMock.object);
			contentRegistered.resolve();
		});
		const mockWizard = TypeMoq.Mock.ofType<azdata.window.Wizard>();
		const mockToolsService = TypeMoq.Mock.ofType<IToolsService>();
		testWizardPage = {
			page: mockWizardPage.object,
			container: mockWizard.object,
			wizardInfo: {
				title: 'TestWizard',
				pages: [],
				doneAction: {}
			},
			pageInfo: {
				title: 'TestWizardPage',
				sections: [
					{
						fields: [
							{
								label: 'Field1',
								type: FieldType.Checkbox
							},
							{
								label: 'Field2',
								type: FieldType.Text,
								enabled: {
									target: 'Field1',
									value: 'true'
								}
							}
						]
					}
				]
			},
			inputComponents: {},
			onNewDisposableCreated: (_disposable: vscode.Disposable): void => { },
			onNewInputComponentCreated: (
				name: string,
				inputComponentInfo: InputComponentInfo<InputComponent>
			): void => {
				testWizardPage.inputComponents[name] = inputComponentInfo;
			},
			onNewValidatorCreated: (_validator: Validator): void => { },
			toolsService: mockToolsService.object
		};
	});

	it('dynamic enablement', async function (): Promise<void> {

		// Stub out the enabled property so we can hook into when that's set to ensure we wait for the state to be updated
		// before continuing the test
		let enabled = false;
		sinon.stub(stubInputBox, 'enabled').set(v => {
			enabled = v;
			enabledDeferred.resolve();
		});
		sinon.stub(stubInputBox, 'enabled').get(() => {
			return enabled;
		});
		// Used to ensure that we wait until the enabled state is updated for our mocked components before continuing
		let enabledDeferred = new Deferred();

		initializeWizardPage(testWizardPage);
		await contentRegistered.promise;
		await enabledDeferred.promise;
		should(stubInputBox.enabled).be.false('Input box should be disabled by default');
		enabledDeferred = new Deferred();
		stubCheckbox.checked = true;
		// Now wait for the enabled state to be updated again
		await enabledDeferred.promise;
		should(stubInputBox.enabled).be.true('Input box should be enabled after target component value updated');
	});
});
