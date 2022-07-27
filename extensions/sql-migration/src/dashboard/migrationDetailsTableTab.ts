/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../constants/strings';
import { getSqlServerName, getMigrationStatusImage, getPipelineStatusImage, debounce } from '../api/utils';
import { logError, TelemetryViews } from '../telemtery';
import { canCancelMigration, canCutoverMigration, canRetryMigration, formatDateTimeString, formatNumber, formatSizeBytes, formatSizeKb, formatTime, getMigrationStatus, getMigrationTargetTypeEnum, isOfflineMigation, PipelineStatusCodes } from '../constants/helper';
import { CopyProgressDetail, getResourceName } from '../api/azure';
import { InfoFieldSchema, infoFieldLgWidth, MigrationDetailsTabBase, MigrationTargetTypeName } from './migrationDetailsTabBase';
import { EmptySettingValue } from './tabBase';
import { IconPathHelper } from '../constants/iconPathHelper';
import { DashboardStatusBar } from './sqlServerDashboard';
import { EOL } from 'os';

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
	private _sourceVersionInfoField!: InfoFieldSchema;
	private _targetDatabaseInfoField!: InfoFieldSchema;
	private _targetServerInfoField!: InfoFieldSchema;
	private _targetVersionInfoField!: InfoFieldSchema;
	private _migrationStatusInfoField!: InfoFieldSchema;
	private _serverObjectsInfoField!: InfoFieldSchema;
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
		onClosedCallback: () => Promise<void>,
		statusBar: DashboardStatusBar): Promise<MigrationDetailsTableTab> {

		this.view = view;
		this.context = context;
		this.onClosedCallback = onClosedCallback;
		this.statusBar = statusBar;

		await this.initialize(this.view);

		return this;
	}

	@debounce(500)
	public async refresh(): Promise<void> {
		if (this.isRefreshing) {
			return;
		}

		this.isRefreshing = true;
		this.refreshButton.enabled = false;
		this.refreshLoader.loading = true;
		await this.statusBar.clearError();

		try {
			await this.model.fetchStatus();
			await this._loadData();
		} catch (e) {
			await this.statusBar.showError(
				loc.MIGRATION_STATUS_REFRESH_ERROR,
				loc.MIGRATION_STATUS_REFRESH_ERROR,
				e.message);
		}

		this.isRefreshing = false;
		this.refreshLoader.loading = false;
		this.refreshButton.enabled = true;
	}

	private async _loadData(): Promise<void> {
		const migration = this.model?.migration;
		await this.showMigrationErrors(this.model?.migration);

		await this.cutoverButton.updateCssStyles(
			{ 'display': isOfflineMigation(migration) ? 'none' : 'block' });

		const sqlServerName = migration?.properties.sourceServerName;
		const sourceDatabaseName = migration?.properties.sourceDatabaseName;
		const sqlServerInfo = await azdata.connection.getServerInfo((await azdata.connection.getCurrentConnection()).connectionId);
		const versionName = getSqlServerName(sqlServerInfo.serverMajorVersion!);
		const sqlServerVersion = versionName ? versionName : sqlServerInfo.serverVersion;
		const targetDatabaseName = migration?.name;
		const targetServerName = getResourceName(migration?.properties.scope);

		const targetType = getMigrationTargetTypeEnum(migration);
		const targetServerVersion = MigrationTargetTypeName[targetType ?? ''];

		const hashSet: loc.LookupTable<number> = {};
		this._progressDetail = migration?.properties.migrationStatusDetails?.listOfCopyProgressDetails ?? [];
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

		const totalCount = migration.properties.migrationStatusDetails?.listOfCopyProgressDetails.length ?? 0;

		this._updateSummaryComponent(SummaryCardIndex.TotalTables, totalCount);
		this._updateSummaryComponent(SummaryCardIndex.InProgressTables, inProgressCount);
		this._updateSummaryComponent(SummaryCardIndex.SuccessfulTables, successCount);
		this._updateSummaryComponent(SummaryCardIndex.FailedTables, failedCount);
		this._updateSummaryComponent(SummaryCardIndex.CanceledTables, cancelledCount);

		this.databaseLabel.value = sourceDatabaseName;
		this._sourceDatabaseInfoField.text.value = sourceDatabaseName;
		this._sourceDetailsInfoField.text.value = sqlServerName;
		this._sourceVersionInfoField.text.value = `${sqlServerVersion} ${sqlServerInfo.serverVersion}`;

		this._targetDatabaseInfoField.text.value = targetDatabaseName;
		this._targetServerInfoField.text.value = targetServerName;
		this._targetVersionInfoField.text.value = targetServerVersion;

		this._migrationStatusInfoField.text.value = getMigrationStatus(migration) ?? EmptySettingValue;
		this._migrationStatusInfoField.icon!.iconPath = getMigrationStatusImage(migration);
		this._serverObjectsInfoField.text.value = totalCount.toLocaleString();

		this.cutoverButton.enabled = canCutoverMigration(migration);
		this.cancelButton.enabled = canCancelMigration(migration);
		this.retryButton.enabled = canRetryMigration(migration);
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
				formatTime((d.copyDuration ?? 0) * 1000),
				loc.ParallelCopyType[d.parallelCopyType] ?? d.parallelCopyType,
				d.usedParallelCopies,
				formatDateTimeString(d.copyStart),
			];
		}) ?? [];

		// Filter tableData
		const filteredData = this._filterTables(data, this._tableFilterInputBox.value);

		await this._progressTable.updateProperty('data', filteredData);
	}

	protected async initialize(view: azdata.ModelView): Promise<void> {
		try {
			this._progressTable = this.view.modelBuilder.table()
				.withProps({
					ariaLabel: loc.ACTIVE_BACKUP_FILES,
					CSSStyles: {
						'padding-left': '0px',
						'max-width': '1111px'
					},
					data: [],
					height: '300px',
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

			const formItems: azdata.FormComponent<azdata.Component>[] = [
				{ component: this.createMigrationToolbarContainer() },
				{ component: await this.migrationInfoGrid() },
				{
					component: this.view.modelBuilder.separator()
						.withProps({ width: '100%', CSSStyles: { 'padding': '0' } })
						.component()
				},
				{ component: await this._createStatusBar() },
				{ component: await this._createTableFilter() },
				{ component: this._progressTable },
			];

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

			const formContainer = this.view.modelBuilder.formContainer()
				.withFormItems(
					formItems,
					{ horizontal: false })
				.withProps({ width: '100%', CSSStyles: { margin: '0 0 0 5px', padding: '0 15px 0 15px' } })
				.component();

			this.content = formContainer;
		} catch (e) {
			logError(TelemetryViews.MigrationCutoverDialog, 'IntializingFailed', e);
		}
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

	protected async migrationInfoGrid(): Promise<azdata.FlexContainer> {
		const addInfoFieldToContainer = (infoField: InfoFieldSchema, container: azdata.FlexContainer): void => {
			container.addItem(
				infoField.flexContainer,
				{ CSSStyles: { width: infoFieldLgWidth } });
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
		this._serverObjectsInfoField = await this.createInfoField(loc.SERVER_OBJECTS_FIELD_LABEL, '');
		addInfoFieldToContainer(this._migrationStatusInfoField, flexStatus);
		addInfoFieldToContainer(this._serverObjectsInfoField, flexStatus);

		const flexInfoProps = {
			flex: '0',
			CSSStyles: { 'flex': '0', 'width': infoFieldLgWidth }
		};

		const flexInfo = this.view.modelBuilder.flexContainer()
			.withLayout({ flexWrap: 'wrap' })
			.withProps({ width: '100%' })
			.component();
		flexInfo.addItem(flexServer, flexInfoProps);
		flexInfo.addItem(flexTarget, flexInfoProps);
		flexInfo.addItem(flexStatus, flexInfoProps);

		return flexInfo;
	}
}
