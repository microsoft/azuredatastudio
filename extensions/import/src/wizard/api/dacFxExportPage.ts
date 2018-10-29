/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { DacFxDataModel } from './models';
import * as sqlops from 'sqlops';
import { DacFxExportWizard } from '../dacfxExportWizard';

export abstract class DacFxExportPage {

	protected readonly wizardPage: sqlops.window.modelviewdialog.WizardPage;
	protected readonly instance: DacFxExportWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: sqlops.ModelView;

	protected constructor(instance: DacFxExportWizard, wizardPage: sqlops.window.modelviewdialog.WizardPage, model: DacFxDataModel, view: sqlops.ModelView) {
		this.instance = instance;
		this.wizardPage = wizardPage;
		this.model = model;
		this.view = view;
	}

	/**
	 * This method constructs all the elements of the page.
	 * @returns {Promise<boolean>}
	 */
	public async abstract start(): Promise<boolean>;

	/**
	 * This method is called when the user is entering the page.
	 * @returns {Promise<boolean>}
	 */
	public async abstract onPageEnter(): Promise<boolean>;

	/**
	 * This method is called when the user is leaving the page.
	 * @returns {Promise<boolean>}
	 */
	public async abstract onPageLeave(): Promise<boolean>;

	/**
	 * Sets up a navigation validator.
	 * This will be called right before onPageEnter().
	 */
	public abstract setupNavigationValidator();

	/**
	 * Override this method to cleanup what you don't need cached in the page.
	 * @returns {Promise<boolean>}
	 */
	public async cleanup(): Promise<boolean> {
		return true;
	}
}
