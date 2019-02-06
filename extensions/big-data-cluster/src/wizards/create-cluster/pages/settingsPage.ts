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

const PageTitle: string = localize('bdc.clusterProfilePageTitle', 'Settings');
const PageDescription: string = localize('bdc.clusterProfilePageDescription', 'Configure the settings required for deploying SQL Server big data cluster');

export class SettingsPage extends WizardPageBase<CreateClusterModel> {
	constructor(model: CreateClusterModel) {
		super(PageTitle, PageDescription, model);
	}

	protected async initialize(view: sqlops.ModelView) {
		let formBuilder = view.modelBuilder.formContainer();
		let form = formBuilder.component();
		await view.initializeModel(form);
	}
}