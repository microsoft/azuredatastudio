/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ConfigurePythonModel, ConfigurePythonWizard } from './configurePythonWizard';

export abstract class BasePage {

	constructor(protected readonly instance: ConfigurePythonWizard,
		protected readonly wizardPage: azdata.window.WizardPage,
		protected readonly model: ConfigurePythonModel,
		protected readonly view: azdata.ModelView) {
	}

	/**
	 * This method constructs all the elements of the page.
	 */
	public abstract initialize(): Promise<boolean>;

	/**
	 * This method is called when the user is entering the page.
	 */
	public abstract onPageEnter(): Promise<void>;

	/**
	 * This method is called when the user is leaving the page.
	 */
	public abstract onPageLeave(): Promise<boolean>;
}
