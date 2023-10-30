/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { IWizardPageWrapper } from '../wizardPageWrapper';
import { VirtualizeDataModel } from './virtualizeDataModel';
import { VirtualizeDataInput } from '../../services/contracts';
import { VDIManager } from './virtualizeDataInputManager';
import { AppContext } from '../../appContext';

export class MasterKeyUiElements {
	public masterKeyPasswordInput: azdata.InputBoxComponent;
	public masterKeyPasswordConfirmInput: azdata.InputBoxComponent;
}
export class CreateMasterKeyPage implements IWizardPageWrapper {
	private _page: azdata.window.WizardPage;
	private _uiElements: MasterKeyUiElements;

	private readonly _masterKeyExistsMsg = localize('masterKeyExistsMsg', 'A Master Key already exists for the selected database. No action is required on this page.');

	public constructor(private _dataModel: VirtualizeDataModel, private _vdiManager: VDIManager, private _appContext: AppContext) {
		this.buildPage();
	}

	public setUi(ui: MasterKeyUiElements): void {
		this._uiElements = ui;
	}

	private buildPage(): void {
		this._page = this._appContext.apiWrapper.createWizardPage(localize('createMasterKeyTitle', 'Create Database Master Key'));
		this._page.description = localize(
			'createMasterKeyDescription',
			'A master key is required. This secures the credentials used by an External Data Source. Note that you should back up the master key by using BACKUP MASTER KEY and store the backup in a secure, off-site location.');

		this._page.registerContent(async (modelView) => {
			let ui = new MasterKeyUiElements();
			let builder = modelView.modelBuilder;
			let allComponents: (azdata.FormComponent | azdata.FormComponentGroup)[] = [];

			// Master key fields
			ui.masterKeyPasswordInput = builder.inputBox().withProperties({
				inputType: 'password'
			}).component();
			ui.masterKeyPasswordConfirmInput = builder.inputBox().withProperties({
				inputType: 'password'
			}).component();
			allComponents.push({
				components:
					[
						{
							component: ui.masterKeyPasswordInput,
							title: localize('masterKeyPasswordInput', 'Password'),
							required: true
						},
						{
							component: ui.masterKeyPasswordConfirmInput,
							title: localize('masterKeyPasswordConfirmInput', 'Confirm Password'),
							required: true
						}
					],
				title: localize('masterKeyPasswordLabel', 'Set the Master Key password.')
			});

			let formContainer = builder.formContainer()
				.withFormItems(allComponents,
					{
						horizontal: true,
						componentWidth: '600px'
					}).component();

			let pwdReminderText = builder.text().withProperties({
				value: localize('pwdReminderText', 'Strong passwords use a combination of alphanumeric, upper, lower, and special characters.')
			}).component();

			let flexContainer = builder.flexContainer().withLayout({
				flexFlow: 'column',
				alignItems: 'stretch',
				height: '100%',
				width: '100%'
			}).component();

			flexContainer.addItem(formContainer, { CSSStyles: { 'padding': '0px' } });
			flexContainer.addItem(pwdReminderText, { CSSStyles: { 'padding': '10px 0 0 30px' } });

			this.setUi(ui);
			await modelView.initializeModel(flexContainer);
		});
	}

	public async validate(): Promise<boolean> {
		if (this._uiElements.masterKeyPasswordInput.value === this._uiElements.masterKeyPasswordConfirmInput.value) {
			let inputValues = this._vdiManager.getVirtualizeDataInput(this);
			return this._dataModel.validateInput(inputValues);
		} else {
			this._dataModel.showWizardError(localize('passwordMismatchWithConfirmError', 'Password values do not match.'));
			return false;
		}
	}

	public getPage(): azdata.window.WizardPage {
		return this._page;
	}

	public async updatePage(): Promise<void> {
		let hasMasterKey: boolean = await this._dataModel.hasMasterKey();
		this._uiElements.masterKeyPasswordInput.updateProperties({ enabled: !hasMasterKey, required: !hasMasterKey });
		this._uiElements.masterKeyPasswordConfirmInput.updateProperties({ enabled: !hasMasterKey, required: !hasMasterKey });

		if (hasMasterKey) {
			this._dataModel.showWizardInfo(this._masterKeyExistsMsg);
		}
	}

	public getInputValues(existingInput: VirtualizeDataInput): void {
		existingInput.destDbMasterKeyPwd = (this._uiElements && this._uiElements.masterKeyPasswordInput) ?
			this._uiElements.masterKeyPasswordInput.value : undefined;
	}
}
