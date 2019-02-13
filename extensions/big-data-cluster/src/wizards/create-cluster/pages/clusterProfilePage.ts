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

export class ClusterProfilePage extends WizardPageBase<CreateClusterModel> {
	constructor(model: CreateClusterModel, wizard: WizardBase<CreateClusterModel>) {
		super(localize('bdc-create.clusterProfilePageTitle', 'Select a cluster profile'),
			localize('bdc-create.clusterProfilePageDescription', 'Select your requirement and we will provide you a pre-defined default scaling. You can later go to cluster configuration and customize it.'),
			model, wizard);
	}

	protected initialize(view: sqlops.ModelView): Thenable<void> {
		let formBuilder = view.modelBuilder.formContainer();
		let form = formBuilder.component();
		return view.initializeModel(form);
	}
}
