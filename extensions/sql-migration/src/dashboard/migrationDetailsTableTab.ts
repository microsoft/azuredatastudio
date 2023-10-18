/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../constants/strings';
import { getMigrationStatusImage, getObjectsCollectionStatusImage, getPipelineStatusImage, getSchemaMigrationStatusImage, getScriptDeploymentStatusImage, getScriptGenerationStatusImage } from '../api/utils';
import { logError, TelemetryViews } from '../telemetry';
import { canCancelMigration, canCutoverMigration, canDeleteMigration, canRestartMigrationWizard, canRetryMigration, formatDateTimeString, formatNumber, formatSecondsIntoReadableTime, formatSizeBytes, formatSizeKb, getMigrationStatusString, getMigrationTargetTypeEnum, getSchemaMigrationStatusString, isOfflineMigation, PipelineStatusCodes } from '../constants/helper';
import { CopyProgressDetail, getResourceName } from '../api/azure';
import { InfoFieldSchema, MigrationDetailsTabBase, MigrationTargetTypeName } from './migrationDetailsTabBase';
import { IconPathHelper } from '../constants/iconPathHelper';
import { EOL } from 'os';
import { DashboardStatusBar } from './DashboardStatusBar';
import { EmptySettingValue } from './tabBase';
import * as utils from '../api/utils';

const MigrationDetailsTableTabId = 'MigrationDetailsTableTab';

const TableColumns = {
	tableName: 'tableName',
	status: 'status',
	dataRead: 'dataRead',
	dataWritten: 'dataWritten',
	rowsRead: 'rowsRead',
	rowsCopied: 'rowsCopied',
	copyThroughput: 'copyThroughput',
	copyDuration: 'copyDuration',
	parallelCopyType: 'parallelCopyType',
	usedParallelCopies: 'usedParallelCopies',
	copyStart: 'copyStart',
};

enum SummaryCardIndex {
	TotalTables = 0,
	InProgressTables = 1,
	SuccessfulTables = 2,
	FailedTables = 3,
	CanceledTables = 4,
}

export class MigrationDetailsTableTab extends MigrationDetailsTabBase<MigrationDetailsTableTab> {
	private _sourceDatabaseInfoField!: InfoFieldSchema;
	private _sourceDetailsInfoField!: InfoFieldSchema;
	private _migrationStatusInfoField!: InfoFieldSchema;
	private _targetDatabaseInfoField!: InfoFieldSchema;
	private _targetServerInfoField!: InfoFieldSchema;
	private _targetVersionInfoField!: InfoFieldSchema;
	private _migrationType!: InfoFieldSchema;

	// Schema
	private _schemaMigrationStatusInfoField!: InfoFieldSchema;
	private _objectsCollectionCountInfoField!: InfoFieldSchema;
	private _objectsCollectionStartedInfoField!: InfoFieldSchema;
	private _objectsCollectionEndedInfoField!: InfoFieldSchema;
	private _scriptGenerationProgressInfoField!: InfoFieldSchema;
	private _scriptGenerationStartedInfoField!: InfoFieldSchema;
	private _scriptGenerationEndedInfoField!: InfoFieldSchema;
	private _succeededScriptCountInfoField!: InfoFieldSchema;
	private _failedScriptCountInfoField!: InfoFieldSchema;
	private _scriptDeploymentProgressInfoField!: InfoFieldSchema;
	private _scriptDeploymentStartedField!: InfoFieldSchema;
	private _scriptDeploymentEndedInfoField!: InfoFieldSchema;
	private _succeededDeploymentCountInfoField!: InfoFieldSchema;
	private _failedDeploymentCountInfoField!: InfoFieldSchema;

	private _tableFilterInputBox!: azdata.InputBoxComponent;
	private _columnSortDropdown!: azdata.DropDownComponent;
	private _columnSortCheckbox!: azdata.CheckBoxComponent;
	private _progressTable!: azdata.TableComponent;
	private _progressDetail: CopyProgressDetail[] = [];

	constructor() {
		super();
		this.id = MigrationDetailsTableTabId;
	}

	public async create(
		context: vscode.ExtensionContext,
		view: azdata.ModelView,
		openMigrationsListFcn: (refresh?: boolean) => Promise<void>,
		statusBar: DashboardStatusBar): Promise<MigrationDetailsTableTab> {

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
				await this._showControls();
			}
			await this.model.fetchStatus();
			await this._loadData();
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
			this._progressTable = this.view.modelBuilder.table()
				.withProps({
					ariaLabel: loc.ACTIVE_BACKUP_FILES,
					CSSStyles: { 'padding-left': '0px' },
					forceFitColumns: azdata.ColumnSizingMode.ForceFit,
					display: 'inline-flex',
					data: [],
					height: '340px',
					columns: [
						{
							value: TableColumns.tableName,
							name: loc.SQLDB_COL_TABLE_NAME,
							type: azdata.ColumnType.text,
							width: 170,
						},
						<azdata.HyperlinkColumn>{
							name: loc.STATUS,
							value: TableColumns.status,
							width: 106,
							type: azdata.ColumnType.hyperlink,
							icon: IconPathHelper.inProgressMigration,
							showText: true,
						},
						{
							value: TableColumns.dataRead,
							name: loc.SQLDB_COL_DATA_READ,
							width: 64,
							type: azdata.ColumnType.text,
						},
						{
							value: TableColumns.dataWritten,
							name: loc.SQLDB_COL_DATA_WRITTEN,
							width: 77,
							type: azdata.ColumnType.text,
						},
						{
							value: TableColumns.rowsRead,
							name: loc.SQLDB_COL_ROWS_READ,
							width: 68,
							type: azdata.ColumnType.text,
						},
						{
							value: TableColumns.rowsCopied,
							name: loc.SQLDB_COL_ROWS_COPIED,
							width: 77,
							type: azdata.ColumnType.text,
						},
						{
							value: TableColumns.copyThroughput,
							name: loc.SQLDB_COL_COPY_THROUGHPUT,
							width: 102,
							type: azdata.ColumnType.text,
						},
						{
							value: TableColumns.copyDuration,
							name: loc.SQLDB_COL_COPY_DURATION,
							width: 87,
							type: azdata.ColumnType.text,
						},
						{
							value: TableColumns.parallelCopyType,
							name: loc.SQLDB_COL_PARRALEL_COPY_TYPE,
							width: 104,
							type: azdata.ColumnType.text,
						},
						{
							value: TableColumns.usedParallelCopies,
							name: loc.SQLDB_COL_USED_PARALLEL_COPIES,
							width: 116,
							type: azdata.ColumnType.text,
						},
						{
							value: TableColumns.copyStart,
							name: loc.SQLDB_COL_COPY_START,
							width: 140,
							type: azdata.ColumnType.text,
						},
					],
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
					await this._createStatusBar(),
					await this._createTableFilter(),
					this._progressTable,
				], { CSSStyles: { 'padding': '15px 15px 0 15px' } })
				.withLayout({ flexFlow: 'column', })
				.withProps({ width: '100%' })
				.component();

			this.disposables.push(
				this._progressTable.onCellAction!(
					async (rowState: azdata.ICellActionEventArgs) => {
						const buttonState = <azdata.ICellActionEventArgs>rowState;
						if (buttonState?.column === 1) {
							const tableName = this._progressTable!.data[rowState.row][0] || null;
							const tableProgress = this.model.migration.properties.migrationStatusDetails?.listOfCopyProgressDetails?.find(
								progress => progress.tableName === tableName);
							const errors = tableProgress?.errors || [];
							const tableStatus = loc.PipelineRunStatus[tableProgress?.status ?? ''] ?? tableProgress?.status;
							const statusMessage = loc.TABLE_MIGRATION_STATUS_LABEL(tableStatus);
							const errorMessage = errors.join(EOL);

							this.showDialogMessage(
								loc.TABLE_MIGRATION_STATUS_TITLE,
								statusMessage,
								errorMessage);
						}
					}));

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
		this._schemaMigrationStatusInfoField = await this.createInfoField(loc.SCHEMA_MIGRATION_STATUS, '', false, ' ');
		this._objectsCollectionCountInfoField = await this.createInfoField(loc.OBJECTS_COLLECTED, '', false, ' ');
		this._objectsCollectionStartedInfoField = await this.createInfoField(loc.COLLECTION_STARTED, '');
		this._objectsCollectionEndedInfoField = await this.createInfoField(loc.COLLECTION_ENDED, '');
		this._scriptGenerationProgressInfoField = await this.createInfoField(loc.SCRIPT_GENERATION, '', false, ' ');
		this._scriptGenerationStartedInfoField = await this.createInfoField(loc.SCRIPTING_STARTED, '');
		this._scriptGenerationEndedInfoField = await this.createInfoField(loc.SCRIPTING_ENDED, '');
		this._succeededScriptCountInfoField = await this.createInfoField(loc.SCRIPTED_OBJECTS_COUNT, '');
		this._failedScriptCountInfoField = await this.createInfoField(loc.SCRIPTING_ERROR_COUNT, '');

		// right side
		this._targetDatabaseInfoField = await this.createInfoField(loc.TARGET_DATABASE_NAME, '');
		this._targetServerInfoField = await this.createInfoField(loc.TARGET_SERVER, '');
		this._targetVersionInfoField = await this.createInfoField(loc.TARGET_VERSION, '');
		this._migrationType = await this.createInfoField(loc.MIGRATION_TYPE, '', false, '');
		this._scriptDeploymentProgressInfoField = await this.createInfoField(loc.SCRIPT_DEPLOYMENT, '', false, ' ');
		this._scriptDeploymentStartedField = await this.createInfoField(loc.DEPLOYMENT_STARTED, '');
		this._scriptDeploymentEndedInfoField = await this.createInfoField(loc.DEPLOYMENT_ENDED, '');
		this._succeededDeploymentCountInfoField = await this.createInfoField(loc.DEPLOYMENT_COUNT, '');
		this._failedDeploymentCountInfoField = await this.createInfoField(loc.DEPLOYMENT_ERROR_COUNT, '');

		const leftSide = this.view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withProps({ width: '50%' })
			.withItems([
				this._sourceDatabaseInfoField.flexContainer,
				this._sourceDetailsInfoField.flexContainer,
				this._migrationStatusInfoField.flexContainer,
				this._schemaMigrationStatusInfoField.flexContainer,
				this._objectsCollectionCountInfoField.flexContainer,
				this._objectsCollectionStartedInfoField.flexContainer,
				this._objectsCollectionEndedInfoField.flexContainer,
				this._scriptGenerationProgressInfoField.flexContainer,
				this._scriptGenerationStartedInfoField.flexContainer,
				this._scriptGenerationEndedInfoField.flexContainer,
				this._succeededScriptCountInfoField.flexContainer,
				this._failedScriptCountInfoField.flexContainer,
			])
			.component();

		const rightSide = this.view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withProps({ width: '50%' })
			.withItems([
				this._targetDatabaseInfoField.flexContainer,
				this._targetServerInfoField.flexContainer,
				this._targetVersionInfoField.flexContainer,
				this._migrationType.flexContainer,
				this._scriptDeploymentProgressInfoField.flexContainer,
				this._scriptDeploymentStartedField.flexContainer,
				this._scriptDeploymentEndedInfoField.flexContainer,
				this._succeededDeploymentCountInfoField.flexContainer,
				this._failedDeploymentCountInfoField.flexContainer,
				this._scriptDeploymentStartedField.flexContainer,
				this._scriptDeploymentStartedField.flexContainer,
			])
			.component();

		return this.view.modelBuilder.flexContainer()
			.withItems([leftSide, rightSide], { flex: '0 0 auto' })
			.withLayout({ flexFlow: 'row', flexWrap: 'wrap' })
			.component();
	}

	private async _showControls(): Promise<void> {
		const migration = this.model?.migration;
		const isSchemaMigration = migration.properties.sqlSchemaMigrationConfiguration.enableSchemaMigration;

		await utils.updateControlDisplay(this._schemaMigrationStatusInfoField.flexContainer, isSchemaMigration);
		await utils.updateControlDisplay(this._objectsCollectionCountInfoField.flexContainer, isSchemaMigration);
		await utils.updateControlDisplay(this._objectsCollectionStartedInfoField.flexContainer, isSchemaMigration);
		await utils.updateControlDisplay(this._objectsCollectionEndedInfoField.flexContainer, isSchemaMigration);
		await utils.updateControlDisplay(this._scriptGenerationProgressInfoField.flexContainer, isSchemaMigration);
		await utils.updateControlDisplay(this._scriptGenerationStartedInfoField.flexContainer, isSchemaMigration);
		await utils.updateControlDisplay(this._scriptGenerationEndedInfoField.flexContainer, isSchemaMigration);
		await utils.updateControlDisplay(this._succeededScriptCountInfoField.flexContainer, isSchemaMigration);
		await utils.updateControlDisplay(this._failedScriptCountInfoField.flexContainer, isSchemaMigration);
		await utils.updateControlDisplay(this._scriptDeploymentProgressInfoField.flexContainer, isSchemaMigration, 'inline-flex');
		await utils.updateControlDisplay(this._scriptDeploymentStartedField.flexContainer, isSchemaMigration);
		await utils.updateControlDisplay(this._scriptDeploymentEndedInfoField.flexContainer, isSchemaMigration);
		await utils.updateControlDisplay(this._succeededDeploymentCountInfoField.flexContainer, isSchemaMigration);
		await utils.updateControlDisplay(this._failedDeploymentCountInfoField.flexContainer, isSchemaMigration);
	}

	private async _loadData(): Promise<void> {
		const migration = this.model?.migration;
		await this.showMigrationErrors(this.model?.migration);

		await this.cutoverButton.updateCssStyles(
			{ 'display': isOfflineMigation(migration) ? 'none' : 'block' });

		const sqlServerName = migration?.properties.sourceServerName;
		const sourceDatabaseName = migration?.properties.sourceDatabaseName;
		const targetDatabaseName = migration?.name;
		const targetServerName = getResourceName(migration?.properties.scope);

		const targetType = getMigrationTargetTypeEnum(migration);
		const targetServerVersion = MigrationTargetTypeName[targetType ?? ''];

		this._progressDetail = migration?.properties.migrationStatusDetails?.listOfCopyProgressDetails ?? [];
		const schemaMigrationStatus = migration?.properties?.migrationStatusDetails?.sqlSchemaMigrationStatus;
		const objectCollection = schemaMigrationStatus?.objectsCollection;
		const scriptGeneration = schemaMigrationStatus?.scriptGeneration;
		const scriptDeployment = schemaMigrationStatus?.scriptDeployment;

		const hashSet: loc.LookupTable<number> = {};
		await this._populateTableData(hashSet);

		const successCount = hashSet[PipelineStatusCodes.Succeeded] ?? 0;
		const cancelledCount =
			(hashSet[PipelineStatusCodes.Canceled] ?? 0) +
			(hashSet[PipelineStatusCodes.Cancelled] ?? 0);

		const failedCount = hashSet[PipelineStatusCodes.Failed] ?? 0;
		const inProgressCount =
			(hashSet[PipelineStatusCodes.Queued] ?? 0) +
			(hashSet[PipelineStatusCodes.CopyFinished] ?? 0) +
			(hashSet[PipelineStatusCodes.Copying] ?? 0) +
			(hashSet[PipelineStatusCodes.PreparingForCopy] ?? 0) +
			(hashSet[PipelineStatusCodes.RebuildingIndexes] ?? 0) +
			(hashSet[PipelineStatusCodes.InProgress] ?? 0);

		const totalCount = this._progressDetail.length;

		this._updateSummaryComponent(SummaryCardIndex.TotalTables, totalCount);
		this._updateSummaryComponent(SummaryCardIndex.InProgressTables, inProgressCount);
		this._updateSummaryComponent(SummaryCardIndex.SuccessfulTables, successCount);
		this._updateSummaryComponent(SummaryCardIndex.FailedTables, failedCount);
		this._updateSummaryComponent(SummaryCardIndex.CanceledTables, cancelledCount);

		this.databaseLabel.value = sourceDatabaseName;
		// Left side
		this._updateInfoFieldValue(this._sourceDatabaseInfoField, sourceDatabaseName ?? EmptySettingValue);
		this._updateInfoFieldValue(this._sourceDetailsInfoField, sqlServerName ?? EmptySettingValue);
		this._updateInfoFieldValue(this._migrationStatusInfoField, getMigrationStatusString(migration) ?? EmptySettingValue);
		this._migrationStatusInfoField.icon!.iconPath = getMigrationStatusImage(migration);
		this._updateInfoFieldValue(this._schemaMigrationStatusInfoField, getSchemaMigrationStatusString(migration) ?? EmptySettingValue);
		this._schemaMigrationStatusInfoField.icon!.iconPath = getSchemaMigrationStatusImage(migration);
		this._updateInfoFieldValue(this._objectsCollectionCountInfoField, objectCollection?.totalCountOfObjectsCollected?.toString() ?? EmptySettingValue);
		this._objectsCollectionCountInfoField.icon!.iconPath = getObjectsCollectionStatusImage(migration);
		this._updateInfoFieldValue(this._objectsCollectionStartedInfoField, this._convertToLocalDateTime(objectCollection?.startedOn));
		this._updateInfoFieldValue(this._objectsCollectionEndedInfoField, this._convertToLocalDateTime(objectCollection?.endedOn));
		this._updateInfoFieldValue(this._scriptGenerationProgressInfoField, scriptGeneration?.progressInPercentage === undefined ? EmptySettingValue : scriptGeneration?.progressInPercentage + "%");
		this._scriptGenerationProgressInfoField.icon!.iconPath = getScriptGenerationStatusImage(migration);
		this._updateInfoFieldValue(this._scriptGenerationStartedInfoField, this._convertToLocalDateTime(scriptGeneration?.startedOn));
		this._updateInfoFieldValue(this._scriptGenerationEndedInfoField, this._convertToLocalDateTime(scriptGeneration?.endedOn));
		this._updateInfoFieldValue(this._succeededScriptCountInfoField, scriptGeneration?.scriptedObjectsCount?.toString() ?? EmptySettingValue);
		this._updateInfoFieldValue(this._failedScriptCountInfoField, scriptGeneration?.scriptedObjectsFailedCount?.toString() ?? EmptySettingValue);

		// Right side
		this._updateInfoFieldValue(this._targetDatabaseInfoField, targetDatabaseName ?? EmptySettingValue);
		this._updateInfoFieldValue(this._targetServerInfoField, targetServerName ?? EmptySettingValue);
		this._updateInfoFieldValue(this._targetVersionInfoField, targetServerVersion ?? EmptySettingValue);
		if (migration.properties.sqlSchemaMigrationConfiguration.enableSchemaMigration && migration.properties.sqlDataMigrationConfiguration.enableDataMigration) {
			this._updateInfoFieldValue(this._migrationType, loc.SCHEMA_AND_DATA);
		} else if (migration.properties.sqlSchemaMigrationConfiguration.enableSchemaMigration) {
			this._updateInfoFieldValue(this._migrationType, loc.SCHEMA_ONLY);
		} else if (migration.properties.sqlDataMigrationConfiguration.enableDataMigration) {
			this._updateInfoFieldValue(this._migrationType, loc.DATA_ONLY);
		}
		this._updateInfoFieldValue(this._scriptDeploymentProgressInfoField, scriptDeployment?.progressInPercentage === undefined ? EmptySettingValue : scriptDeployment?.progressInPercentage + "%");
		this._scriptDeploymentProgressInfoField.icon!.iconPath = getScriptDeploymentStatusImage(migration);
		this._updateInfoFieldValue(this._scriptDeploymentStartedField, this._convertToLocalDateTime(scriptDeployment?.startedOn));
		this._updateInfoFieldValue(this._scriptDeploymentEndedInfoField, this._convertToLocalDateTime(scriptDeployment?.endedOn));
		this._updateInfoFieldValue(this._succeededDeploymentCountInfoField, scriptDeployment?.succeededDeploymentCount?.toString() ?? EmptySettingValue);
		this._updateInfoFieldValue(this._failedDeploymentCountInfoField, scriptDeployment?.failedDeploymentCount?.toString() ?? EmptySettingValue);

		this.cutoverButton.enabled = canCutoverMigration(migration);
		this.cancelButton.enabled = canCancelMigration(migration);
		this.deleteButton.enabled = canDeleteMigration(migration);
		this.retryButton.enabled = canRetryMigration(migration);
		this.restartButton.enabled = canRestartMigrationWizard(migration);
	}

	private _convertToLocalDateTime(utcDataTime: string | undefined): string {
		if (utcDataTime) {
			var localDateTime = new Date(utcDataTime);
			return localDateTime.toLocaleString();
		} else {
			return EmptySettingValue;
		}
	}

	private async _populateTableData(hashSet: loc.LookupTable<number> = {}): Promise<void> {
		if (this._progressTable.data.length > 0) {
			await this._progressTable.updateProperty('data', []);
		}

		// Sort table data
		this._sortTableMigrations(
			this._progressDetail,
			(<azdata.CategoryValue>this._columnSortDropdown.value).name,
			this._columnSortCheckbox.checked === true);

		const data = this._progressDetail.map((d) => {
			hashSet[d.status] = (hashSet[d.status] ?? 0) + 1;
			return [
				d.tableName,
				<azdata.HyperlinkColumnCellValue>{
					icon: getPipelineStatusImage(d.status),
					title: loc.PipelineRunStatus[d.status] ?? d.status?.toUpperCase(),
				},
				formatSizeBytes(d.dataRead),
				formatSizeBytes(d.dataWritten),
				formatNumber(d.rowsRead),
				formatNumber(d.rowsCopied),
				formatSizeKb(d.copyThroughput),
				formatSecondsIntoReadableTime((d.copyDuration ?? 0)),
				loc.ParallelCopyType[d.parallelCopyType] ?? d.parallelCopyType,
				d.usedParallelCopies,
				formatDateTimeString(d.copyStart),
			];
		}) ?? [];

		// Filter tableData
		const filteredData = this._filterTables(data, this._tableFilterInputBox.value);
		await this._progressTable.updateProperty('data', filteredData);
	}

	private _clearControlsValue(): void {
		this._updateInfoFieldValue(this._sourceDatabaseInfoField, '');
		this._updateInfoFieldValue(this._sourceDetailsInfoField, '');
		this._updateInfoFieldValue(this._migrationStatusInfoField, '');
		this._updateInfoFieldValue(this._schemaMigrationStatusInfoField, '');
		this._updateInfoFieldValue(this._objectsCollectionCountInfoField, '');
		this._updateInfoFieldValue(this._objectsCollectionStartedInfoField, '');
		this._updateInfoFieldValue(this._objectsCollectionEndedInfoField, '');
		this._updateInfoFieldValue(this._scriptGenerationProgressInfoField, '');
		this._updateInfoFieldValue(this._scriptGenerationStartedInfoField, '');
		this._updateInfoFieldValue(this._scriptGenerationEndedInfoField, '');
		this._updateInfoFieldValue(this._succeededScriptCountInfoField, '');
		this._updateInfoFieldValue(this._failedScriptCountInfoField, '');

		this._updateInfoFieldValue(this._targetDatabaseInfoField, '');
		this._updateInfoFieldValue(this._targetServerInfoField, '');
		this._updateInfoFieldValue(this._targetVersionInfoField, '');
		this._updateInfoFieldValue(this._migrationType, '');
		this._updateInfoFieldValue(this._scriptDeploymentProgressInfoField, '');
		this._updateInfoFieldValue(this._scriptDeploymentStartedField, '');
		this._updateInfoFieldValue(this._scriptDeploymentEndedInfoField, '');
		this._updateInfoFieldValue(this._succeededDeploymentCountInfoField, '');
		this._updateInfoFieldValue(this._failedDeploymentCountInfoField, '');
	}

	private _sortTableMigrations(data: CopyProgressDetail[], columnName: string, ascending: boolean): void {
		const sortDir = ascending ? -1 : 1;
		switch (columnName) {
			case TableColumns.tableName:
				data.sort((t1, t2) => this.stringCompare(t1.tableName, t2.tableName, sortDir));
				return;
			case TableColumns.status:
				data.sort((t1, t2) => this.stringCompare(t1.status, t2.status, sortDir));
				return;
			case TableColumns.dataRead:
				data.sort((t1, t2) => this.numberCompare(t1.dataRead, t2.dataRead, sortDir));
				return;
			case TableColumns.dataWritten:
				data.sort((t1, t2) => this.numberCompare(t1.dataWritten, t2.dataWritten, sortDir));
				return;
			case TableColumns.rowsRead:
				data.sort((t1, t2) => this.numberCompare(t1.rowsRead, t2.rowsRead, sortDir));
				return;
			case TableColumns.rowsCopied:
				data.sort((t1, t2) => this.numberCompare(t1.rowsCopied, t2.rowsCopied, sortDir));
				return;
			case TableColumns.copyThroughput:
				data.sort((t1, t2) => this.numberCompare(t1.copyThroughput, t2.copyThroughput, sortDir));
				return;
			case TableColumns.copyDuration:
				data.sort((t1, t2) => this.numberCompare(t1.copyDuration, t2.copyDuration, sortDir));
				return;
			case TableColumns.parallelCopyType:
				data.sort((t1, t2) => this.stringCompare(t1.parallelCopyType, t2.parallelCopyType, sortDir));
				return;
			case TableColumns.usedParallelCopies:
				data.sort((t1, t2) => this.numberCompare(t1.usedParallelCopies, t2.usedParallelCopies, sortDir));
				return;
			case TableColumns.copyStart:
				data.sort((t1, t2) => this.dateCompare(t1.copyStart, t2.copyStart, sortDir));
				return;
		}
	}

	private _updateSummaryComponent(cardIndex: number, value: number): void {
		const stringValue = value.toLocaleString();
		const textComponent = this.summaryTextComponent[cardIndex];
		textComponent.value = stringValue;
		textComponent.title = stringValue;
	}

	private _filterTables(tables: any[], value: string | undefined): any[] {
		const lcValue = value?.toLowerCase() ?? '';

		return lcValue.length > 0
			? tables.filter((table: string[]) =>
				table.some((col: string | { title: string }) => {
					return typeof (col) === 'string'
						? col.toLowerCase().includes(lcValue)
						: col.title?.toLowerCase().includes(lcValue);
				}))
			: tables;
	}

	private async _createTableFilter(): Promise<azdata.FlexContainer> {
		this._tableFilterInputBox = this.view.modelBuilder.inputBox()
			.withProps({
				inputType: 'text',
				maxLength: 100,
				width: 268,
				placeHolder: loc.FILTER_SERVER_OBJECTS_PLACEHOLDER,
				ariaLabel: loc.FILTER_SERVER_OBJECTS_ARIA_LABEL,
			})
			.component();

		this.disposables.push(
			this._tableFilterInputBox.onTextChanged(
				async (value) => await this._populateTableData()));

		const sortLabel = this.view.modelBuilder.text()
			.withProps({
				value: loc.SORT_LABEL,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': '600',
					'margin': '3px 0 0 0',
				},
			}).component();

		this._columnSortDropdown = this.view.modelBuilder.dropDown()
			.withProps({
				editable: false,
				width: 150,
				CSSStyles: { 'margin-left': '5px' },
				value: <azdata.CategoryValue>{ name: TableColumns.copyStart, displayName: loc.START_TIME },
				values: [
					<azdata.CategoryValue>{ name: TableColumns.tableName, displayName: loc.SQLDB_COL_TABLE_NAME },
					<azdata.CategoryValue>{ name: TableColumns.status, displayName: loc.STATUS },
					<azdata.CategoryValue>{ name: TableColumns.dataRead, displayName: loc.SQLDB_COL_DATA_READ },
					<azdata.CategoryValue>{ name: TableColumns.dataWritten, displayName: loc.SQLDB_COL_DATA_WRITTEN },
					<azdata.CategoryValue>{ name: TableColumns.rowsRead, displayName: loc.SQLDB_COL_ROWS_READ },
					<azdata.CategoryValue>{ name: TableColumns.rowsCopied, displayName: loc.SQLDB_COL_ROWS_COPIED },
					<azdata.CategoryValue>{ name: TableColumns.copyThroughput, displayName: loc.SQLDB_COL_COPY_THROUGHPUT },
					<azdata.CategoryValue>{ name: TableColumns.copyDuration, displayName: loc.SQLDB_COL_COPY_DURATION },
					<azdata.CategoryValue>{ name: TableColumns.parallelCopyType, displayName: loc.SQLDB_COL_PARRALEL_COPY_TYPE },
					<azdata.CategoryValue>{ name: TableColumns.usedParallelCopies, displayName: loc.SQLDB_COL_USED_PARALLEL_COPIES },
					<azdata.CategoryValue>{ name: TableColumns.copyStart, displayName: loc.SQLDB_COL_COPY_START },
				],
			})
			.component();
		this.disposables.push(
			this._columnSortDropdown.onValueChanged(
				async (value) => await this._populateTableData()));

		this._columnSortCheckbox = this.view.modelBuilder.checkBox()
			.withProps({
				label: loc.ASCENDING_LABEL,
				checked: false,
				CSSStyles: { 'margin-left': '15px' },
			})
			.component();
		this.disposables.push(
			this._columnSortCheckbox.onChanged(
				async (value) => await this._populateTableData()));

		const columnSortContainer = this.view.modelBuilder.flexContainer()
			.withItems([sortLabel, this._columnSortDropdown])
			.withProps({
				CSSStyles: {
					'justify-content': 'left',
					'align-items': 'center',
					'padding': '0px',
					'display': 'flex',
					'flex-direction': 'row',
				},
			}).component();
		columnSortContainer.addItem(this._columnSortCheckbox, { flex: '0 0 auto' });

		const flexContainer = this.view.modelBuilder.flexContainer()
			.withProps({
				width: '100%',
				CSSStyles: {
					'justify-content': 'left',
					'align-items': 'center',
					'padding': '0px',
					'display': 'flex',
					'flex-direction': 'row',
					'flex-flow': 'wrap',
				},
			}).component();
		flexContainer.addItem(this._tableFilterInputBox, { flex: '0' });
		flexContainer.addItem(columnSortContainer, { flex: '0', CSSStyles: { 'margin-left': '10px' } });

		return flexContainer;
	}

	private async _createStatusBar(): Promise<azdata.FlexContainer> {
		const serverObjectsLabel = this.view.modelBuilder.text()
			.withProps({
				value: loc.SERVER_OBJECTS_LABEL,
				CSSStyles: {
					'font-weight': '600',
					'font-size': '14px',
					'margin': '0 0 5px 0',
				},
			})
			.component();

		const flexContainer = this.view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
				flexWrap: 'wrap',
			})
			.component();

		flexContainer.addItems([
			await this.createInfoCard(loc.SERVER_OBJECTS_ALL_TABLES_LABEL, IconPathHelper.allTables),
			await this.createInfoCard(loc.SERVER_OBJECTS_IN_PROGRESS_TABLES_LABEL, IconPathHelper.inProgressMigration),
			await this.createInfoCard(loc.SERVER_OBJECTS_SUCCESSFUL_TABLES_LABEL, IconPathHelper.completedMigration),
			await this.createInfoCard(loc.SERVER_OBJECTS_FAILED_TABLES_LABEL, IconPathHelper.error),
			await this.createInfoCard(loc.SERVER_OBJECTS_CANCELLED_TABLES_LABEL, IconPathHelper.cancel)
		], { flex: '0 0 auto', CSSStyles: { 'width': '168px' } });

		return this.view.modelBuilder.flexContainer()
			.withItems([serverObjectsLabel, flexContainer])
			.withLayout({ flexFlow: 'column' })
			.component();
	}
}
