/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import { MigrationStateModel } from '../models/stateMachine';
import { SourceConfigurationPage } from './sourceConfigurationPage';
import { WIZARD_TITLE } from '../models/strings';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { SKURecommendationPage } from './skuRecommendationPage';
import { SubscriptionSelectionPage } from './subscriptionSelectionPage';

export class WizardController {
	constructor(private readonly extensionContext: vscode.ExtensionContext) {

	}

	public async openWizard(profile: azdata.connection.Connection): Promise<void> {
		const api = (await vscode.extensions.getExtension(mssql.extension.name)?.activate()) as mssql.IExtension;
		if (api) {
			const stateModel = new MigrationStateModel(this.extensionContext, profile, api.sqlMigration);
			this.extensionContext.subscriptions.push(stateModel);
			this.createWizard(stateModel);
		}
	}

	private async createWizard(stateModel: MigrationStateModel): Promise<void> {
		const wizard = azdata.window.createWizard(WIZARD_TITLE, 'wide');
		wizard.generateScriptButton.enabled = false;
		wizard.generateScriptButton.hidden = true;

		const sourceConfigurationPage = new SourceConfigurationPage(wizard, stateModel);
		const skuRecommendationPage = new SKURecommendationPage(wizard, stateModel);
		const subscriptionSelectionPage = new SubscriptionSelectionPage(wizard, stateModel);

		const pages: MigrationWizardPage[] = [sourceConfigurationPage, skuRecommendationPage, subscriptionSelectionPage];

		wizard.pages = pages.map(p => p.getwizardPage());

		const wizardSetupPromises: Thenable<void>[] = [];
		wizardSetupPromises.push(...pages.map(p => p.registerWizardContent()));
		wizardSetupPromises.push(wizard.open());

		wizard.onPageChanged(async (pageChangeInfo: azdata.window.WizardPageChangeInfo) => {
			const newPage = pageChangeInfo.newPage;
			const lastPage = pageChangeInfo.lastPage;

			await pages[lastPage]?.onPageLeave();
			await pages[newPage]?.onPageEnter();
		});

		wizard.registerNavigationValidator(async validator => {
			// const lastPage = validator.lastPage;

			// const canLeave = await pages[lastPage]?.canLeave() ?? true;
			// const canEnter = await pages[lastPage]?.canEnter() ?? true;

			// return canEnter && canLeave;
			return true;
		});

		await Promise.all(wizardSetupPromises);
		await pages[0].onPageEnter();
	}
}
