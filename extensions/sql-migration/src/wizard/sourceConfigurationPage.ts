/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { SOURCE_CONFIGURATION_PAGE_TITLE } from '../models/strings';
import { MigrationStateModel } from '../models/stateMachine';

export class SourceConfigurationPage extends MigrationWizardPage {
	constructor(migrationStateModel: MigrationStateModel) {
		super(azdata.window.createWizardPage(SOURCE_CONFIGURATION_PAGE_TITLE), migrationStateModel);
	}

	public async registerWizardContent(): Promise<void> {
		return new Promise<void>(async (resolve, reject) => {
			this.wizardPage.registerContent(async (view) => {
				try {
					await this.registerContent(view);
					resolve();
				} catch (ex) {
					reject(ex);
				} finally {
					reject(new Error());
				}
			});
		});
	}

	private async registerContent(view: azdata.ModelView) {

	}
}
