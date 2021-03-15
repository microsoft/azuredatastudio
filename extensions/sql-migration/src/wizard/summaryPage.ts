/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, NetworkContainerType, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { createHeadingTextComponent, createInformationRow } from './wizardController';

export class SummaryPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _flexContainer!: azdata.FlexContainer;

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.SUMMARY_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;
		this._flexContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();
		const form = view.modelBuilder.formContainer()
			.withFormItems(
				[
					{
						component: this._flexContainer
					}
				]
			);
		await view.initializeModel(form.component());
	}

	public async onPageEnter(): Promise<void> {
		this._flexContainer.addItems(
			[
				createHeadingTextComponent(this._view, constants.AZURE_ACCOUNT_LINKED),
				createHeadingTextComponent(this._view, this.migrationStateModel._azureAccount.displayInfo.displayName),
				createHeadingTextComponent(this._view, constants.MIGRATION_TARGET),
				createInformationRow(this._view, constants.TYPE, (this.migrationStateModel._targetServerInstance.type === 'microsoft.compute/virtualmachines') ? constants.SUMMARY_VM_TYPE : constants.SUMMARY_MI_TYPE),
				createInformationRow(this._view, constants.SUBSCRIPTION, this.migrationStateModel._targetSubscription.name),
				createInformationRow(this._view, constants.SUMMARY_MI_TYPE, this.migrationStateModel._targetServerInstance.name),
				createInformationRow(this._view, constants.SUMMARY_DATABASE_COUNT_LABEL, this.migrationStateModel._migrationDbs.length.toString()),
				createHeadingTextComponent(this._view, constants.DATABASE_BACKUP_PAGE_TITLE),
				this.createNetworkContainerRows(),
				createHeadingTextComponent(this._view, constants.IR_PAGE_TITLE),
				createInformationRow(this._view, constants.IR_PAGE_TITLE, this.migrationStateModel._migrationController?.name!),
				createInformationRow(this._view, constants.SUMMARY_IR_NODE, this.migrationStateModel._nodeNames.join(', ')),

			]
		);
	}

	public async onPageLeave(): Promise<void> {
		this._flexContainer.clearItems();
		this.wizard.registerNavigationValidator(async (pageChangeInfo) => {
			return true;
		});
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private createNetworkContainerRows(): azdata.FlexContainer {
		const flexContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();
		switch (this.migrationStateModel._databaseBackup.networkContainerType) {
			case NetworkContainerType.NETWORK_SHARE:
				flexContainer.addItems(
					[
						createInformationRow(this._view, constants.TYPE, constants.NETWORK_SHARE),
						createInformationRow(this._view, constants.USER_ACCOUNT, this.migrationStateModel._databaseBackup.windowsUser),
						createInformationRow(this._view, constants.SUMMARY_AZURE_STORAGE_SUBSCRIPTION, this.migrationStateModel._databaseBackup.subscription.name),
						createInformationRow(this._view, constants.SUMMARY_AZURE_STORAGE, this.migrationStateModel._databaseBackup.storageAccount.name),
						createHeadingTextComponent(this._view, 'Target Databases:')
					]
				);
				this.migrationStateModel._migrationDbs.forEach((db, index) => {
					flexContainer.addItem(createInformationRow(this._view, constants.TARGET_NAME_FOR_DATABASE(db), this.migrationStateModel._targetDatabaseNames[index]));
					flexContainer.addItem(createInformationRow(this._view, constants.TARGET_NETWORK_SHARE_LOCATION(db), this.migrationStateModel._databaseBackup.networkShareLocations[index]));
				});
				break;
			case NetworkContainerType.FILE_SHARE:
				flexContainer.addItems(
					[
						createInformationRow(this._view, constants.TYPE, constants.FILE_SHARE),
						createInformationRow(this._view, constants.SUMMARY_AZURE_STORAGE_SUBSCRIPTION, this.migrationStateModel._databaseBackup.subscription.name),
						createInformationRow(this._view, constants.SUMMARY_AZURE_STORAGE, this.migrationStateModel._databaseBackup.storageAccount.name),
					]
				);
				this.migrationStateModel._migrationDbs.forEach((db, index) => {
					flexContainer.addItem(createInformationRow(this._view, constants.TARGET_NAME_FOR_DATABASE(db), this.migrationStateModel._targetDatabaseNames[index]));
					flexContainer.addItem(createInformationRow(this._view, constants.TARGET_FILE_SHARE(db), this.migrationStateModel._databaseBackup.fileShares[index].name));
				});
				break;
			case NetworkContainerType.BLOB_CONTAINER:
				flexContainer.addItems(
					[
						createInformationRow(this._view, constants.TYPE, constants.BLOB_CONTAINER),
						createInformationRow(this._view, constants.SUMMARY_AZURE_STORAGE_SUBSCRIPTION, this.migrationStateModel._databaseBackup.subscription.name),
						createInformationRow(this._view, constants.SUMMARY_AZURE_STORAGE, this.migrationStateModel._databaseBackup.storageAccount.name),
					]
				);
				this.migrationStateModel._migrationDbs.forEach((db, index) => {
					flexContainer.addItem(createInformationRow(this._view, constants.TARGET_NAME_FOR_DATABASE(db), this.migrationStateModel._targetDatabaseNames[index]));
					flexContainer.addItem(createInformationRow(this._view, constants.TARGET_FILE_SHARE(db), this.migrationStateModel._databaseBackup.blobContainers[index].name));
				});
		}
		return flexContainer;
	}
}
