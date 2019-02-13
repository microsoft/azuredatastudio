/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { WizardPageBase } from '../../wizardPageBase';
import { CreateClusterModel } from '../createClusterModel';
import { WizardBase } from '../../wizardBase';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class SettingsPage extends WizardPageBase<CreateClusterModel> {
	constructor(model: CreateClusterModel, wizard: WizardBase<CreateClusterModel>) {
		super(localize('bdc-create.settingsPageTitle', 'Settings'),
			localize('bdc-create.settingsPageDescription', 'Configure the settings required for deploying SQL Server big data cluster'),
			model, wizard);
	}

	protected initialize(view: sqlops.ModelView): Thenable<void> {
		let formBuilder = view.modelBuilder.formContainer();
		let adminUserNameInput = this.createInputWithLabel(view, localize('bdc-create.AdminUsernameText', 'Admin username'), true, (inputBox: sqlops.InputBoxComponent) => {
			this.model.adminUserName = inputBox.value;
		});
		let adminPasswordInput = this.createInputWithLabel(view, localize('bdc-create.AdminUserPasswordText', 'Password'), true, (inputBox: sqlops.InputBoxComponent) => {
			this.model.adminPassword = inputBox.value;
		}, 'password');

		let basicSettingsGroup = view.modelBuilder.groupContainer().withItems([adminUserNameInput, adminPasswordInput]).withLayout({ header: localize('bdc-create.BasicSettingsText', 'Basic Settings'), collapsible: true }).component();
		let dockerSettingsGroup = view.modelBuilder.groupContainer().withItems([]).withLayout({ header: localize('bdc-create.DockerSettingsText', 'Docker Settings'), collapsible: true }).component();

		let acceptEulaCheckbox = view.modelBuilder.checkBox().component();
		acceptEulaCheckbox.label = localize('bdc-create.AcceptEulaText', 'I accept the SQL Server EULA');
		acceptEulaCheckbox.checked = false;

		let eulaHyperlink = view.modelBuilder.hyperlink().withProperties({
			label: localize('bdc-create.ViewEulaText', 'View Eula'),
			url: 'https://docs.microsoft.com/en-us/sql/getting-started/about-the-sql-server-license-terms?view=sql-server-2014'
		}).component();

		let eulaContainer = this.createRow(view, [acceptEulaCheckbox, eulaHyperlink]);

		let form = formBuilder.withFormItems([
			{
				title: '',
				component: basicSettingsGroup
			}, {
				title: '',
				component: dockerSettingsGroup
			}, {
				title: '',
				component: eulaContainer
			}]).component();
		return view.initializeModel(form);
	}

	private createInputWithLabel(view: sqlops.ModelView, label: string, isRequiredField: boolean, textChangedHandler: (inputBox: sqlops.InputBoxComponent) => void, inputType: string = 'text'): sqlops.FlexContainer {
		let input = view.modelBuilder.inputBox().withProperties({
			required: isRequiredField,
			inputType: inputType
		}).component();
		let text = view.modelBuilder.text().withProperties({ value: label }).component();
		input.width = '300px';
		text.width = '150px';
		input.onTextChanged(() => {
			textChangedHandler(input);
		});
		return this.createRow(view, [text, input]);
	}

	private createRow(view: sqlops.ModelView, items: sqlops.Component[]): sqlops.FlexContainer {
		return view.modelBuilder.flexContainer().withItems(items, { CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'baseline' }).component();
	}
}
