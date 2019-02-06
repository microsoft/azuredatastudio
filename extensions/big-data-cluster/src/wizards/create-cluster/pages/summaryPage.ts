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

const PageTitle: string = localize('bdc.summaryPageTitle', 'Summary');

export class SummaryPage extends WizardPageBase<CreateClusterModel> {
	constructor(model: CreateClusterModel) {
		super(PageTitle, '', model);
	}

	protected async initialize(view: sqlops.ModelView) {
		let formBuilder = view.modelBuilder.formContainer();
		let form = formBuilder.component();
		await view.initializeModel(form);
	}
}