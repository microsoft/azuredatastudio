/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { WIZARD_TITLE } from '../models/strings';
import { SourceConfigurationPage } from './sourceConfigurationPage';
import { MigrationStateModel } from '../models/stateMachine';

export class WizardController {
	constructor() {

	}

	public async openWizard(): Promise<void> {
	}

	public async createWizard(): Promise<void> {
		azdata.window.createWizard(WIZARD_TITLE, 'wide');
		const stateModel = new MigrationStateModel({} as azdata.IConnectionProfile);
		new SourceConfigurationPage(stateModel);

	}
}
