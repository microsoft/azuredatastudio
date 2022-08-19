/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../constants/iconPathHelper';
import * as loc from '../constants/strings';
import { convertByteSizeToReadableUnit, convertIsoTimeToLocalTime, getSqlServerName, getMigrationStatusImage } from '../api/utils';
import { logError, TelemetryViews } from '../telemtery';
import * as styles from '../constants/styles';
import { canCancelMigration, canCutoverMigration, canRetryMigration, getMigrationStatusString, getMigrationTargetTypeEnum, isOfflineMigation } from '../constants/helper';
import { getResourceName } from '../api/azure';
import { EmptySettingValue } from './tabBase';
import { InfoFieldSchema, infoFieldWidth, MigrationDetailsTabBase, MigrationTargetTypeName } from './migrationDetailsTabBase';
import { DashboardStatusBar } from './DashboardStatusBar';

const MigrationDetailsFileShareTabId = 'MigrationDetailsFileShareTab';

interface ActiveBackupFileSchema {
	fileName: string,
	type: string,
	status: string,
	dataUploaded: string,
	copyThroughput: string,
	backupStartTime: string,
	firstLSN: string,
	lastLSN: string
}

export class MigrationDetailsFileShareTab extends MigrationDetailsTabBase<MigrationDetailsFileShareTab> {
	private _sourceDatabaseInfoField!: InfoFieldSchema;
	private _sourceDetailsInfoField!: InfoFieldSchema;
	private _sourceVersionInfoField!: InfoFieldSchema;
	private _targetDatabaseInfoField!: InfoFieldSchema;
	private _targetServerInfoField!: InfoFieldSchema;
	private _targetVersionInfoField!: InfoFieldSchema;
	private _migrationStatusInfoField!: InfoFieldSchema;
	private _fullBackupFileOnInfoField!: InfoFieldSchema;
	private _backupLocationInfoField!: InfoFieldSchema;
	private _lastLSNInfoField!: InfoFieldSchema;
	private _lastAppliedBackupInfoField!: InfoFieldSchema;
	private _lastAppliedBackupTakenOnInfoField!: InfoFieldSchema;
	private _currentRestoringFileInfoField!: InfoFieldSchema;
	private _fileCount!: azdata.TextComponent;
	private _fileTable!: azdata.TableComponent;
	private _emptyTableFill!: azdata.FlexContainer;

	constructor() {
		super();
		this.id = MigrationDetailsFileShareTabId;
	}

	public async create(
		context: vscode.ExtensionContext,
		view: azdata.ModelView,
		openMigrationsListFcn: () => Promise<void>,
		statusBar: DashboardStatusBar): Promise<MigrationDetailsFileShareTab> {

		this.view = view;
		this.context = context;
		this.openMigrationsListFcn = openMigrationsListFcn;
		this.statusBar = statusBar;

		await this.initialize(this.view);

		return this;
	}

	public async refresh(): Promise<void> {
		if (this.isRefreshing ||
			this.refreshLoader === undefined ||
			this.model?.migration === undefined) {

			return;
		}

		try {
			this.isRefreshing = true;
			this.refreshLoader.loading = true;
			await this.statusBar.clearError();
			await this._fileTable.updateProperty('data', []);

			await this.model.fetchStatus();

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

			let lastAppliedSSN: string;
			let lastAppliedBackupFileTakenOn: string;

			const tableData: ActiveBackupFileSchema[] = [];
			migration.properties.migrationStatusDetails?.activeBackupSets?.forEach(
				(activeBackupSet) => {
					tableData.push(
						...activeBackupSet.listOfBackupFiles.map(f => {
							return {
								fileName: f.fileName,
								type: activeBackupSet.backupType,
								status: f.status,
								dataUploaded: `${convertByteSizeToReadableUnit(f.dataWritten)} / ${convertByteSizeToReadableUnit(f.totalSize)}`,
								copyThroughput: (f.copyThroughput) ? (f.copyThroughput / 1024).toFixed(2) : EmptySettingValue,
								backupStartTime: activeBackupSet.backupStartDate,
								firstLSN: activeBackupSet.firstLSN,
								lastLSN: activeBackupSet.lastLSN
							};
						})
					);

					if (activeBackupSet.listOfBackupFiles[0].fileName === migration.properties.migrationStatusDetails?.lastRestoredFilename) {
						lastAppliedSSN = activeBackupSet.lastLSN;
						lastAppliedBackupFileTakenOn = activeBackupSet.backupFinishDate;
					}
				});

			this.databaseLabel.value = sourceDatabaseName;
			this._sourceDatabaseInfoField.text.value = sourceDatabaseName;
			this._sourceDetailsInfoField.text.value = sqlServerName;
			this._sourceVersionInfoField.text.value = `${sqlServerVersion} ${sqlServerInfo.serverVersion}`;

			this._targetDatabaseInfoField.text.value = targetDatabaseName;
			this._targetServerInfoField.text.value = targetServerName;
			this._targetVersionInfoField.text.value = targetServerVersion;

			this._migrationStatusInfoField.text.value = getMigrationStatusString(migration);
			this._migrationStatusInfoField.icon!.iconPath = getMigrationStatusImage(migration);

			this._fullBackupFileOnInfoField.text.value = migration?.properties?.migrationStatusDetails?.fullBackupSetInfo?.listOfBackupFiles[0]?.fileName! ?? EmptySettingValue;

			const fileShare = migration.properties.backupConfiguration?.sourceLocation?.fileShare;
			const backupLocation = fileShare?.path! ?? EmptySettingValue;
			this._backupLocationInfoField.text.value = backupLocation ?? EmptySettingValue;

			this._lastLSNInfoField.text.value = lastAppliedSSN! ?? EmptySettingValue;
			this._lastAppliedBackupInfoField.text.value = migration.properties.migrationStatusDetails?.lastRestoredFilename ?? EmptySettingValue;
			this._lastAppliedBackupTakenOnInfoField.text.value = lastAppliedBackupFileTakenOn! ? convertIsoTimeToLocalTime(lastAppliedBackupFileTakenOn).toLocaleString() : EmptySettingValue;
			this._currentRestoringFileInfoField.text.value = this.getMigrationCurrentlyRestoringFile(migration) ?? EmptySettingValue;

			await this._fileCount.updateCssStyles({ ...styles.SECTION_HEADER_CSS, display: 'inline' });

			this._fileCount.value = loc.ACTIVE_BACKUP_FILES_ITEMS(tableData.length);
			if (tableData.length === 0) {
				await this._emptyTableFill.updateCssStyles({ 'display': 'flex' });
				this._fileTable.height = '50px';
				await this._fileTable.updateProperty('data', []);
			} else {
				await this._emptyTableFill.updateCssStyles({ 'display': 'none' });
				this._fileTable.height = '300px';

				// Sorting files in descending order of backupStartTime
				tableData.sort((file1, file2) => new Date(file1.backupStartTime) > new Date(file2.backupStartTime) ? - 1 : 1);
			}

			const data = tableData.map(row => [
				row.fileName,
				row.type,
				row.status,
				row.dataUploaded,
				row.copyThroughput,
				convertIsoTimeToLocalTime(row.backupStartTime).toLocaleString(),
				row.firstLSN,
				row.lastLSN
			]) || [];

			await this._fileTable.updateProperty('data', data);

			this.cutoverButton.enabled = canCutoverMigration(migration);
			this.cancelButton.enabled = canCancelMigration(migration);
			this.retryButton.enabled = canRetryMigration(migration);
		} catch (e) {
			await this.statusBar.showError(
				loc.MIGRATION_STATUS_REFRESH_ERROR,
				loc.MIGRATION_STATUS_REFRESH_ERROR,
				e.message);
		} finally {
			this.refreshLoader.loading = false;
			this.isRefreshing = false;
		}
	}

	protected async initialize(view: azdata.ModelView): Promise<void> {
		try {
			this._fileCount = this.view.modelBuilder.text()
				.withProps({
					width: '500px',
					CSSStyles: { ...styles.BODY_CSS }
				}).component();

			this._fileTable = this.view.modelBuilder.table()
				.withProps({
					ariaLabel: loc.ACTIVE_BACKUP_FILES,
					CSSStyles: { 'padding-left': '0px', 'max-width': '1020px' },
					data: [],
					height: '300px',
					columns: [
						{
							value: 'files',
							name: loc.ACTIVE_BACKUP_FILES,
							type: azdata.ColumnType.text,
							width: 230,
						},
						{
							value: 'type',
							name: loc.TYPE,
							width: 90,
							type: azdata.ColumnType.text,
						},
						{
							value: 'status',
							name: loc.STATUS,
							width: 60,
							type: azdata.ColumnType.text,
						},
						{
							value: 'uploaded',
							name: loc.DATA_UPLOADED,
							width: 120,
							type: azdata.ColumnType.text,
						},
						{
							value: 'throughput',
							name: loc.COPY_THROUGHPUT,
							width: 150,
							type: azdata.ColumnType.text,
						},
						{
							value: 'starttime',
							name: loc.BACKUP_START_TIME,
							width: 130,
							type: azdata.ColumnType.text,
						},
						{
							value: 'firstlsn',
							name: loc.FIRST_LSN,
							width: 120,
							type: azdata.ColumnType.text,
						},
						{
							value: 'lastlsn',
							name: loc.LAST_LSN,
							width: 120,
							type: azdata.ColumnType.text,
						}
					],
				}).component();

			const emptyTableImage = this.view.modelBuilder.image()
				.withProps({
					iconPath: IconPathHelper.emptyTable,
					iconHeight: '100px',
					iconWidth: '100px',
					height: '100px',
					width: '100px',
					CSSStyles: { 'text-align': 'center' }
				}).component();

			const emptyTableText = this.view.modelBuilder.text()
				.withProps({
					value: loc.EMPTY_TABLE_TEXT,
					CSSStyles: {
						...styles.NOTE_CSS,
						'margin-top': '8px',
						'text-align': 'center',
						'width': '300px'
					}
				}).component();

			this._emptyTableFill = this.view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'column',
					alignItems: 'center'
				}).withItems([
					emptyTableImage,
					emptyTableText,
				]).withProps({
					width: '100%',
					display: 'none'
				}).component();

			const formItems: azdata.FormComponent<azdata.Component>[] = [
				{ component: this.createMigrationToolbarContainer() },
				{ component: await this.migrationInfoGrid() },
				{
					component: this.view.modelBuilder.separator()
						.withProps({ width: '100%', CSSStyles: { 'padding': '0' } })
						.component()
				},
				{ component: this._fileCount },
				{ component: this._fileTable },
				{ component: this._emptyTableFill }
			];

			const formContainer = this.view.modelBuilder.formContainer()
				.withFormItems(
					formItems,
					{ horizontal: false })
				.withLayout({ width: '100%', padding: '0 0 0 15px' })
				.withProps({ width: '100%', CSSStyles: { padding: '0 0 0 15px' } })
				.component();

			this.content = formContainer;
		} catch (e) {
			logError(TelemetryViews.MigrationCutoverDialog, 'IntializingFailed', e);
		}
	}

	protected async migrationInfoGrid(): Promise<azdata.FlexContainer> {
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
		this._fullBackupFileOnInfoField = await this.createInfoField(loc.FULL_BACKUP_FILES, '', false);
		this._backupLocationInfoField = await this.createInfoField(loc.BACKUP_LOCATION, '');
		addInfoFieldToContainer(this._migrationStatusInfoField, flexStatus);
		addInfoFieldToContainer(this._fullBackupFileOnInfoField, flexStatus);
		addInfoFieldToContainer(this._backupLocationInfoField, flexStatus);

		const flexFile = this.view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.component();
		this._lastLSNInfoField = await this.createInfoField(loc.LAST_APPLIED_LSN, '', false);
		this._lastAppliedBackupInfoField = await this.createInfoField(loc.LAST_APPLIED_BACKUP_FILES, '');
		this._lastAppliedBackupTakenOnInfoField = await this.createInfoField(loc.LAST_APPLIED_BACKUP_FILES_TAKEN_ON, '', false);
		this._currentRestoringFileInfoField = await this.createInfoField(loc.CURRENTLY_RESTORING_FILE, '', false);
		addInfoFieldToContainer(this._lastLSNInfoField, flexFile);
		addInfoFieldToContainer(this._lastAppliedBackupInfoField, flexFile);
		addInfoFieldToContainer(this._lastAppliedBackupTakenOnInfoField, flexFile);
		addInfoFieldToContainer(this._currentRestoringFileInfoField, flexFile);

		const flexInfoProps = {
			flex: '0',
			CSSStyles: {
				'flex': '0',
				'width': infoFieldWidth
			}
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
