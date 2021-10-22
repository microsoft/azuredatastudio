/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationMode, MigrationStateModel, MigrationTargetType, NetworkContainerType, NetworkShare, Page, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { createHeadingTextComponent, createInformationRow, createLabelTextComponent } from './wizardController';
import { getResourceGroupFromId, Subscription } from '../api/azure';
import { TargetDatabaseSummaryDialog } from '../dialog/targetDatabaseSummary/targetDatabaseSummaryDialog';
import * as styles from '../constants/styles';
import { azureResource } from 'azureResource';
import { Tenant } from 'azurecore';

export class SummaryPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _flexContainer!: azdata.FlexContainer;
	private _disposables: vscode.Disposable[] = [];

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

		this._disposables.push(this._view.onClosed(e => {
			this._disposables.forEach(
				d => { try { d.dispose(); } catch { } });
		}));

		await view.initializeModel(form.component());
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.Summary) {
			this.migrationStateModel._databaseBackup.networkContainerType = <NetworkContainerType>this.migrationStateModel.savedInfo.networkContainerType;
			this.migrationStateModel._databaseBackup.networkShare = <NetworkShare>this.migrationStateModel.savedInfo.networkShare;
			this.migrationStateModel._databaseBackup.subscription = <Subscription>this.migrationStateModel.savedInfo.targetSubscription;
			this.migrationStateModel._databaseBackup.blobs = this.migrationStateModel.savedInfo.blobs;
			this.migrationStateModel._targetDatabaseNames = this.migrationStateModel.savedInfo.targetDatabaseNames;

			this.migrationStateModel._targetType = <MigrationTargetType>this.migrationStateModel.savedInfo.migrationTargetType;
			this.migrationStateModel._databaseAssessment = <string[]>this.migrationStateModel.savedInfo.databaseAssessment;
			this.migrationStateModel._migrationDbs = this.migrationStateModel.savedInfo.databaseList;
			this.migrationStateModel._targetSubscription = <azureResource.AzureResourceSubscription>this.migrationStateModel.savedInfo.subscription;
			this.migrationStateModel._location = <azureResource.AzureLocation>this.migrationStateModel.savedInfo.location;
			this.migrationStateModel._resourceGroup = <azureResource.AzureResourceResourceGroup>this.migrationStateModel.savedInfo.resourceGroup;
			this.migrationStateModel._targetServerInstance = <azureResource.AzureSqlManagedInstance>this.migrationStateModel.savedInfo.targetServerInstance;

			this.migrationStateModel.databaseSelectorTableValues = this.migrationStateModel.savedInfo.selectedDatabases;

			this.migrationStateModel._azureAccount = <azdata.Account>this.migrationStateModel.savedInfo.azureAccount;
			this.migrationStateModel._azureTenant = <Tenant>this.migrationStateModel.savedInfo.azureTenant;
		}
		const targetDatabaseSummary = new TargetDatabaseSummaryDialog(this.migrationStateModel);
		const targetDatabaseHyperlink = this._view.modelBuilder.hyperlink().withProps({
			url: '',
			label: this.migrationStateModel._migrationDbs.length.toString(),
			CSSStyles: {
				...styles.BODY_CSS,
				'margin': '0px',
				'width': '300px',
			}
		}).component();

		this._disposables.push(targetDatabaseHyperlink.onDidClick(async e => {
			await targetDatabaseSummary.initialize();
		}));

		const targetDatabaseRow = this._view.modelBuilder.flexContainer()
			.withLayout(
				{
					flexFlow: 'row',
					alignItems: 'center',
				})
			.withItems(
				[
					createLabelTextComponent(this._view, constants.SUMMARY_DATABASE_COUNT_LABEL,
						{
							...styles.BODY_CSS,
							'width': '300px',
						}
					),
					targetDatabaseHyperlink
				],
				{
					CSSStyles: {
						'margin-right': '5px'
					}
				})
			.component();

		this._flexContainer.addItems(
			[
				await createHeadingTextComponent(this._view, constants.ACCOUNTS_SELECTION_PAGE_TITLE, true),
				createInformationRow(this._view, constants.ACCOUNTS_SELECTION_PAGE_TITLE, this.migrationStateModel._azureAccount.displayInfo.displayName),

				await createHeadingTextComponent(this._view, constants.SOURCE_DATABASES),
				targetDatabaseRow,

				await createHeadingTextComponent(this._view, constants.SKU_RECOMMENDATION_PAGE_TITLE),
				createInformationRow(this._view, constants.SKU_RECOMMENDATION_PAGE_TITLE, (this.migrationStateModel._targetType === MigrationTargetType.SQLVM) ? constants.SUMMARY_VM_TYPE : constants.SUMMARY_MI_TYPE),
				createInformationRow(this._view, constants.SUBSCRIPTION, this.migrationStateModel._targetSubscription.name),
				createInformationRow(this._view, constants.LOCATION, await this.migrationStateModel.getLocationDisplayName(this.migrationStateModel._targetServerInstance.location)),
				createInformationRow(this._view, constants.RESOURCE_GROUP, getResourceGroupFromId(this.migrationStateModel._targetServerInstance.id)),
				createInformationRow(this._view, (this.migrationStateModel._targetType === MigrationTargetType.SQLVM) ? constants.SUMMARY_VM_TYPE : constants.SUMMARY_MI_TYPE, await this.migrationStateModel.getLocationDisplayName(this.migrationStateModel._targetServerInstance.name!)),

				await createHeadingTextComponent(this._view, constants.DATABASE_BACKUP_MIGRATION_MODE_LABEL),
				createInformationRow(this._view, constants.MODE, this.migrationStateModel._databaseBackup.migrationMode === MigrationMode.ONLINE ? constants.DATABASE_BACKUP_MIGRATION_MODE_ONLINE_LABEL : constants.DATABASE_BACKUP_MIGRATION_MODE_OFFLINE_LABEL),

				await createHeadingTextComponent(this._view, constants.DATABASE_BACKUP_PAGE_TITLE),
				await this.createNetworkContainerRows(),

				await createHeadingTextComponent(this._view, constants.IR_PAGE_TITLE),
				createInformationRow(this._view, constants.SUBSCRIPTION, this.migrationStateModel._targetSubscription.name),
				createInformationRow(this._view, constants.LOCATION, this.migrationStateModel._sqlMigrationService?.location!),
				createInformationRow(this._view, constants.RESOURCE_GROUP, this.migrationStateModel._sqlMigrationService?.properties?.resourceGroup!),
				createInformationRow(this._view, constants.IR_PAGE_TITLE, this.migrationStateModel._sqlMigrationService?.name!)
			]
		);

		if (this.migrationStateModel._databaseBackup.networkContainerType === NetworkContainerType.NETWORK_SHARE && this.migrationStateModel._nodeNames?.length > 0) {
			this._flexContainer.addItem(createInformationRow(this._view, constants.SHIR, this.migrationStateModel._nodeNames.join(', ')));
		}
	}

	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
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
						await createHeadingTextComponent(this._view, constants.AZURE_STORAGE_ACCOUNT_TO_UPLOAD_BACKUPS),
						createInformationRow(this._view, constants.SUBSCRIPTION, this.migrationStateModel._databaseBackup.subscription.name),
						createInformationRow(this._view, constants.LOCATION, this.migrationStateModel._databaseBackup.networkShare.storageAccount.location),
						createInformationRow(this._view, constants.RESOURCE_GROUP, this.migrationStateModel._databaseBackup.networkShare.storageAccount.resourceGroup!),
						createInformationRow(this._view, constants.STORAGE_ACCOUNT, this.migrationStateModel._databaseBackup.networkShare.storageAccount.name!),
					]
				);
				break;
			case NetworkContainerType.BLOB_CONTAINER:
				flexContainer.addItems(
					[
						createInformationRow(this._view, constants.TYPE, constants.BLOB_CONTAINER),
						//databasebackup.subscription is null
						createInformationRow(this._view, constants.SUMMARY_AZURE_STORAGE_SUBSCRIPTION, this.migrationStateModel._databaseBackup.subscription.name)
					]
				);
		}
		return flexContainer;
	}
}
