/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { DataSourceWizardService } from '../../../services/contracts';
import { ImportDataModel } from './models';
import { TableFromFileWizard } from '../tableFromFileWizard';

export abstract class ImportPage {

	protected constructor(
		protected readonly instance: TableFromFileWizard,
		protected readonly wizardPage: azdata.window.WizardPage,
		protected readonly model: ImportDataModel,
		protected readonly view: azdata.ModelView,
		protected readonly provider: DataSourceWizardService) { }

	/**
	 * This method constructs all the elements of the page.
	 * @returns {Promise<boolean>}
	 */
	public abstract start(): Promise<boolean>;

	/**
	 * This method is called when the user is entering the page.
	 * @returns {Promise<boolean>}
	 */
	public abstract onPageEnter(): Promise<void>;

	/**
	 * This method is called when the user is leaving the page.
	 * @returns {Promise<boolean>}
	 */
	public abstract onPageLeave(clickedNext: boolean): Promise<boolean>;
}
