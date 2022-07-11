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
import { getResourceName } from '../api/azure';
import { InfoFieldSchema, infoFieldLgWidth, MigrationDetailsTabBase, MigrationTargetTypeName } from './migrationDetailsTabBase';
import { EmptySettingValue } from './tabBase';
import { IconPathHelper } from '../constants/iconPathHelper';
import { DashboardStatusBar } from './sqlServerDashboard';
import { EOL } from 'os';

const MigrationDetailsTableTabId = 'MigrationDetailsTableTab';

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
	private _progressTable!: azdata.TableComponent;

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
		await this._progressTable.updateProperty('data', []);

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
		const tableData: any[] = migration?.properties.migrationStatusDetails?.listOfCopyProgressDetails?.map((d) => {
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

		const successCount = hashSet[PipelineStatusCodes.Succeeded] ?? 0;
		const cancelledCount = hashSet[PipelineStatusCodes.Cancelled] ?? 0;
		const failedCount = hashSet[PipelineStatusCodes.Failed] ?? 0;
		const inProgressCount = (hashSet[PipelineStatusCodes.Queued] ?? 0) + (hashSet[PipelineStatusCodes.InProgress] ?? 0);
		const totalCount = tableData.length;

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
		this._serverObjectsInfoField.text.value = tableData.length.toLocaleString();

		// Sorting files in descending order of backupStartTime
		tableData.sort((file1, file2) => new Date(file1.backupStartTime) > new Date(file2.backupStartTime) ? - 1 : 1);

		// Filter tableData
		const data = this._filterTables(tableData, this._tableFilterInputBox.value);

		await this._progressTable.updateProperty('data', data);

		this.cutoverButton.enabled = canCutoverMigration(migration);
		this.cancelButton.enabled = canCancelMigration(migration);
		this.retryButton.enabled = canRetryMigration(migration);
		this.isRefreshing = false;
		this.refreshLoader.loading = false;
		this.refreshButton.enabled = true;
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
							value: 'tableName',
							name: 'Table name',
							type: azdata.ColumnType.text,
							width: 170,
						},
						<azdata.HyperlinkColumn>{
							name: loc.STATUS,
							value: 'status',
							width: 106,
							type: azdata.ColumnType.hyperlink,
							icon: IconPathHelper.inProgressMigration,
							showText: true,
						},
						{
							value: 'dataRead',
							name: 'Data read',
							width: 64,
							type: azdata.ColumnType.text,
						},
						{
							value: 'dataWritten',
							name: 'Data written',
							width: 77,
							type: azdata.ColumnType.text,
						},
						{
							value: 'rowsRead',
							name: 'Rows read',
							width: 68,
							type: azdata.ColumnType.text,
						},
						{
							value: 'rowsCopied',
							name: 'Rows copied',
							width: 77,
							type: azdata.ColumnType.text,
						},
						{
							value: 'copyThroughput',
							name: 'Copy throughput',
							width: 102,
							type: azdata.ColumnType.text,
						},
						{
							value: 'copyDuration',
							name: 'Copy duration',
							width: 87,
							type: azdata.ColumnType.text,
						},
						{
							value: 'parallelCopyType',
							name: 'Parallel copy type',
							width: 104,
							type: azdata.ColumnType.text,
						},
						{
							value: 'usedParallelCopies',
							name: 'Used parallel copies',
							width: 116,
							type: azdata.ColumnType.text,
						},
						{
							value: 'copyStart',
							name: 'Copy start',
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
							if (errors.length > 0) {
								this.showDialogMessage(
									loc.TABLE_MIGRATION_ERROR_TITLE,
									errors.join(EOL));
							}
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

	private async _createTableFilter(): Promise<azdata.InputBoxComponent> {
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
				async (value) => await this.refresh()));

		return this._tableFilterInputBox;
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
