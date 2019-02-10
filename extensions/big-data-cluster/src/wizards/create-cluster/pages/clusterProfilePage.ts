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

export class ClusterProfilePage extends WizardPageBase<CreateClusterModel> {
	constructor(model: CreateClusterModel, wizard: WizardBase<CreateClusterModel>) {
		super(ResourceStrings.ClusterProfilePageTitle, ResourceStrings.ClusterProfilePageDescription, model, wizard);
	}

	protected async initialize(view: sqlops.ModelView) {
		let formBuilder = view.modelBuilder.formContainer();
		let form = formBuilder.component();
		await view.initializeModel(form);
	}
}
