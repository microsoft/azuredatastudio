/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { WizardPageBase } from '../../wizardPageBase';
import { CreateClusterModel } from '../createClusterModel';
import * as ResourceStrings from '../resourceStrings';
import { networkInterfaces } from 'os';

const RadioButtonGroupName = 'SelectClusterType';

export class SelectTargetClusterPage extends WizardPageBase<CreateClusterModel> {
	constructor(model: CreateClusterModel) {
		super(ResourceStrings.SelectTargetClusterPageTitle, ResourceStrings.SelectTargetClusterPageDescription, model);
	}

	private existingClusterOption: sqlops.RadioButtonComponent;
	private createLocalClusterOption: sqlops.RadioButtonComponent;
	private createAksCluster: sqlops.RadioButtonComponent;

	protected async initialize(view: sqlops.ModelView) {
		this.existingClusterOption = this.createTargetTypeRadioButton(view, ResourceStrings.ExistingClusterOptionText, this.showExistingClusterOptionPage, true);
		this.createLocalClusterOption = this.createTargetTypeRadioButton(view, ResourceStrings.CreateLocalClusterOptionText, this.showCreateLocalClusterOptionPage);
		this.createAksCluster = this.createTargetTypeRadioButton(view, ResourceStrings.CreateNewAKSClusterOptionText, this.showCreateAksClusterOptionPage);

		let optionGroup = view.modelBuilder.divContainer().withItems([this.existingClusterOption, this.createLocalClusterOption, this.createAksCluster]).component();
		let container = view.modelBuilder.flexContainer().withItems([optionGroup]).withLayout({ flexFlow: 'row', alignItems: 'left' }).component();

		let formBuilder = view.modelBuilder.formContainer().withFormItems(
			[
				{
					component: container,
					title: ''
				}
			],
			{
				horizontal: true
			}
		);

		let form = formBuilder.component();
		await view.initializeModel(form);
	}

	private createTargetTypeRadioButton(view: sqlops.ModelView, label: string, checkedHandler: () => void, checked: boolean = false): sqlops.RadioButtonComponent {
		let radioButton = view.modelBuilder.radioButton().withProperties({ label: label, name: RadioButtonGroupName, checked: checked }).component();
		radioButton.onDidClick(() => {
			checkedHandler();
		});
		return radioButton;
	}

	private showExistingClusterOptionPage() {

	}

	private showCreateLocalClusterOptionPage() {

	}

	private showCreateAksClusterOptionPage() {

	}
}
