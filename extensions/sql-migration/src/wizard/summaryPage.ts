/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationMode, MigrationStateModel, MigrationTargetType, NetworkContainerType, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { createHeadingTextComponent, createInformationRow } from './wizardController';
import { getResourceGroupFromId } from '../api/azure';

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
				createHeadingTextComponent(this._view, constants.ACCOUNTS_SELECTION_PAGE_TITLE),
				createInformationRow(this._view, constants.ACCOUNTS_SELECTION_PAGE_TITLE, this.migrationStateModel._azureAccount.displayInfo.displayName),

				createHeadingTextComponent(this._view, constants.SOURCE_DATABASES),
				createInformationRow(this._view, constants.SUMMARY_DATABASE_COUNT_LABEL, this.migrationStateModel._migrationDbs.length.toString()),

				createHeadingTextComponent(this._view, constants.SKU_RECOMMENDATION_PAGE_TITLE),
				createInformationRow(this._view, constants.SKU_RECOMMENDATION_PAGE_TITLE, (this.migrationStateModel._targetType === MigrationTargetType.SQLVM) ? constants.SUMMARY_VM_TYPE : constants.SUMMARY_MI_TYPE),
				createInformationRow(this._view, constants.SUBSCRIPTION, this.migrationStateModel._targetSubscription.name),
				createInformationRow(this._view, constants.LOCATION, await this.migrationStateModel.getLocationDisplayName(this.migrationStateModel._targetServerInstance.location)),
				createInformationRow(this._view, constants.RESOURCE_GROUP, getResourceGroupFromId(this.migrationStateModel._targetServerInstance.id)),
				createInformationRow(this._view, (this.migrationStateModel._targetType === MigrationTargetType.SQLVM) ? constants.SUMMARY_VM_TYPE : constants.SUMMARY_MI_TYPE, await this.migrationStateModel.getLocationDisplayName(this.migrationStateModel._targetServerInstance.name!)),

				createHeadingTextComponent(this._view, constants.DATABASE_BACKUP_MIGRATION_MODE_LABEL),
				createInformationRow(this._view, constants.MODE, this.migrationStateModel._databaseBackup.migrationMode === MigrationMode.ONLINE ? constants.DATABASE_BACKUP_MIGRATION_MODE_ONLINE_LABEL : constants.DATABASE_BACKUP_MIGRATION_MODE_OFFLINE_LABEL),

				createHeadingTextComponent(this._view, constants.DATABASE_BACKUP_PAGE_TITLE),
				await this.createNetworkContainerRows(),

				createHeadingTextComponent(this._view, constants.IR_PAGE_TITLE),
				createInformationRow(this._view, constants.SUBSCRIPTION, this.migrationStateModel._targetSubscription.name),
				createInformationRow(this._view, constants.LOCATION, this.migrationStateModel._sqlMigrationService.location),
				createInformationRow(this._view, constants.SUBSCRIPTION, this.migrationStateModel._sqlMigrationService.properties.resourceGroup),
				createInformationRow(this._view, constants.IR_PAGE_TITLE, this.migrationStateModel._targetSubscription.name),
				createInformationRow(this._view, constants.SUBSCRIPTION, this.migrationStateModel._sqlMigrationService.name),
				createInformationRow(this._view, constants.SHIR, this.migrationStateModel._nodeNames[0]),
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

	private async createNetworkContainerRows(): Promise<azdata.FlexContainer> {
		const flexContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();
		switch (this.migrationStateModel._databaseBackup.networkContainerType) {
			case NetworkContainerType.NETWORK_SHARE:
				flexContainer.addItems(
					[
						createInformationRow(this._view, constants.BACKUP_LOCATION, constants.NETWORK_SHARE),
						createInformationRow(this._view, constants.NETWORK_SHARE, this.migrationStateModel._databaseBackup.networkShare.networkShareLocation),
						createInformationRow(this._view, constants.USER_ACCOUNT, this.migrationStateModel._databaseBackup.networkShare.windowsUser),
						createHeadingTextComponent(this._view, constants.AZURE_STORAGE_ACCOUNT_TO_UPLOAD_BACKUPS),
						createInformationRow(this._view, constants.SUBSCRIPTION, this.migrationStateModel._databaseBackup.subscription.name),
						createInformationRow(this._view, constants.LOCATION, this.migrationStateModel._databaseBackup.networkShare.storageAccount.location),
						createInformationRow(this._view, constants.RESOURCE_GROUP, this.migrationStateModel._databaseBackup.networkShare.storageAccount.resourceGroup!),
						createInformationRow(this._view, constants.STORAGE_ACCOUNT, this.migrationStateModel._databaseBackup.networkShare.storageAccount.name!),
					]
				);
				break;
			case NetworkContainerType.FILE_SHARE:
				flexContainer.addItems(
					[
						createInformationRow(this._view, constants.TYPE, constants.FILE_SHARE),
						createInformationRow(this._view, constants.SUMMARY_AZURE_STORAGE_SUBSCRIPTION, this.migrationStateModel._databaseBackup.subscription.name),
					]
				);
				break;
			case NetworkContainerType.BLOB_CONTAINER:
				flexContainer.addItems(
					[
						createInformationRow(this._view, constants.TYPE, constants.BLOB_CONTAINER),
						createInformationRow(this._view, constants.SUMMARY_AZURE_STORAGE_SUBSCRIPTION, this.migrationStateModel._databaseBackup.subscription.name),
						createInformationRow(this._view, constants.LOCATION, this.migrationStateModel._databaseBackup.blob.storageAccount.location),
						createInformationRow(this._view, constants.RESOURCE_GROUP, this.migrationStateModel._databaseBackup.blob.storageAccount.resourceGroup!),
						createInformationRow(this._view, constants.SUMMARY_AZURE_STORAGE, this.migrationStateModel._databaseBackup.blob.storageAccount.name),
						createInformationRow(this._view, constants.BLOB_CONTAINER, this.migrationStateModel._databaseBackup.blob.blobContainer.name)
					]
				);
		}
		flexContainer.addItem(createHeadingTextComponent(this._view, constants.TARGET_NAME));
		this.migrationStateModel._migrationDbs.forEach((db, index) => {
			flexContainer.addItem(createInformationRow(this._view, db, this.migrationStateModel._targetDatabaseNames[index]));
		});
		return flexContainer;
	}
}
