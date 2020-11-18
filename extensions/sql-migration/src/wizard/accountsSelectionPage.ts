/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../models/strings';
import { Disposable } from 'vscode';
import { getSubscriptions, Subscription, getAvailableManagedInstanceProducts, AzureProduct, getAvailableSqlServers } from '../api/azure';

export class AccountsSelectionPage extends MigrationWizardPage {
	private accounts: azdata.Account[] = [];
	private disposables: Disposable[] = [];

	// For future reference: DO NOT EXPOSE WIZARD DIRECTLY THROUGH HERE.
	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.ACCOUNTS_SELECTION_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
	}

	public onPageEnter(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	public onPageLeave(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	protected handleStateChange(e: StateChangeEvent): Promise<void> {
		throw new Error('Method not implemented.');
	}
}
