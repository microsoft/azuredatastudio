/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { WizardPageBase } from '../../wizardPageBase';
import { CreateClusterModel } from '../createClusterModel';
import * as ResourceStrings from '../resourceStrings';
import { WizardBase } from '../../wizardBase';

export class SettingsPage extends WizardPageBase<CreateClusterModel> {
	constructor(model: CreateClusterModel, wizard: WizardBase<CreateClusterModel>) {
		super(ResourceStrings.SettingsPageTitle, ResourceStrings.SettingsPageDescription, model, wizard);
	}

	protected async initialize(view: sqlops.ModelView) {
		let formBuilder = view.modelBuilder.formContainer();
		let adminUserNameInput = this.createInputWithLabel(view, ResourceStrings.AdminUserNameText, true, (inputBox: sqlops.InputBoxComponent) => {
			this.model.adminUserName = inputBox.value;
		});
		let adminPasswordInput = this.createInputWithLabel(view, ResourceStrings.AdminUserPasswordText, true, (inputBox: sqlops.InputBoxComponent) => {
			this.model.adminPassword = inputBox.value;
		});

		let basicSettingsGroup = view.modelBuilder.groupContainer().withItems([adminUserNameInput, adminPasswordInput]).withLayout({ header: ResourceStrings.BasicSettingsText, collapsible: true }).component();
		let dockerSettingsGroup = view.modelBuilder.groupContainer().withItems([]).withLayout({ header: ResourceStrings.DockerSettingsText, collapsible: true }).component();

		let acceptEulaCheckbox = view.modelBuilder.checkBox().component();
		acceptEulaCheckbox.label = ResourceStrings.AcceptEulaText;
		acceptEulaCheckbox.checked = false;

		let eulaHyperLink = view.modelBuilder.hyperLink().withProperties({ label: ResourceStrings.ViewEulaText, url: ResourceStrings.SqlServerEulaUrl }).component();

		let eulaContainer = this.createRow(view, [acceptEulaCheckbox, eulaHyperLink]);

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
		await view.initializeModel(form);
	}

	private createInputWithLabel(view: sqlops.ModelView, label: string, isRequiredField: boolean, textChangedHandler: (inputBox: sqlops.InputBoxComponent) => void): sqlops.FlexContainer {
		let input = view.modelBuilder.inputBox().withProperties({ required: isRequiredField }).component();
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
