/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ConfigurePythonModel, ConfigurePythonWizard } from './configurePythonWizard';
import { ApiWrapper } from '../../common/apiWrapper';

export abstract class ConfigurePythonPage {

	constructor(protected readonly apiWrapper: ApiWrapper,
		protected readonly instance: ConfigurePythonWizard,
		protected readonly wizardPage: azdata.window.WizardPage,
		protected readonly model: ConfigurePythonModel,
		protected readonly view: azdata.ModelView) {
	}

	/**
	 * This method constructs all the elements of the page.
	 */
	public async abstract start(): Promise<boolean>;

	/**
	 * This method is called when the user is entering the page.
	 */
	public async abstract onPageEnter(): Promise<boolean>;

	/**
	 * This method is called when the user is leaving the page.
	 */
	async onPageLeave(): Promise<boolean> {
		return true;
	}

	/**
	 * Sets up a navigation validator.
	 * This will be called right before onPageEnter().
	 */
	public abstract setupNavigationValidator(): void;
}
