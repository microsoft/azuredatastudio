/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationStateModel } from './stateMachine';
export abstract class MigrationWizardPage {
	constructor(protected readonly wizardPage: azdata.window.WizardPage, protected readonly migrationStateModel: MigrationStateModel) { }

	public abstract async registerWizardContent(): Promise<void>;

	public getwizardPage(): azdata.window.WizardPage {
		return this.wizardPage;
	}
}

