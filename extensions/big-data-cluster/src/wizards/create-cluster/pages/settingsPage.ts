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

const LabelWidth = '150px';
const InputWidth = '300px';

export class SettingsPage extends WizardPageBase<CreateClusterModel> {
	constructor(model: CreateClusterModel, wizard: WizardBase<CreateClusterModel>) {
		super(ResourceStrings.SettingsPageTitle, ResourceStrings.SettingsPageDescription, model, wizard);
	}

	protected async initialize(view: sqlops.ModelView) {
		let formBuilder = view.modelBuilder.formContainer();
		let adminUserNameLabel = view.modelBuilder.text().withProperties({ value: ResourceStrings.AdminUserNameText }).component();
		let adminUserNameInput = view.modelBuilder.inputBox().component();
		let adminPasswordLabel = view.modelBuilder.text().withProperties({ value: ResourceStrings.AdminUserPasswordText }).component();
		let adminUserPasswordInput = view.modelBuilder.inputBox().component();
		adminUserNameInput.width = InputWidth;
		adminUserNameLabel.width = LabelWidth;
		adminUserPasswordInput.width = InputWidth;
		adminPasswordLabel.width = LabelWidth;

		let userNameContainer = view.modelBuilder.flexContainer().withItems([adminUserNameLabel, adminUserNameInput]).withLayout({ flexFlow: 'row', alignItems: 'baseline' }).component();
		let passwordContainer = view.modelBuilder.flexContainer().withItems([adminPasswordLabel, adminUserPasswordInput]).withLayout({ flexFlow: 'row', alignItems: 'baseline' }).component();

		let group1 = view.modelBuilder.groupContainer().withItems([userNameContainer, passwordContainer]).withLayout({ header: ResourceStrings.BasicSettingsText, collapsible: true }).component();
		let group2 = view.modelBuilder.groupContainer().withItems([]).withLayout({ header: ResourceStrings.DockerSettingsText, collapsible: true }).component();
		let form = formBuilder.withFormItems([{ title: '', component: group1 }, { title: '', component: group2 }]).component();
		await view.initializeModel(form);
	}
}
