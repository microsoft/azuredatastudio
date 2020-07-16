/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ImportDataModel } from './models';
import * as azdata from 'azdata';
import { FlatFileProvider } from '../../services/contracts';
import { FlatFileWizard } from '../flatFileWizard';
import { BasePage } from './basePage';

export abstract class ImportPage extends BasePage {

	protected readonly wizardPage: azdata.window.WizardPage;
	protected readonly instance: FlatFileWizard;
	protected readonly model: ImportDataModel;
	protected readonly view: azdata.ModelView;
	protected readonly provider: FlatFileProvider;


	constructor(instance: FlatFileWizard, wizardPage: azdata.window.WizardPage, model: ImportDataModel, view: azdata.ModelView, provider: FlatFileProvider) {
		super();
		this.instance = instance;
		this.wizardPage = wizardPage;
		this.model = model;
		this.view = view;
		this.provider = provider;
	}
}
