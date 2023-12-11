/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../constants/iconPathHelper';
import * as loc from '../constants/strings';
import { convertByteSizeToReadableUnit, convertIsoTimeToLocalTime, getMigrationStatusImage } from '../api/utils';
import { logError, TelemetryViews } from '../telemetry';
import * as styles from '../constants/styles';
import { canCancelMigration, canCutoverMigration, canDeleteMigration, canRestartMigrationWizard, getMigrationStatusString, getMigrationTargetTypeEnum, isOfflineMigation, isShirMigration } from '../constants/helper';
import { AzureResourceKind, DatabaseMigration, getResourceName } from '../api/azure';
import * as utils from '../api/utils';
import * as helper from '../constants/helper';
import { EmptySettingValue } from './tabBase';
import { InfoFieldSchema, MigrationDetailsTabBase, MigrationTargetTypeName } from './migrationDetailsTabBase';
import { DashboardStatusBar } from './DashboardStatusBar';

const MigrationDetailsTabId = 'MigrationDetailsTab';

const enum BackupFileColumnIndex {
	backupFileName = 0,
	backupType = 1,
	backupStatus = 2,
	restoreStatus = 3,
	backupSizeMB = 4,
	numberOfStripes = 5,
	dataUploadRate = 6,
	throughput = 7,
	backupStartTime = 8,
	restoreStartDate = 9,
	restoreFinishDate = 10,
	firstLsn = 11,
	lastLsn = 12,
}

interface ActiveBackupFileSchema {
	backupFileName: string,
	backupType: string,

	// SHIR provided
	backupStatus: string,
	dataUploaded: string,       // SHIR provided
	dataUploadRate: string,     // SHIR provided
	backupStartTime: string,    // SHIR provided
	firstLSN: string,           // SHIR provided
	lastLSN: string,            // SHIR provided

	// SQLMI provided
	restoreStartDate: string,	// SQLMI provided
	restoreFinishDate: string,	// SQLMI provided
	restoreStatus: string,		// SQLMI provided
	backupSizeMB: string,		// SQLMI provided
	numberOfStripes: number,	// SQLMI provided
}

export class MigrationDetailsTab extends MigrationDetailsTabBase<MigrationDetailsTab> {
	private _sourceDatabaseInfoField!: InfoFieldSchema;
	private _sourceDetailsInfoField!: InfoFieldSchema;
	private _targetDatabaseInfoField!: InfoFieldSchema;
	private _targetServerInfoField!: InfoFieldSchema;
	private _targetVersionInfoField!: InfoFieldSchema;
	private _migrationStatusInfoField!: InfoFieldSchema;
	private _fullBackupFileOnInfoField!: InfoFieldSchema;
	private _backupLocationInfoField!: InfoFieldSchema;
	private _lastUploadedFileNameField!: InfoFieldSchema;
	private _lastUploadedFileTimeField!: InfoFieldSchema;
	private _pendingDiffBackupsCountField!: InfoFieldSchema;
	private _detectedFilesField!: InfoFieldSchema;
	private _queuedFilesField!: InfoFieldSchema;
	private _skippedFilesField!: InfoFieldSchema;
	private _unrestorableFilesField!: InfoFieldSchema;

	private _lastLSNInfoField!: InfoFieldSchema;
	private _lastAppliedBackupInfoField!: InfoFieldSchema;
	private _lastAppliedBackupTakenOnInfoField!: InfoFieldSchema;
	private _currentRestoringFileInfoField!: InfoFieldSchema;
	private _lastRestoredFileTimeInfoField!: InfoFieldSchema;
	private _restoredFilesInfoField!: InfoFieldSchema;
	private _restoringFilesInfoField!: InfoFieldSchema;
	private _currentRestoredSizeInfoField!: InfoFieldSchema;
	private _currentRestorePlanSizeInfoField!: InfoFieldSchema;
	private _restorePercentCompletedInfoField!: InfoFieldSchema;
	private _miRestoreStateInfoField!: InfoFieldSchema;

	private _fileCount!: azdata.TextComponent;
	private _fileTable!: azdata.TableComponent;
	private _emptyTableFill!: azdata.FlexContainer;

	constructor() {
		super();
		this.id = MigrationDetailsTabId;
	}

	public async create(
		context: vscode.ExtensionContext,
		view: azdata.ModelView,
		openMigrationsListFcn: (refresh?: boolean) => Promise<void>,
		statusBar: DashboardStatusBar): Promise<MigrationDetailsTab> {

		this.view = view;
		this.context = context;
		this.openMigrationsListFcn = openMigrationsListFcn;
		this.statusBar = statusBar;

		await this.initialize(this.view);

		return this;
	}

	public async refresh(initialize?: boolean): Promise<void> {
		if (this.isRefreshing ||
			this.refreshLoader === undefined ||
			this.model?.migration === undefined) {

			return;
		}

		try {
			this.isRefreshing = true;
			this.refreshLoader.loading = true;
			await this.statusBar.clearError();

			if (initialize) {
				this._clearControlsValue();
				await utils.updateControlDisplay(this._fileTable, false);
				await this._fileTable.updateProperty('columns', this._getTableColumns(this.model?.migration));
				await this._showControls(this.model?.migration);
			}
			await this._fileTable.updateProperty('data', []);
			await this.model.fetchStatus();

			const migration = this.model?.migration;
			await this.cutoverButton.updateCssStyles(
				{ 'display': isOfflineMigation(migration) ? 'none' : 'block' });

			await this.showMigrationErrors(migration);

			let lastAppliedLSN: string = '';
			let lastAppliedBackupFileTakenOn: string = '';

			const tableData: ActiveBackupFileSchema[] = [];
			migration?.properties?.migrationStatusDetails?.activeBackupSets?.forEach(
				(activeBackupSet) => {
					tableData.push(
						...activeBackupSet?.listOfBackupFiles?.map(f => {
							return {
								backupFileName: f.fileName,
								backupType: loc.BackupTypeLookup[activeBackupSet.backupType] ?? activeBackupSet.backupType,
								backupStatus: loc.BackupSetRestoreStatusLookup[f.status] ?? f.status,	// SHIR provided
								restoreStatus: loc.InternalManagedDatabaseRestoreDetailsStatusLookup[activeBackupSet.restoreStatus] ?? activeBackupSet.restoreStatus,
								backupSizeMB: loc.formatSizeMb(activeBackupSet.backupSizeMB),
								numberOfStripes: activeBackupSet.numberOfStripes,
								dataUploadRate: `${convertByteSizeToReadableUnit(f.dataWritten ?? 0)} / ${convertByteSizeToReadableUnit(f.totalSize)}`,
								// SHIR provided
								dataUploaded: f.copyThroughput
									? (f.copyThroughput / 1024).toFixed(2)
									: EmptySettingValue, 							// SHIR provided
								backupStartTime: helper.formatDateTimeString(activeBackupSet.backupStartDate), 	// SHIR provided
								restoreStartDate: helper.formatDateTimeString(activeBackupSet.restoreStartDate),
								restoreFinishDate: helper.formatDateTimeString(activeBackupSet.restoreFinishDate),
								firstLSN: activeBackupSet.firstLSN,					// SHIR provided
								lastLSN: activeBackupSet.lastLSN, 					// SHIR provided
							};
						})
					);

					if (activeBackupSet.listOfBackupFiles?.length > 0 &&
						activeBackupSet.listOfBackupFiles[0].fileName === migration?.properties?.migrationStatusDetails?.lastRestoredFilename) {
						lastAppliedLSN = activeBackupSet.lastLSN;
						lastAppliedBackupFileTakenOn = activeBackupSet.backupFinishDate;
					}
				});

			this.databaseLabel.value = migration?.properties?.sourceDatabaseName;

			// Left side
			this._updateInfoFieldValue(this._sourceDatabaseInfoField, migration?.properties?.sourceDatabaseName);
			this._updateInfoFieldValue(this._sourceDetailsInfoField, migration?.properties?.sourceServerName);
			this._updateInfoFieldValue(this._migrationStatusInfoField, getMigrationStatusString(migration));
			this._migrationStatusInfoField.icon!.iconPath = getMigrationStatusImage(migration);

			this._updateInfoFieldValue(this._fullBackupFileOnInfoField, helper.getMigrationFullBackupFiles(migration) ?? EmptySettingValue);
			this._updateInfoFieldValue(this._backupLocationInfoField, helper.getMigrationBackupLocation(migration) ?? EmptySettingValue);

			// SQL MI supplied
			const details = migration?.properties?.migrationStatusDetails;
			this._updateInfoFieldValue(this._lastUploadedFileNameField, details?.lastUploadedFileName ?? EmptySettingValue);
			this._updateInfoFieldValue(
				this._lastUploadedFileTimeField,
				details?.lastUploadedFileTime
					? helper.formatDateTimeString(lastAppliedBackupFileTakenOn)
					: EmptySettingValue);
			this._updateInfoFieldValue(this._pendingDiffBackupsCountField, details?.pendingDiffBackupsCount?.toLocaleString() ?? EmptySettingValue);
			this._updateInfoFieldValue(this._detectedFilesField, details?.detectedFiles?.toLocaleString() ?? EmptySettingValue);
			this._updateInfoFieldValue(this._queuedFilesField, details?.queuedFiles?.toLocaleString() ?? EmptySettingValue);
			this._updateInfoFieldValue(this._skippedFilesField, details?.skippedFiles?.toLocaleString() ?? EmptySettingValue);
			this._updateInfoFieldValue(this._unrestorableFilesField, details?.unrestorableFiles?.toLocaleString() ?? EmptySettingValue);

			// Right side
			this._updateInfoFieldValue(this._targetDatabaseInfoField, migration.name ?? EmptySettingValue);
			this._updateInfoFieldValue(this._targetServerInfoField, getResourceName(migration?.properties?.scope) ?? EmptySettingValue);
			this._updateInfoFieldValue(this._targetVersionInfoField, MigrationTargetTypeName[getMigrationTargetTypeEnum(migration) ?? ''] ?? EmptySettingValue);
			this._updateInfoFieldValue(
				this._lastLSNInfoField,
				lastAppliedLSN?.length > 0
					? lastAppliedLSN
					: EmptySettingValue);
			this._updateInfoFieldValue(this._lastAppliedBackupInfoField, migration?.properties?.migrationStatusDetails?.lastRestoredFilename ?? EmptySettingValue);

			// FileShare
			this._updateInfoFieldValue(
				this._lastAppliedBackupTakenOnInfoField,
				lastAppliedBackupFileTakenOn?.length > 0
					? helper.formatDateTimeString(lastAppliedBackupFileTakenOn)
					: EmptySettingValue);

			// AzureBlob
			this._updateInfoFieldValue(this._currentRestoringFileInfoField, this.getMigrationCurrentlyRestoringFile(migration) ?? EmptySettingValue);

			// SQL MI supplied
			const lastRestoredFileTime = migration?.properties?.migrationStatusDetails?.lastRestoredFileTime ?? '';
			this._updateInfoFieldValue(
				this._lastRestoredFileTimeInfoField,
				lastRestoredFileTime.length > 0
					? convertIsoTimeToLocalTime(lastRestoredFileTime).toLocaleString()
					: EmptySettingValue);
			this._updateInfoFieldValue(this._restoredFilesInfoField, migration?.properties?.migrationStatusDetails?.restoredFiles?.toLocaleString() ?? EmptySettingValue);
			this._updateInfoFieldValue(this._restoringFilesInfoField, migration?.properties?.migrationStatusDetails?.restoringFiles?.toLocaleString() ?? EmptySettingValue);
			this._updateInfoFieldValue(
				this._currentRestoredSizeInfoField,
				migration?.properties?.migrationStatusDetails?.currentRestoredSize
					? loc.formatSizeMb(migration?.properties?.migrationStatusDetails?.currentRestoredSize)
					: EmptySettingValue);

			this._updateInfoFieldValue(
				this._currentRestorePlanSizeInfoField,
				migration?.properties?.migrationStatusDetails?.currentRestorePlanSize
					? loc.formatSizeMb(migration?.properties?.migrationStatusDetails?.currentRestorePlanSize)
					: EmptySettingValue);

			this._updateInfoFieldValue(this._restorePercentCompletedInfoField, migration?.properties?.migrationStatusDetails?.restorePercentCompleted?.toLocaleString() ?? EmptySettingValue);
			this._updateInfoFieldValue(
				this._miRestoreStateInfoField,
				loc.InternalManagedDatabaseRestoreDetailsStatusLookup[migration?.properties?.migrationStatusDetails?.miRestoreState ?? '']
				?? migration?.properties?.migrationStatusDetails?.miRestoreState
				?? EmptySettingValue);

			const isBlobMigration = helper.isBlobMigration(migration);
			const isSqlVmTarget = helper.isTargetType(migration, AzureResourceKind.SQLVM);
			if (!isBlobMigration && !isSqlVmTarget) {
				await this._fileCount.updateCssStyles({ ...styles.SECTION_HEADER_CSS, display: 'inline' });
				this._fileCount.value = loc.ACTIVE_BACKUP_FILES_ITEMS(tableData.length);
			}

			if (tableData.length === 0) {
				if (!isBlobMigration && !isSqlVmTarget) {
					await this._emptyTableFill.updateCssStyles({ 'display': 'flex' });
				}
				this._fileTable.height = '50px';
				await this._fileTable.updateProperty('data', []);
			} else {
				await this._emptyTableFill.updateCssStyles({ 'display': 'none' });
				this._fileTable.height = '340px';

				// Sorting files in descending order of backupStartTime
				tableData.sort((file1, file2) => new Date(file1.backupStartTime) > new Date(file2.backupStartTime) ? - 1 : 1);
			}

			const data = tableData.map(row => [
				row.backupFileName,		// 0
				row.backupType,			// 1
				row.backupStatus,		// 2
				row.restoreStatus,		// 3
				row.backupSizeMB,		// 4
				row.numberOfStripes,	// 5
				row.dataUploadRate,		// 6
				row.dataUploaded,		// 7
				row.backupStartTime,	// 8
				row.restoreStartDate,	// 9
				row.restoreFinishDate,	// 10
				row.firstLSN,			// 11
				row.lastLSN,			// 12
			]) || [];

			const filteredData = this._getTableData(migration, data);
			await this._fileTable.updateProperty('data', filteredData);

			this.cutoverButton.enabled = canCutoverMigration(migration);
			this.cancelButton.enabled = canCancelMigration(migration);
			this.deleteButton.enabled = canDeleteMigration(migration);
			this.restartButton.enabled = canRestartMigrationWizard(migration);
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

	private _clearControlsValue(): void {
		this._updateInfoFieldValue(this._sourceDatabaseInfoField, '');
		this._updateInfoFieldValue(this._sourceDetailsInfoField, '');
		this._updateInfoFieldValue(this._targetDatabaseInfoField, '');
		this._updateInfoFieldValue(this._targetServerInfoField, '');
		this._updateInfoFieldValue(this._targetVersionInfoField, '');
		this._updateInfoFieldValue(this._migrationStatusInfoField, '');
		this._updateInfoFieldValue(this._fullBackupFileOnInfoField, '');
		this._updateInfoFieldValue(this._backupLocationInfoField, '');
		this._updateInfoFieldValue(this._lastUploadedFileNameField, '');
		this._updateInfoFieldValue(this._lastUploadedFileTimeField, '');
		this._updateInfoFieldValue(this._pendingDiffBackupsCountField, '');
		this._updateInfoFieldValue(this._detectedFilesField, '');
		this._updateInfoFieldValue(this._queuedFilesField, '');
		this._updateInfoFieldValue(this._skippedFilesField, '');
		this._updateInfoFieldValue(this._unrestorableFilesField, '');

		this._updateInfoFieldValue(this._lastLSNInfoField, '');
		this._updateInfoFieldValue(this._lastAppliedBackupInfoField, '');
		this._updateInfoFieldValue(this._currentRestoringFileInfoField, '');
		this._updateInfoFieldValue(this._lastAppliedBackupTakenOnInfoField, '');
		this._updateInfoFieldValue(this._lastRestoredFileTimeInfoField, '');
		this._updateInfoFieldValue(this._restoredFilesInfoField, '');
		this._updateInfoFieldValue(this._restoringFilesInfoField, '');
		this._updateInfoFieldValue(this._currentRestoredSizeInfoField, '');
		this._updateInfoFieldValue(this._currentRestorePlanSizeInfoField, '');
		this._updateInfoFieldValue(this._restorePercentCompletedInfoField, '');
		this._updateInfoFieldValue(this._miRestoreStateInfoField, '');
	}

	private async _showControls(migration: DatabaseMigration): Promise<void> {
		const isSHIR = helper.isShirMigration(migration);
		const isSqlMiTarget = helper.isTargetType(migration, AzureResourceKind.SQLMI);
		const isSqlVmTarget = helper.isTargetType(migration, AzureResourceKind.SQLVM);
		const isBlobMigration = helper.isBlobMigration(migration);

		await utils.updateControlDisplay(this._fullBackupFileOnInfoField.flexContainer, isSHIR);
		await utils.updateControlDisplay(this._lastUploadedFileNameField.flexContainer, isSqlMiTarget);
		await utils.updateControlDisplay(this._lastUploadedFileTimeField.flexContainer, isSqlMiTarget);
		await utils.updateControlDisplay(this._pendingDiffBackupsCountField.flexContainer, isSqlMiTarget);
		await utils.updateControlDisplay(this._detectedFilesField.flexContainer, isSqlMiTarget);
		await utils.updateControlDisplay(this._queuedFilesField.flexContainer, isSqlMiTarget);
		await utils.updateControlDisplay(this._skippedFilesField.flexContainer, isSqlMiTarget);
		await utils.updateControlDisplay(this._unrestorableFilesField.flexContainer, isSqlMiTarget);
		await utils.updateControlDisplay(this._lastLSNInfoField.flexContainer, isSHIR);
		await utils.updateControlDisplay(this._currentRestoringFileInfoField.flexContainer, isBlobMigration);
		await utils.updateControlDisplay(this._lastAppliedBackupTakenOnInfoField.flexContainer, isSHIR);
		await utils.updateControlDisplay(this._lastRestoredFileTimeInfoField.flexContainer, isSqlMiTarget);
		await utils.updateControlDisplay(this._restoredFilesInfoField.flexContainer, isSqlMiTarget);
		await utils.updateControlDisplay(this._restoringFilesInfoField.flexContainer, isSqlMiTarget);
		await utils.updateControlDisplay(this._currentRestoredSizeInfoField.flexContainer, isSqlMiTarget);
		await utils.updateControlDisplay(this._currentRestorePlanSizeInfoField.flexContainer, isSqlMiTarget);
		await utils.updateControlDisplay(this._restorePercentCompletedInfoField.flexContainer, isSqlMiTarget);
		await utils.updateControlDisplay(this._miRestoreStateInfoField.flexContainer, isSqlMiTarget);

		const showGrid = !(isBlobMigration && isSqlVmTarget);
		await utils.updateControlDisplay(this._emptyTableFill, showGrid, 'flex');
		await utils.updateControlDisplay(this._fileCount, showGrid);
		await utils.updateControlDisplay(this._fileTable, showGrid);
	}

	private _addItemIfTrue(array: any[], value: any, add: boolean): void {
		if (add) {
			array.push(value);
		}
	}

	private _getTableColumns(migration?: DatabaseMigration): azdata.TableColumn[] {
		const columns: azdata.TableColumn[] = [];
		const isSHIR = isShirMigration(migration);
		const isSqlMiTarget = helper.isTargetType(migration, AzureResourceKind.SQLMI);

		this._addItemIfTrue(columns, { value: 'backupFileName', name: loc.BACKUP_FILE_COLUMN_FILE_NAME, tooltip: loc.BACKUP_FILE_COLUMN_FILE_NAME, type: azdata.ColumnType.text, }, true);
		this._addItemIfTrue(columns, { value: 'backupType', name: loc.TYPE, tooltip: loc.TYPE, type: azdata.ColumnType.text, }, true);
		this._addItemIfTrue(columns, { value: 'backupStatus', name: loc.BACKUP_FILE_COLUMN_FILE_STATUS, tooltip: loc.BACKUP_FILE_COLUMN_FILE_STATUS, type: azdata.ColumnType.text }, isSHIR);
		this._addItemIfTrue(columns, { value: 'restoreStatus', name: loc.BACKUP_FILE_COLUMN_RESTORE_STATUS, tooltip: loc.BACKUP_FILE_COLUMN_RESTORE_STATUS, type: azdata.ColumnType.text, }, isSqlMiTarget);
		this._addItemIfTrue(columns, { value: 'backupSizeMB', name: loc.BACKUP_FILE_COLUMN_BACKUP_SIZE_MB, tooltip: loc.BACKUP_FILE_COLUMN_BACKUP_SIZE_MB, type: azdata.ColumnType.text, }, isSqlMiTarget);
		this._addItemIfTrue(columns, { value: 'numberOfStripes', name: loc.BACKUP_FILE_COLUMN_NUMBER_OF_STRIPES, tooltip: loc.BACKUP_FILE_COLUMN_NUMBER_OF_STRIPES, type: azdata.ColumnType.text, }, isSqlMiTarget);
		this._addItemIfTrue(columns, { value: 'dataUploadRate', name: loc.DATA_UPLOADED, tooltip: loc.DATA_UPLOADED, type: azdata.ColumnType.text, }, isSHIR);
		this._addItemIfTrue(columns, { value: 'throughput', name: loc.COPY_THROUGHPUT, tooltip: loc.COPY_THROUGHPUT, type: azdata.ColumnType.text, }, isSHIR);
		this._addItemIfTrue(columns, { value: 'backupStartTime', name: loc.BACKUP_START_TIME, tooltip: loc.BACKUP_START_TIME, type: azdata.ColumnType.text, }, isSHIR);
		this._addItemIfTrue(columns, { value: 'restoreStartDate', name: loc.BACKUP_FILE_COLUMN_RESTORE_START_DATE, tooltip: loc.BACKUP_FILE_COLUMN_RESTORE_START_DATE, type: azdata.ColumnType.text, }, isSqlMiTarget);
		this._addItemIfTrue(columns, { value: 'restoreFinishDate', name: loc.BACKUP_FILE_COLUMN_RESTORE_FINISH_DATE, tooltip: loc.BACKUP_FILE_COLUMN_RESTORE_FINISH_DATE, type: azdata.ColumnType.text, }, isSqlMiTarget);
		this._addItemIfTrue(columns, { value: 'firstLsn', name: loc.FIRST_LSN, tooltip: loc.FIRST_LSN, type: azdata.ColumnType.text, }, isSHIR);
		this._addItemIfTrue(columns, { value: 'lastLsn', name: loc.LAST_LSN, tooltip: loc.LAST_LSN, type: azdata.ColumnType.text, }, isSHIR);

		return columns;
	}

	private _getTableData(migration?: DatabaseMigration, data?: (string | number)[][]): any[] {
		const isSHIR = isShirMigration(migration);
		const isSqlMiTarget = helper.isTargetType(migration, AzureResourceKind.SQLMI);

		return data?.map(row => {
			const rec: any[] = [];
			this._addItemIfTrue(rec, row[BackupFileColumnIndex.backupFileName], true);
			this._addItemIfTrue(rec, row[BackupFileColumnIndex.backupType], true);
			this._addItemIfTrue(rec, row[BackupFileColumnIndex.backupStatus], isSHIR);
			this._addItemIfTrue(rec, row[BackupFileColumnIndex.restoreStatus], isSqlMiTarget);
			this._addItemIfTrue(rec, row[BackupFileColumnIndex.backupSizeMB], isSqlMiTarget);
			this._addItemIfTrue(rec, row[BackupFileColumnIndex.numberOfStripes], isSqlMiTarget);
			this._addItemIfTrue(rec, row[BackupFileColumnIndex.dataUploadRate], isSHIR);
			this._addItemIfTrue(rec, row[BackupFileColumnIndex.throughput], isSHIR);
			this._addItemIfTrue(rec, row[BackupFileColumnIndex.backupStartTime], isSHIR);
			this._addItemIfTrue(rec, row[BackupFileColumnIndex.restoreStartDate], isSqlMiTarget);
			this._addItemIfTrue(rec, row[BackupFileColumnIndex.restoreFinishDate], isSqlMiTarget);
			this._addItemIfTrue(rec, row[BackupFileColumnIndex.firstLsn], isSHIR);
			this._addItemIfTrue(rec, row[BackupFileColumnIndex.lastLsn], isSHIR);
			return rec;
		}) || [];
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
					CSSStyles: { 'padding': '0px' },
					forceFitColumns: azdata.ColumnSizingMode.ForceFit,
					display: 'inline-flex',
					data: [],
					height: '340px',
					columns: [],
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

			const container = this.view.modelBuilder.flexContainer()
				.withItems([
					this.createMigrationToolbarContainer(),
					await this.migrationInfoGrid(),
					this.view.modelBuilder.separator()
						.withProps({
							width: '100%',
							CSSStyles: { 'padding': '0' }
						})
						.component(),
					this._fileCount,
					this._fileTable,
					this._emptyTableFill,
				], { CSSStyles: { 'padding': '0 15px 0 15px' } })
				.withLayout({ flexFlow: 'column', })
				.withProps({ width: '100%' })
				.component();

			await utils.updateControlDisplay(this.retryButton, false);

			this.content = container;
		} catch (e) {
			logError(TelemetryViews.MigrationCutoverDialog, 'IntializingFailed', e);
		}
	}

	protected override async migrationInfoGrid(): Promise<azdata.FlexContainer> {
		// left side
		this._sourceDatabaseInfoField = await this.createInfoField(loc.SOURCE_DATABASE, '');
		this._sourceDetailsInfoField = await this.createInfoField(loc.SOURCE_SERVER, '');
		this._migrationStatusInfoField = await this.createInfoField(loc.MIGRATION_STATUS, '', false, ' ');
		this._fullBackupFileOnInfoField = await this.createInfoField(loc.FULL_BACKUP_FILES, '', false);
		this._backupLocationInfoField = await this.createInfoField(loc.BACKUP_LOCATION, '');

		// SQL MI provided
		this._lastUploadedFileNameField = await this.createInfoField(loc.FIELD_LABEL_LAST_UPLOADED_FILE, '');
		this._lastUploadedFileTimeField = await this.createInfoField(loc.FIELD_LABEL_LAST_UPLOADED_FILE_TIME, '');
		this._pendingDiffBackupsCountField = await this.createInfoField(loc.FIELD_LABEL_PENDING_DIFF_BACKUPS, '');
		this._detectedFilesField = await this.createInfoField(loc.FIELD_LABEL_DETECTED_FILES, '');
		this._queuedFilesField = await this.createInfoField(loc.FIELD_LABEL_QUEUED_FILES, '');
		this._skippedFilesField = await this.createInfoField(loc.FIELD_LABEL_SKIPPED_FILES, '');
		this._unrestorableFilesField = await this.createInfoField(loc.FIELD_LABEL_UNRESTORABLE_FILES, '');

		// right side
		this._targetDatabaseInfoField = await this.createInfoField(loc.TARGET_DATABASE_NAME, '');
		this._targetServerInfoField = await this.createInfoField(loc.TARGET_SERVER, '');
		this._targetVersionInfoField = await this.createInfoField(loc.TARGET_VERSION, '');
		this._lastLSNInfoField = await this.createInfoField(loc.LAST_APPLIED_LSN, '', false);
		this._lastAppliedBackupInfoField = await this.createInfoField(loc.LAST_APPLIED_BACKUP_FILES, '');
		this._lastAppliedBackupTakenOnInfoField = await this.createInfoField(loc.LAST_APPLIED_BACKUP_FILES_TAKEN_ON, '', false);
		this._currentRestoringFileInfoField = await this.createInfoField(loc.CURRENTLY_RESTORING_FILE, '', false);

		this._lastRestoredFileTimeInfoField = await this.createInfoField(loc.FIELD_LABEL_LAST_RESTORED_FILE_TIME, '', false);
		this._restoredFilesInfoField = await this.createInfoField(loc.FIELD_LABEL_RESTORED_FILES, '', false);
		this._restoringFilesInfoField = await this.createInfoField(loc.FIELD_LABEL_RESTORING_FILES, '', false);
		this._currentRestoredSizeInfoField = await this.createInfoField(loc.FIELD_LABEL_RESTORED_SIZE, '', false);
		this._currentRestorePlanSizeInfoField = await this.createInfoField(loc.FIELD_LABEL_RESTORE_PLAN_SIZE, '', false);
		this._restorePercentCompletedInfoField = await this.createInfoField(loc.FIELD_LABEL_RESTORE_PERCENT_COMPLETED, '', false);
		this._miRestoreStateInfoField = await this.createInfoField(loc.FIELD_LABEL_MI_RESTORE_STATE, '', false);

		const leftSide = this.view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withProps({ width: '50%' })
			.withItems([
				this._sourceDatabaseInfoField.flexContainer,
				this._sourceDetailsInfoField.flexContainer,
				this._migrationStatusInfoField.flexContainer,
				this._fullBackupFileOnInfoField.flexContainer,
				this._backupLocationInfoField.flexContainer,
				this._lastUploadedFileNameField.flexContainer,
				this._lastUploadedFileTimeField.flexContainer,
				this._pendingDiffBackupsCountField.flexContainer,
				this._detectedFilesField.flexContainer,
				this._queuedFilesField.flexContainer,
				this._skippedFilesField.flexContainer,
				this._unrestorableFilesField.flexContainer,
			])
			.component();

		const rightSide = this.view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withProps({ width: '50%' })
			.withItems([
				this._targetDatabaseInfoField.flexContainer,
				this._targetServerInfoField.flexContainer,
				this._targetVersionInfoField.flexContainer,
				this._lastLSNInfoField.flexContainer,
				this._lastAppliedBackupInfoField.flexContainer,
				this._lastAppliedBackupTakenOnInfoField.flexContainer,
				this._currentRestoringFileInfoField.flexContainer,
				this._lastRestoredFileTimeInfoField.flexContainer,
				this._restoredFilesInfoField.flexContainer,
				this._restoringFilesInfoField.flexContainer,
				this._currentRestoredSizeInfoField.flexContainer,
				this._currentRestorePlanSizeInfoField.flexContainer,
				this._restorePercentCompletedInfoField.flexContainer,
				this._miRestoreStateInfoField.flexContainer,
			])
			.component();

		return this.view.modelBuilder.flexContainer()
			.withItems([leftSide, rightSide], { flex: '0 0 auto' })
			.withLayout({ flexFlow: 'row', flexWrap: 'wrap' })
			.component();
	}
}
