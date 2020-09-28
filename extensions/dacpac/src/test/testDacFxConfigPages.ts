/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DacFxDataModel } from '../wizard/api/models';
import { DeployConfigPage } from '../wizard/pages/deployConfigPage';
import { ExtractConfigPage } from '../wizard/pages/extractConfigPage';
import { DataTierApplicationWizard } from '../wizard/dataTierApplicationWizard';
import { SelectOperationPage } from '../wizard/pages/selectOperationpage';
import { ImportConfigPage } from '../wizard/pages/importConfigPage';
import { DacFxSummaryPage } from '../wizard/pages/dacFxSummaryPage';

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

export class TestExtractConfigPage extends ExtractConfigPage {
	constructor(instance: DataTierApplicationWizard, wizardPage: azdata.window.WizardPage, model: DacFxDataModel, view: azdata.ModelView) {
		super(instance, wizardPage, model, view);
	}

	get Model(): DacFxDataModel {
		return this.model;
	}
}

export class TestSelectOperationPage extends SelectOperationPage {
	constructor(instance: DataTierApplicationWizard, wizardPage: azdata.window.WizardPage, model: DacFxDataModel, view: azdata.ModelView) {
		super(instance, wizardPage, model, view);
	}

	get WizardState(): DataTierApplicationWizard {
		return this.instance;
	}
}

export class TestImportConfigPage extends ImportConfigPage {
	constructor(instance: DataTierApplicationWizard, wizardPage: azdata.window.WizardPage, model: DacFxDataModel, view: azdata.ModelView) {
		super(instance, wizardPage, model, view);
	}

	get Model(): DacFxDataModel {
		return this.model;
	}
}

export class TestDacFxSummaryPage extends DacFxSummaryPage {
	constructor(instance: DataTierApplicationWizard, wizardPage: azdata.window.WizardPage, model: DacFxDataModel, view: azdata.ModelView) {
		super(instance, wizardPage, model, view);
	}

	get WizardState(): DataTierApplicationWizard {
		return this.instance;
	}
}
