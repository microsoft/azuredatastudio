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

const PageTitle: string = localize('bdc.clusterProfileTitle', 'Select a cluster profile');
const PageDescription: string = localize('bdc.clusterProfileDescription', 'Select your requirement and we will provide you a pre-defined default scaling. You can later go to cluster configuration and customize it.');

export class ClusterProfilePage extends WizardPageBase<CreateClusterModel> {
	constructor(model: CreateClusterModel) {
		super(PageTitle, PageDescription, model);
	}

	protected async initialize(view: sqlops.ModelView) {
		let formBuilder = view.modelBuilder.formContainer();
		let form = formBuilder.component();
		await view.initializeModel(form);
	}
}