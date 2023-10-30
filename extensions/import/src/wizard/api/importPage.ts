/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ImportDataModel } from './models';
import * as azdata from 'azdata';
import { FlatFileProvider } from '../../services/contracts';
import { FlatFileWizard } from '../flatFileWizard';
import { BasePage } from './basePage';

export abstract class ImportPage extends BasePage {

	protected override readonly wizardPage: azdata.window.WizardPage;
	protected readonly instance: FlatFileWizard;
	protected override readonly model: ImportDataModel;
	protected override readonly view: azdata.ModelView;
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
