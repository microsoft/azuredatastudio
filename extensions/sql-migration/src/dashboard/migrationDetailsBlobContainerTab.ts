/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../constants/strings';
import { getSqlServerName, getMigrationStatusImage } from '../api/utils';
import { logError, TelemetryViews } from '../telemtery';
import { canCancelMigration, canCutoverMigration, canRetryMigration, getMigrationStatus, getMigrationTargetTypeEnum, isOfflineMigation } from '../constants/helper';
import { getResourceName } from '../api/azure';
import { InfoFieldSchema, infoFieldWidth, MigrationDetailsTabBase, MigrationTargetTypeName } from './migrationDetailsTabBase';
import { EmptySettingValue } from './tabBase';
import { DashboardStatusBar } from './sqlServerDashboard';

const MigrationDetailsBlobContainerTabId = 'MigrationDetailsBlobContainerTab';

export class MigrationDetailsBlobContainerTab extends MigrationDetailsTabBase<MigrationDetailsBlobContainerTab> {
	private _sourceDatabaseInfoField!: InfoFieldSchema;
	private _sourceDetailsInfoField!: InfoFieldSchema;
	private _sourceVersionInfoField!: InfoFieldSchema;
	private _targetDatabaseInfoField!: InfoFieldSchema;
	private _targetServerInfoField!: InfoFieldSchema;
	private _targetVersionInfoField!: InfoFieldSchema;
	private _migrationStatusInfoField!: InfoFieldSchema;
	private _backupLocationInfoField!: InfoFieldSchema;
	private _lastAppliedBackupInfoField!: InfoFieldSchema;
	private _currentRestoringFileInfoField!: InfoFieldSchema;

	constructor() {
		super();
		this.id = MigrationDetailsBlobContainerTabId;
	}

	public async create(
		context: vscode.ExtensionContext,
		view: azdata.ModelView,
		onClosedCallback: () => Promise<void>,
		statusBar: DashboardStatusBar,
	): Promise<MigrationDetailsBlobContainerTab> {

		this.view = view;
		this.context = context;
		this.onClosedCallback = onClosedCallback;
		this.statusBar = statusBar;

		await this.initialize(this.view);

		return this;
	}

	public async refresh(): Promise<void> {
		if (this.isRefreshing || this.model?.migration === undefined) {
			return;
		}

		this.isRefreshing = true;
		this.refreshButton.enabled = false;
		this.refreshLoader.loading = true;
		await this.statusBar.clearError();

		try {
			await this.model.fetchStatus();
		} catch (e) {
			await this.statusBar.showError(
				loc.MIGRATION_STATUS_REFRESH_ERROR,
				loc.MIGRATION_STATUS_REFRESH_ERROR,
				e.message);
		}

		const migration = this.model?.migration;
		await this.cutoverButton.updateCssStyles(
			{ 'display': isOfflineMigation(migration) ? 'none' : 'block' });

		await this.showMigrationErrors(migration);

		const sqlServerName = migration.properties.sourceServerName;
		const sourceDatabaseName = migration.properties.sourceDatabaseName;
		const sqlServerInfo = await azdata.connection.getServerInfo((await azdata.connection.getCurrentConnection()).connectionId);
		const versionName = getSqlServerName(sqlServerInfo.serverMajorVersion!);
		const sqlServerVersion = versionName ? versionName : sqlServerInfo.serverVersion;
		const targetDatabaseName = migration.name;
		const targetServerName = getResourceName(migration.properties.scope);

		const targetType = getMigrationTargetTypeEnum(migration);
		const targetServerVersion = MigrationTargetTypeName[targetType ?? ''];

		this.databaseLabel.value = sourceDatabaseName;
		this._sourceDatabaseInfoField.text.value = sourceDatabaseName;
		this._sourceDetailsInfoField.text.value = sqlServerName;
		this._sourceVersionInfoField.text.value = `${sqlServerVersion} ${sqlServerInfo.serverVersion}`;

		this._targetDatabaseInfoField.text.value = targetDatabaseName;
		this._targetServerInfoField.text.value = targetServerName;
		this._targetVersionInfoField.text.value = targetServerVersion;

		this._migrationStatusInfoField.text.value = getMigrationStatus(migration) ?? EmptySettingValue;
		this._migrationStatusInfoField.icon!.iconPath = getMigrationStatusImage(migration);

		const storageAccountResourceId = migration.properties.backupConfiguration?.sourceLocation?.azureBlob?.storageAccountResourceId;
		const blobContainerName
			= migration.properties.backupConfiguration?.sourceLocation?.azureBlob?.blobContainerName
			?? migration.properties.migrationStatusDetails?.blobContainerName;

		const backupLocation = storageAccountResourceId && blobContainerName
			? `${storageAccountResourceId?.split('/').pop()} - ${blobContainerName}`
			: blobContainerName;
		this._backupLocationInfoField.text.value = backupLocation ?? EmptySettingValue;
		this._lastAppliedBackupInfoField.text.value = migration.properties.migrationStatusDetails?.lastRestoredFilename ?? EmptySettingValue;
		this._currentRestoringFileInfoField.text.value = this.getMigrationCurrentlyRestoringFile(migration) ?? EmptySettingValue;

		this.cutoverButton.enabled = canCutoverMigration(migration);
		this.cancelButton.enabled = canCancelMigration(migration);
		this.retryButton.enabled = canRetryMigration(migration);

		this.isRefreshing = false;
		this.refreshLoader.loading = false;
		this.refreshButton.enabled = true;
	}

	protected async initialize(view: azdata.ModelView): Promise<void> {
		try {
			const formItems: azdata.FormComponent<azdata.Component>[] = [
				{ component: this.createMigrationToolbarContainer() },
				{ component: await this.migrationInfoGrid() },
				{
					component: this.view.modelBuilder.separator()
						.withProps({ width: '100%', CSSStyles: { 'padding': '0' } })
						.component()
				},
			];

			this.content = this.view.modelBuilder.formContainer()
				.withFormItems(
					formItems,
					{ horizontal: false })
				.withLayout({ width: '100%', padding: '0 0 0 15px' })
				.withProps({ width: '100%', CSSStyles: { padding: '0 0 0 15px' } })
				.component();
		} catch (e) {
			logError(TelemetryViews.MigrationCutoverDialog, 'IntializingFailed', e);
		}
	}

	protected override async migrationInfoGrid(): Promise<azdata.FlexContainer> {
		const addInfoFieldToContainer = (infoField: InfoFieldSchema, container: azdata.FlexContainer): void => {
			container.addItem(
				infoField.flexContainer,
				{ CSSStyles: { width: infoFieldWidth } });
		};

		const flexServer = this.view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.component();
		this._sourceDatabaseInfoField = await this.createInfoField(loc.SOURCE_DATABASE, '');
		this._sourceDetailsInfoField = await this.createInfoField(loc.SOURCE_SERVER, '');
		this._sourceVersionInfoField = await this.createInfoField(loc.SOURCE_VERSION, '');
		addInfoFieldToContainer(this._sourceDatabaseInfoField, flexServer);
		addInfoFieldToContainer(this._sourceDetailsInfoField, flexServer);
		addInfoFieldToContainer(this._sourceVersionInfoField, flexServer);

		const flexTarget = this.view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.component();
		this._targetDatabaseInfoField = await this.createInfoField(loc.TARGET_DATABASE_NAME, '');
		this._targetServerInfoField = await this.createInfoField(loc.TARGET_SERVER, '');
		this._targetVersionInfoField = await this.createInfoField(loc.TARGET_VERSION, '');
		addInfoFieldToContainer(this._targetDatabaseInfoField, flexTarget);
		addInfoFieldToContainer(this._targetServerInfoField, flexTarget);
		addInfoFieldToContainer(this._targetVersionInfoField, flexTarget);

		const flexStatus = this.view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.component();
		this._migrationStatusInfoField = await this.createInfoField(loc.MIGRATION_STATUS, '', false, ' ');
		this._backupLocationInfoField = await this.createInfoField(loc.BACKUP_LOCATION, '');
		addInfoFieldToContainer(this._migrationStatusInfoField, flexStatus);
		addInfoFieldToContainer(this._backupLocationInfoField, flexStatus);

		const flexFile = this.view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.component();
		this._lastAppliedBackupInfoField = await this.createInfoField(loc.LAST_APPLIED_BACKUP_FILES, '');
		this._currentRestoringFileInfoField = await this.createInfoField(loc.CURRENTLY_RESTORING_FILE, '', false);
		addInfoFieldToContainer(this._lastAppliedBackupInfoField, flexFile);
		addInfoFieldToContainer(this._currentRestoringFileInfoField, flexFile);

		const flexInfoProps = {
			flex: '0',
			CSSStyles: { 'flex': '0', 'width': infoFieldWidth }
		};

		const flexInfo = this.view.modelBuilder.flexContainer()
			.withLayout({ flexWrap: 'wrap' })
			.withProps({ width: '100%' })
			.component();
		flexInfo.addItem(flexServer, flexInfoProps);
		flexInfo.addItem(flexTarget, flexInfoProps);
		flexInfo.addItem(flexStatus, flexInfoProps);
		flexInfo.addItem(flexFile, flexInfoProps);

		return flexInfo;
	}
}
