/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import { WizardPageBase } from '../../wizardPageBase';
import { CreateClusterModel } from '../createClusterModel';
const localize = nls.loadMessageBundle();

const PageTitle: string = localize(
	'bdc.selectTargetClusterPageTitle',
	'Where do you want to deploy this SQL Server big data cluster?'
);
const PageDescription: string = localize(
	'bdc.selectTargetClusterPageDescription',
	'Select an existing Kubernetes cluster or choose a cluster type you want to deploy'
);

const RadioButtonGroupName = 'SelectClusterType';

export class SelectTargetClusterPage extends WizardPageBase<CreateClusterModel> {
	constructor(model: CreateClusterModel) {
		super(PageTitle, PageDescription, model);
	}

	protected async initialize(view: sqlops.ModelView) {
		let existingClusterOption = view.modelBuilder.radioButton().withProperties({
			label: localize('bdc.existingK8sCluster','Existing Kubernetes cluster'),
			name: RadioButtonGroupName
		}).component();

		let createLocalClusterOption = view.modelBuilder.radioButton().withProperties({
			label: localize('bdc.createLocalCluster', 'Create new local cluster'),
			name: RadioButtonGroupName
		}).component();

		let createAksCluster = view.modelBuilder.radioButton().withProperties({
			label: localize('bdc.createAksCluster', 'Create new Azure Kubernetes service cluster'),
			name: RadioButtonGroupName
		}).component();

		let optionGroup = view.modelBuilder.divContainer().withItems([existingClusterOption, createLocalClusterOption, createAksCluster]).component();
		let container = view.modelBuilder.flexContainer().withItems([optionGroup]).withLayout({
			flexFlow: 'row',
			alignItems: 'left'
		}).component();
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
}
