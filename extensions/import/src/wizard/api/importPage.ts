/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ImportDataModel } from './models';
import * as sqlops from 'sqlops';
import { FlatFileProvider } from '../../services/contracts';
import { FlatFileWizard } from '../flatFileWizard';

export abstract class ImportPage {
	protected readonly instance: FlatFileWizard;
	protected readonly model: ImportDataModel;
	protected readonly view: sqlops.ModelView;
	protected readonly provider: FlatFileProvider;

	protected constructor(instance: FlatFileWizard, model: ImportDataModel, view: sqlops.ModelView, provider: FlatFileProvider) {
		this.instance = instance;
		this.model = model;
		this.view = view;
		this.provider = provider;
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
	 * Override this method to cleanup what you don't need cached in the page.
	 * @returns {Promise<boolean>}
	 */
	public async cleanup(): Promise<boolean> {
		return true;
	}
}
