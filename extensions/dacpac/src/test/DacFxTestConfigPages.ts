/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DacFxDataModel } from '../wizard/api/models';
import { DeployConfigPage } from '../wizard/pages/deployConfigPage';
import { DataTierApplicationWizard } from '../wizard/dataTierApplicationWizard';

export class TestDeployConfigPage extends DeployConfigPage {

	constructor(instance: DataTierApplicationWizard, wizardPage: azdata.window.WizardPage, model: DacFxDataModel, view: azdata.ModelView) {
		super(instance, wizardPage, model, view);
	}

	get Model(): DacFxDataModel {
		return this.model;
	}

	SetDatabaseDropDown(): void {
		this.databaseDropdown.value = { name: 'DummyDatabase', displayName: 'DummyDatabase' };
	}

	SetFileName(): void {
		this.fileTextBox.value = 'DummyDacpac';
	}

}
