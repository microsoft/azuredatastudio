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
export class SelectTargetClusterPage extends WizardPageBase<CreateClusterModel> {
	constructor(model: CreateClusterModel) {
		super(PageTitle, PageDescription, model);
	}

	protected async initialize(view: sqlops.ModelView) {

		let formBuilder = view.modelBuilder.formContainer().withFormItems(
			[],
			{
				horizontal: true,
				componentWidth: 400
			}
		);

		let form = formBuilder.component();
		await view.initializeModel(form);
	}
}
