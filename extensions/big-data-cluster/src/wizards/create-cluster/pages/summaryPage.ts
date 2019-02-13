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

export class SummaryPage extends WizardPageBase<CreateClusterModel> {
	constructor(model: CreateClusterModel, wizard: WizardBase<CreateClusterModel>) {
		super(localize('bdc-create.summaryPageTitle', 'Summary'), '', model, wizard);
	}

	protected initialize(view: sqlops.ModelView): Thenable<void> {
		let formBuilder = view.modelBuilder.formContainer();
		let form = formBuilder.component();
		return view.initializeModel(form);
	}
}
