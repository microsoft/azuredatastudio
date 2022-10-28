/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../constants/iconPathHelper';
import { getCurrentMigrations, getSelectedServiceStatus } from '../models/migrationLocalStorage';
import * as loc from '../constants/strings';
import { filterMigrations, getMigrationDuration, getMigrationStatusImage, getMigrationStatusWithErrors, getMigrationTime, MenuCommands } from '../api/utils';
import { getMigrationTargetType, getMigrationMode, canCancelMigration, canCutoverMigration } from '../constants/helper';
import { DatabaseMigration, getResourceName } from '../api/azure';
import { logError, TelemetryViews } from '../telemtery';
import { SelectMigrationServiceDialog } from '../dialog/selectMigrationService/selectMigrationServiceDialog';
import { AdsMigrationStatus, EmptySettingValue, ServiceContextChangeEvent, TabBase } from './tabBase';
import { DashboardStatusBar } from './DashboardStatusBar';

export const MigrationsListTabId = 'MigrationsListTab';

const TableColumns = {
	sourceDatabase: 'sourceDatabase',
	sourceServer: 'sourceServer',
	status: 'status',
	mode: 'mode',
	targetType: 'targetType',
	targetDatabse: 'targetDatabase',
	targetServer: 'TargetServer',
	duration: 'duration',
	startTime: 'startTime',
	finishTime: 'finishTime',
};

export class MigrationsListTab extends TabBase<MigrationsListTab> {
	private _searchBox!: azdata.InputBoxComponent;
	private _refresh!: azdata.ButtonComponent;
	private _serviceContextButton!: azdata.ButtonComponent;
	private _statusDropdown!: azdata.DropDownComponent;
	private _columnSortDropdown!: azdata.DropDownComponent;
	private _columnSortCheckbox!: azdata.CheckBoxComponent;
	private _statusTable!: azdata.TableComponent;
	private _refreshLoader!: azdata.LoadingComponent;
	private _filteredMigrations: DatabaseMigration[] = [];
	private _openMigrationDetails!: (migration: DatabaseMigration) => Promise<void>;
	private _migrations: DatabaseMigration[] = [];

	constructor() {
		super();
		this.id = MigrationsListTabId;
	}

	public async create(
		context: vscode.ExtensionContext,
		view: azdata.ModelView,
		openMigrationDetails: (migration: DatabaseMigration) => Promise<void>,
		serviceContextChangedEvent: vscode.EventEmitter<ServiceContextChangeEvent>,
		statusBar: DashboardStatusBar,
	): Promise<MigrationsListTab> {

		this.view = view;
		this.context = context;
		this._openMigrationDetails = openMigrationDetails;
		this.serviceContextChangedEvent = serviceContextChangedEvent;
		this.statusBar = statusBar;

		await this.initialize();

		return this;
	}

	public async setMigrationFilter(filter: AdsMigrationStatus): Promise<void> {
		if (this._statusDropdown.values && this._statusDropdown.values.length > 0) {
			const statusFilter = (<azdata.CategoryValue[]>this._statusDropdown.values)
				.find(value => value.name === filter.toString());

			await this._statusDropdown.updateProperties({ 'value': statusFilter });
		}
	}

	public async refresh(): Promise<void> {
		if (this.isRefreshing ||
			this._refreshLoader === undefined) {

			return;
		}

		try {
			this.isRefreshing = true;
			this._refreshLoader.loading = true;

			await this.statusBar.clearError();

			await this._statusTable.updateProperty('data', []);
			this._migrations = await getCurrentMigrations();
			await this._populateMigrationTable();
		} catch (e) {
			await this.statusBar.showError(
				loc.DASHBOARD_REFRESH_MIGRATIONS_TITLE,
				loc.DASHBOARD_REFRESH_MIGRATIONS_LABEL,
				e.message);
			logError(TelemetryViews.MigrationsTab, 'refreshMigrations', e);
		} finally {
			this._refreshLoader.loading = false;
			this.isRefreshing = false;
		}
	}

	protected async initialize(): Promise<void> {
		this._createStatusTable();
		this.content = this.view.modelBuilder.flexContainer()
			.withItems(
				[
					this._createToolbar(),
					await this._createSearchAndSortContainer(),
					this._statusTable,
				],
				{ CSSStyles: { 'width': '100%' } }
			).withLayout({ width: '100%', flexFlow: 'column' })
			.withProps({ CSSStyles: { 'padding': '0px' } })
			.component();
	}

	private _createToolbar(): azdata.ToolbarContainer {
		const toolbar = this.view.modelBuilder.toolbarContainer();

		this._refresh = this.view.modelBuilder.button()
			.withProps({
				iconPath: IconPathHelper.refresh,
				iconHeight: 24,
				iconWidth: 24,
				height: 24,
				label: loc.REFRESH_BUTTON_LABEL,
			}).component();
		this.disposables.push(
			this._refresh.onDidClick(
				async (e) => await this.refresh()));

		this._refreshLoader = this.view.modelBuilder.loadingComponent()
			.withItem(this._refresh)
			.withProps({
				loading: false,
				CSSStyles: { 'height': '8px', 'margin-top': '6px' }
			}).component();

		toolbar.addToolbarItems([
			<azdata.ToolbarComponent>{ component: this.createNewMigrationButton(), toolbarSeparatorAfter: true },
			<azdata.ToolbarComponent>{ component: this.createNewSupportRequestButton() },
			<azdata.ToolbarComponent>{ component: this.createFeedbackButton(), toolbarSeparatorAfter: true },
			<azdata.ToolbarComponent>{ component: this._refreshLoader },
		]);

		return toolbar.component();
	}

	private async _createSearchAndSortContainer(): Promise<azdata.FlexContainer> {
		const serviceContextLabel = await getSelectedServiceStatus();
		this._serviceContextButton = this.view.modelBuilder.button()
			.withProps({
				iconPath: IconPathHelper.sqlMigrationService,
				iconHeight: 22,
				iconWidth: 22,
				label: serviceContextLabel,
				title: serviceContextLabel,
				description: loc.MIGRATION_SERVICE_DESCRIPTION,
				buttonType: azdata.ButtonType.Informational,
				width: 230,
			}).component();

		this.disposables.push(
			this._serviceContextButton.onDidClick(
				async () => {
					const dialog = new SelectMigrationServiceDialog(this.serviceContextChangedEvent);
					await dialog.initialize();
				}));

		const connectionProfile = await azdata.connection.getCurrentConnection();
		this.disposables.push(
			this.serviceContextChangedEvent.event(
				async (e) => {
					if (e.connectionId === connectionProfile.connectionId) {
						await this.updateServiceContext(this._serviceContextButton);
						await this.refresh();
					}
				}
			));
		await this.updateServiceContext(this._serviceContextButton);

		this._searchBox = this.view.modelBuilder.inputBox()
			.withProps({
				stopEnterPropagation: true,
				placeHolder: loc.SEARCH_FOR_MIGRATIONS,
				width: '200px',
			}).component();
		this.disposables.push(
			this._searchBox.onTextChanged(
				async (value) => await this._populateMigrationTable()));

		const searchLabel = this.view.modelBuilder.text()
			.withProps({
				value: loc.STATUS_LABEL,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': '600',
					'margin': '3px 0 0 0',
				},
			}).component();

		this._statusDropdown = this.view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: loc.MIGRATION_STATUS_FILTER,
				values: this._statusDropdownValues,
				width: '150px',
				fireOnTextChange: true,
				value: this._statusDropdownValues[0],
			}).component();
		this.disposables.push(
			this._statusDropdown.onValueChanged(
				async (value) => await this._populateMigrationTable()));

		const searchContainer = this.view.modelBuilder.flexContainer()
			.withLayout({
				alignContent: 'center',
				alignItems: 'center',
			}).withProps({ CSSStyles: { 'margin-left': '10px' } })
			.component();
		searchContainer.addItem(searchLabel, { flex: '0' });
		searchContainer.addItem(this._statusDropdown, { flex: '0', CSSStyles: { 'margin-left': '5px' } });

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
				width: 120,
				CSSStyles: { 'margin-left': '5px' },
				value: <azdata.CategoryValue>{ name: TableColumns.startTime, displayName: loc.START_TIME },
				values: [
					<azdata.CategoryValue>{ name: TableColumns.sourceDatabase, displayName: loc.SRC_DATABASE },
					<azdata.CategoryValue>{ name: TableColumns.sourceServer, displayName: loc.SRC_SERVER },
					<azdata.CategoryValue>{ name: TableColumns.status, displayName: loc.STATUS_COLUMN },
					<azdata.CategoryValue>{ name: TableColumns.mode, displayName: loc.MIGRATION_MODE },
					<azdata.CategoryValue>{ name: TableColumns.targetType, displayName: loc.AZURE_SQL_TARGET },
					<azdata.CategoryValue>{ name: TableColumns.targetDatabse, displayName: loc.TARGET_DATABASE_COLUMN },
					<azdata.CategoryValue>{ name: TableColumns.targetServer, displayName: loc.TARGET_SERVER_COLUMN },
					<azdata.CategoryValue>{ name: TableColumns.duration, displayName: loc.DURATION },
					<azdata.CategoryValue>{ name: TableColumns.startTime, displayName: loc.START_TIME },
					<azdata.CategoryValue>{ name: TableColumns.finishTime, displayName: loc.FINISH_TIME },
				],
			})
			.component();
		this.disposables.push(
			this._columnSortDropdown.onValueChanged(
				async (e) => await this._populateMigrationTable()));

		this._columnSortCheckbox = this.view.modelBuilder.checkBox()
			.withProps({
				label: loc.ASCENDING_LABEL,
				checked: false,
				CSSStyles: { 'margin-left': '15px' },
			})
			.component();
		this.disposables.push(
			this._columnSortCheckbox.onChanged(
				async (e) => await this._populateMigrationTable()));

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

		flexContainer.addItem(this._serviceContextButton, { flex: '0', CSSStyles: { 'margin-left': '10px' } });
		flexContainer.addItem(this._searchBox, { flex: '0', CSSStyles: { 'margin-left': '10px' } });
		flexContainer.addItem(searchContainer, { flex: '0', CSSStyles: { 'margin-left': '10px' } });
		flexContainer.addItem(columnSortContainer, { flex: '0', CSSStyles: { 'margin-left': '10px' } });

		const container = this.view.modelBuilder.flexContainer()
			.withProps({ width: '100%' })
			.component();

		container.addItem(flexContainer);
		return container;
	}

	private _sortMigrations(migrations: DatabaseMigration[], columnName: string, ascending: boolean): void {
		const sortDir = ascending ? -1 : 1;
		switch (columnName) {
			case TableColumns.sourceDatabase:
				migrations.sort(
					(m1, m2) => this.stringCompare(
						m1.properties.sourceDatabaseName,
						m2.properties.sourceDatabaseName,
						sortDir));
				return;
			case TableColumns.sourceServer:
				migrations.sort(
					(m1, m2) => this.stringCompare(
						m1.properties.sourceServerName,
						m2.properties.sourceServerName,
						sortDir));
				return;
			case TableColumns.status:
				migrations.sort(
					(m1, m2) => this.stringCompare(
						getMigrationStatusWithErrors(m1),
						getMigrationStatusWithErrors(m2),
						sortDir));
				return;
			case TableColumns.mode:
				migrations.sort(
					(m1, m2) => this.stringCompare(
						getMigrationMode(m1),
						getMigrationMode(m2),
						sortDir));
				return;
			case TableColumns.targetType:
				migrations.sort(
					(m1, m2) => this.stringCompare(
						getMigrationTargetType(m1),
						getMigrationTargetType(m2),
						sortDir));
				return;
			case TableColumns.targetDatabse:
				migrations.sort(
					(m1, m2) => this.stringCompare(
						getResourceName(m1.id),
						getResourceName(m2.id),
						sortDir));
				return;
			case TableColumns.targetServer:
				migrations.sort(
					(m1, m2) => this.stringCompare(
						getResourceName(m1.properties.scope),
						getResourceName(m2.properties.scope),
						sortDir));
				return;
			case TableColumns.duration:
				migrations.sort((m1, m2) => {
					if (!m1.properties.startedOn) {
						return sortDir;
					} else if (!m2.properties.startedOn) {
						return -sortDir;
					}
					const m1_startedOn = new Date(m1.properties.startedOn);
					const m2_startedOn = new Date(m2.properties.startedOn);
					const m1_endedOn = new Date(m1.properties.endedOn ?? Date.now());
					const m2_endedOn = new Date(m2.properties.endedOn ?? Date.now());
					const m1_duration = m1_endedOn.getTime() - m1_startedOn.getTime();
					const m2_duration = m2_endedOn.getTime() - m2_startedOn.getTime();
					return m1_duration > m2_duration ? -sortDir : sortDir;
				});
				return;
			case TableColumns.startTime:
				migrations.sort(
					(m1, m2) => this.dateCompare(
						m1.properties.startedOn,
						m2.properties.startedOn,
						sortDir));
				return;
			case TableColumns.finishTime:
				migrations.sort(
					(m1, m2) => this.dateCompare(
						m1.properties.endedOn,
						m2.properties.endedOn,
						sortDir));
				return;
		}
	}

	private async _populateMigrationTable(): Promise<void> {
		try {
			this._filteredMigrations = filterMigrations(
				this._migrations,
				(<azdata.CategoryValue>this._statusDropdown.value).name,
				this._searchBox.value!);

			this._sortMigrations(
				this._filteredMigrations,
				(<azdata.CategoryValue>this._columnSortDropdown.value).name,
				this._columnSortCheckbox.checked === true);

			const connectionProfile = await azdata.connection.getCurrentConnection();
			const data: any[] = this._filteredMigrations.map((migration, index) => {
				return [
					<azdata.HyperlinkColumnCellValue>{
						icon: IconPathHelper.sqlDatabaseLogo,
						title: migration.properties.sourceDatabaseName ?? EmptySettingValue,
					},															// sourceDatabase
					migration.properties.sourceServerName ?? EmptySettingValue, // sourceServer
					<azdata.HyperlinkColumnCellValue>{
						icon: getMigrationStatusImage(migration),
						title: getMigrationStatusWithErrors(migration),
					},															// statue
					getMigrationMode(migration),								// mode
					getMigrationTargetType(migration),							// targetType
					getResourceName(migration.id),								// targetDatabase
					getResourceName(migration.properties.scope),				// targetServer
					getMigrationDuration(
						migration.properties.startedOn,
						migration.properties.endedOn),							// duration
					getMigrationTime(migration.properties.startedOn),			// startTime
					getMigrationTime(migration.properties.endedOn),				// finishTime
					<azdata.ContextMenuColumnCellValue>{
						title: '',
						context: {
							connectionId: connectionProfile.connectionId,
							migrationId: migration.id,
							migrationOperationId: migration.properties.migrationOperationId,
						},
						commands: this._getMenuCommands(migration),				// context menu
					},
				];
			});

			await this._statusTable.updateProperty('data', data);
		} catch (e) {
			await this.statusBar.showError(
				loc.LOAD_MIGRATION_LIST_ERROR,
				loc.LOAD_MIGRATION_LIST_ERROR,
				e.message);
			logError(TelemetryViews.MigrationStatusDialog, 'Error populating migrations list page', e);
		}
	}

	private _createStatusTable(): azdata.TableComponent {
		const headerCssStyles = undefined;
		const rowCssStyles = undefined;

		this._statusTable = this.view.modelBuilder.table()
			.withProps({
				ariaLabel: loc.MIGRATION_STATUS,
				CSSStyles: { 'margin-left': '10px' },
				data: [],
				forceFitColumns: azdata.ColumnSizingMode.AutoFit,
				height: '500px',
				columns: [
					<azdata.HyperlinkColumn>{
						cssClass: rowCssStyles,
						headerCssClass: headerCssStyles,
						name: loc.SRC_DATABASE,
						value: 'sourceDatabase',
						width: 170,
						type: azdata.ColumnType.hyperlink,
					},
					{
						cssClass: rowCssStyles,
						headerCssClass: headerCssStyles,
						name: loc.SRC_SERVER,
						value: 'sourceServer',
						width: 170,
						type: azdata.ColumnType.text,
					},
					<azdata.HyperlinkColumn>{
						cssClass: rowCssStyles,
						headerCssClass: headerCssStyles,
						name: loc.STATUS_COLUMN,
						value: 'status',
						width: 160,
						type: azdata.ColumnType.hyperlink,
					},
					{
						cssClass: rowCssStyles,
						headerCssClass: headerCssStyles,
						name: loc.MIGRATION_MODE,
						value: 'mode',
						width: 55,
						type: azdata.ColumnType.text,
					},
					{
						cssClass: rowCssStyles,
						headerCssClass: headerCssStyles,
						name: loc.AZURE_SQL_TARGET,
						value: 'targetType',
						width: 120,
						type: azdata.ColumnType.text,
					},
					{
						cssClass: rowCssStyles,
						headerCssClass: headerCssStyles,
						name: loc.TARGET_DATABASE_COLUMN,
						value: 'targetDatabase',
						width: 125,
						type: azdata.ColumnType.text,
					},
					{
						cssClass: rowCssStyles,
						headerCssClass: headerCssStyles,
						name: loc.TARGET_SERVER_COLUMN,
						value: 'targetServer',
						width: 125,
						type: azdata.ColumnType.text,
					},
					{
						cssClass: rowCssStyles,
						headerCssClass: headerCssStyles,
						name: loc.DURATION,
						value: 'duration',
						width: 55,
						type: azdata.ColumnType.text,
					},
					{
						cssClass: rowCssStyles,
						headerCssClass: headerCssStyles,
						name: loc.START_TIME,
						value: 'startTime',
						width: 115,
						type: azdata.ColumnType.text,
					},
					{
						cssClass: rowCssStyles,
						headerCssClass: headerCssStyles,
						name: loc.FINISH_TIME,
						value: 'finishTime',
						width: 115,
						type: azdata.ColumnType.text,
					},
					{
						cssClass: rowCssStyles,
						headerCssClass: headerCssStyles,
						name: '',
						value: 'contextMenu',
						width: 25,
						type: azdata.ColumnType.contextMenu,
					}
				]
			}).component();

		this.disposables.push(
			this._statusTable.onCellAction!(async (rowState: azdata.ICellActionEventArgs) => {
				const buttonState = <azdata.ICellActionEventArgs>rowState;
				const migration = this._filteredMigrations[rowState.row];
				switch (buttonState?.column) {
					// "Migration status" column
					case 2:
						const statusMessage = loc.DATABASE_MIGRATION_STATUS_LABEL(getMigrationStatusWithErrors(migration));
						const errors = this.getMigrationErrors(migration!);

						this.showDialogMessage(
							loc.DATABASE_MIGRATION_STATUS_TITLE,
							statusMessage,
							errors);
						break;
					// "Source database" column
					case 0:
						await this._openMigrationDetails(migration);
						break;
				}
			}));

		return this._statusTable;
	}

	private _getMenuCommands(migration: DatabaseMigration): string[] {
		const menuCommands: string[] = [];

		if (canCutoverMigration(migration)) {
			menuCommands.push(MenuCommands.Cutover);
		}

		menuCommands.push(...[
			MenuCommands.ViewDatabase,
			MenuCommands.ViewTarget,
			MenuCommands.ViewService,
			MenuCommands.CopyMigration]);

		if (canCancelMigration(migration)) {
			menuCommands.push(MenuCommands.CancelMigration);
		}

		return menuCommands;
	}

	private _statusDropdownValues: azdata.CategoryValue[] = [
		{ displayName: loc.STATUS_ALL, name: AdsMigrationStatus.ALL },
		{ displayName: loc.STATUS_ONGOING, name: AdsMigrationStatus.ONGOING },
		{ displayName: loc.STATUS_COMPLETING, name: AdsMigrationStatus.COMPLETING },
		{ displayName: loc.STATUS_SUCCEEDED, name: AdsMigrationStatus.SUCCEEDED },
		{ displayName: loc.STATUS_FAILED, name: AdsMigrationStatus.FAILED }
	];
}
