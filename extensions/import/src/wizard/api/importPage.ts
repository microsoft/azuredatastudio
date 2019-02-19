/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ImportDataModel } from './models';
import * as sqlops from 'sqlops';
import { FlatFileProvider } from '../../services/contracts';
import { FlatFileWizard } from '../flatFileWizard';
import { BasePage } from './basePage';

export abstract class ImportPage extends BasePage {

	protected readonly wizardPage: sqlops.window.WizardPage;
	protected readonly instance: FlatFileWizard;
	protected readonly model: ImportDataModel;
	protected readonly view: sqlops.ModelView;
	protected readonly provider: FlatFileProvider;

	protected constructor(instance: FlatFileWizard, wizardPage: sqlops.window.WizardPage, model: ImportDataModel, view: sqlops.ModelView, provider: FlatFileProvider) {
		super();
		this.instance = instance;
		this.wizardPage = wizardPage;
		this.model = model;
		this.view = view;
		this.provider = provider;
	}
}
