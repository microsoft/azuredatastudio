/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../constants/iconPathHelper';
import { getCurrentMigrations, getSelectedServiceStatus, MigrationLocalStorage } from '../models/migrationLocalStorage';
import * as loc from '../constants/strings';
import { filterMigrations, getMigrationDuration, getMigrationStatusImage, getMigrationStatusWithErrors, getMigrationTime } from '../api/utils';
import { SqlMigrationServiceDetailsDialog } from '../dialog/sqlMigrationService/sqlMigrationServiceDetailsDialog';
import { ConfirmCutoverDialog } from '../dialog/migrationCutover/confirmCutoverDialog';
import { MigrationCutoverDialogModel } from '../dialog/migrationCutover/migrationCutoverDialogModel';
import { getMigrationTargetType, getMigrationMode, canRetryMigration, getMigrationModeEnum, canCancelMigration, canCutoverMigration, getMigrationStatus } from '../constants/helper';
import { RetryMigrationDialog } from '../dialog/retryMigration/retryMigrationDialog';
import { DatabaseMigration, getResourceName } from '../api/azure';
import { logError, TelemetryViews } from '../telemtery';
import { SelectMigrationServiceDialog } from '../dialog/selectMigrationService/selectMigrationServiceDialog';
import { AdsMigrationStatus, EmptySettingValue, MenuCommands, TabBase } from './tabBase';
import { DashboardStatusBar } from './sqlServerDashboard';
import { MigrationMode } from '../models/stateMachine';

export const MigrationsListTabId = 'MigrationsListTab';

export class MigrationsListTab extends TabBase<MigrationsListTab> {
	private _searchBox!: azdata.InputBoxComponent;
	private _refresh!: azdata.ButtonComponent;
	private _serviceContextButton!: azdata.ButtonComponent;
	private _statusDropdown!: azdata.DropDownComponent;
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
		statusBar: DashboardStatusBar,
	): Promise<MigrationsListTab> {

		this.view = view;
		this.context = context;
		this._openMigrationDetails = openMigrationDetails;
		this.statusBar = statusBar;

		await this.initialize();

		return this;
	}

	public onDialogClosed = async (): Promise<void> =>
		await this.updateServiceContext(this._serviceContextButton);

	public async setMigrationFilter(filter: AdsMigrationStatus): Promise<void> {
		if (this._statusDropdown.values && this._statusDropdown.values.length > 0) {
			const statusFilter = (<azdata.CategoryValue[]>this._statusDropdown.values)
				.find(value => value.name === filter.toString());

			this._statusDropdown.value = statusFilter;
		}
	}

	public async refresh(): Promise<void> {
		if (this.isRefreshing) {
			return;
		}

		this.isRefreshing = true;
		this._refresh.enabled = false;
		this._refreshLoader.loading = true;
		await this.statusBar.clearError();

		try {
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
			this.isRefreshing = false;
			this._refreshLoader.loading = false;
			this._refresh.enabled = true;
		}
	}

	protected async initialize(): Promise<void> {
		this._registerCommands();

		this.content = this.view.modelBuilder.flexContainer()
			.withItems(
				[
					this._createToolbar(),
					await this._createSearchAndRefreshContainer(),
					this._createStatusTable()
				],
				{ CSSStyles: { 'width': '100%' } }
			).withLayout({
				width: '100%',
				flexFlow: 'column',
			}).withProps({ CSSStyles: { 'padding': '0px' } })
			.component();
	}

	private _createToolbar(): azdata.ToolbarContainer {
		const toolbar = this.view.modelBuilder.toolbarContainer();
		toolbar.addToolbarItems([
			<azdata.ToolbarComponent>{ component: this.createNewMigrationButton() },
			<azdata.ToolbarComponent>{ component: this.createNewSupportRequestButton() },
			<azdata.ToolbarComponent>{ component: this.createFeedbackButton() },
		]);

		return toolbar.component();
	}

	private async _createSearchAndRefreshContainer(): Promise<azdata.FlexContainer> {
		this._searchBox = this.view.modelBuilder.inputBox()
			.withProps({
				stopEnterPropagation: true,
				placeHolder: loc.SEARCH_FOR_MIGRATIONS,
				width: '200px',
			}).component();
		this.disposables.push(
			this._searchBox.onTextChanged(
				async (value) => await this._populateMigrationTable()));

		this._refresh = this.view.modelBuilder.button()
			.withProps({
				iconPath: IconPathHelper.refresh,
				iconHeight: '16px',
				iconWidth: '20px',
				label: loc.REFRESH_BUTTON_LABEL,
			}).component();
		this.disposables.push(
			this._refresh.onDidClick(
				async (e) => await this.refresh()));

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
				width: '150px'
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

		this._refreshLoader = this.view.modelBuilder.loadingComponent()
			.withProps({ loading: false })
			.component();

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

		const onDialogClosed = async (): Promise<void> =>
			await this.updateServiceContext(this._serviceContextButton);

		this.disposables.push(
			this._serviceContextButton.onDidClick(
				async () => {
					const dialog = new SelectMigrationServiceDialog(onDialogClosed);
					await dialog.initialize();
				}));

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

		flexContainer.addItem(this._searchBox, { flex: '0', CSSStyles: { 'margin-left': '10px' } });
		flexContainer.addItem(this._serviceContextButton, { flex: '0', CSSStyles: { 'margin-left': '10px' } });
		flexContainer.addItem(searchContainer, { flex: '0', CSSStyles: { 'margin-left': '10px' } });
		flexContainer.addItem(this._refresh, { flex: '0', CSSStyles: { 'margin-left': '10px' } });
		flexContainer.addItem(this._refreshLoader, { flex: '0 0 auto', CSSStyles: { 'margin-left': '10px' } });

		const container = this.view.modelBuilder.flexContainer()
			.withProps({ width: '100%' })
			.component();

		container.addItem(flexContainer);
		return container;
	}

	private _registerCommands(): void {
		this.disposables.push(vscode.commands.registerCommand(
			MenuCommands.Cutover,
			async (migrationId: string) => {
				try {
					await this.statusBar.clearError();
					const migration = this._migrations.find(
						migration => migration.id === migrationId);

					if (canRetryMigration(migration)) {
						const cutoverDialogModel = new MigrationCutoverDialogModel(
							await MigrationLocalStorage.getMigrationServiceContext(),
							migration!);
						await cutoverDialogModel.fetchStatus();
						const dialog = new ConfirmCutoverDialog(cutoverDialogModel);
						await dialog.initialize();
						if (cutoverDialogModel.CutoverError) {
							void vscode.window.showErrorMessage(loc.MIGRATION_CUTOVER_ERROR);
							logError(TelemetryViews.MigrationsTab, MenuCommands.Cutover, cutoverDialogModel.CutoverError);
						}
					} else {
						await vscode.window.showInformationMessage(loc.MIGRATION_CANNOT_CUTOVER);
					}
				} catch (e) {
					await this.statusBar.showError(
						loc.MIGRATION_CUTOVER_ERROR,
						loc.MIGRATION_CUTOVER_ERROR,
						e.message);

					logError(TelemetryViews.MigrationsTab, MenuCommands.Cutover, e);
				}
			}));

		this.disposables.push(vscode.commands.registerCommand(
			MenuCommands.ViewDatabase,
			async (migrationId: string) => {
				try {
					await this.statusBar.clearError();
					const migration = this._migrations.find(m => m.id === migrationId);
					await this._openMigrationDetails(migration!);
				} catch (e) {
					await this.statusBar.showError(
						loc.OPEN_MIGRATION_DETAILS_ERROR,
						loc.OPEN_MIGRATION_DETAILS_ERROR,
						e.message);
					logError(TelemetryViews.MigrationsTab, MenuCommands.ViewDatabase, e);
				}
			}));

		this.disposables.push(vscode.commands.registerCommand(
			MenuCommands.ViewTarget,
			async (migrationId: string) => {
				try {
					const migration = this._migrations.find(migration => migration.id === migrationId);
					const url = 'https://portal.azure.com/#resource/' + migration!.properties.scope;
					await vscode.env.openExternal(vscode.Uri.parse(url));
				} catch (e) {
					await this.statusBar.showError(
						loc.OPEN_MIGRATION_TARGET_ERROR,
						loc.OPEN_MIGRATION_TARGET_ERROR,
						e.message);
					logError(TelemetryViews.MigrationsTab, MenuCommands.ViewTarget, e);
				}
			}));

		this.disposables.push(vscode.commands.registerCommand(
			MenuCommands.ViewService,
			async (migrationId: string) => {
				try {
					await this.statusBar.clearError();
					const migration = this._migrations.find(migration => migration.id === migrationId);
					const dialog = new SqlMigrationServiceDetailsDialog(
						await MigrationLocalStorage.getMigrationServiceContext(),
						migration!);
					await dialog.initialize();
				} catch (e) {
					await this.statusBar.showError(
						loc.OPEN_MIGRATION_SERVICE_ERROR,
						loc.OPEN_MIGRATION_SERVICE_ERROR,
						e.message);
					logError(TelemetryViews.MigrationsTab, MenuCommands.ViewService, e);
				}
			}));

		this.disposables.push(vscode.commands.registerCommand(
			MenuCommands.CopyMigration,
			async (migrationId: string) => {
				await this.statusBar.clearError();
				const migration = this._migrations.find(migration => migration.id === migrationId);
				const cutoverDialogModel = new MigrationCutoverDialogModel(
					await MigrationLocalStorage.getMigrationServiceContext(),
					migration!);

				try {
					await cutoverDialogModel.fetchStatus();
				} catch (e) {
					await this.statusBar.showError(
						loc.MIGRATION_STATUS_REFRESH_ERROR,
						loc.MIGRATION_STATUS_REFRESH_ERROR,
						e.message);
					logError(TelemetryViews.MigrationsTab, MenuCommands.CopyMigration, e);
				}

				await vscode.env.clipboard.writeText(JSON.stringify(cutoverDialogModel.migration, undefined, 2));
				await vscode.window.showInformationMessage(loc.DETAILS_COPIED);
			}));

		this.disposables.push(vscode.commands.registerCommand(
			MenuCommands.CancelMigration,
			async (migrationId: string) => {
				try {
					await this.statusBar.clearError();
					const migration = this._migrations.find(migration => migration.id === migrationId);
					if (canCancelMigration(migration)) {
						void vscode.window.showInformationMessage(loc.CANCEL_MIGRATION_CONFIRMATION, loc.YES, loc.NO).then(async (v) => {
							if (v === loc.YES) {
								const cutoverDialogModel = new MigrationCutoverDialogModel(
									await MigrationLocalStorage.getMigrationServiceContext(),
									migration!);
								await cutoverDialogModel.fetchStatus();
								await cutoverDialogModel.cancelMigration();

								if (cutoverDialogModel.CancelMigrationError) {
									void vscode.window.showErrorMessage(loc.MIGRATION_CANNOT_CANCEL);
									logError(TelemetryViews.MigrationsTab, MenuCommands.CancelMigration, cutoverDialogModel.CancelMigrationError);
								}
							}
						});
					} else {
						await vscode.window.showInformationMessage(loc.MIGRATION_CANNOT_CANCEL);
					}
				} catch (e) {
					await this.statusBar.showError(
						loc.MIGRATION_CANCELLATION_ERROR,
						loc.MIGRATION_CANCELLATION_ERROR,
						e.message);
					logError(TelemetryViews.MigrationsTab, MenuCommands.CancelMigration, e);
				}
			}));

		this.disposables.push(vscode.commands.registerCommand(
			MenuCommands.RetryMigration,
			async (migrationId: string) => {
				try {
					await this.statusBar.clearError();
					const migration = this._migrations.find(migration => migration.id === migrationId);
					if (canRetryMigration(migration)) {
						let retryMigrationDialog = new RetryMigrationDialog(
							this.context,
							await MigrationLocalStorage.getMigrationServiceContext(),
							migration!,
							async () => await this.onDialogClosed());
						await retryMigrationDialog.openDialog();
					}
					else {
						await vscode.window.showInformationMessage(loc.MIGRATION_CANNOT_RETRY);
					}
				} catch (e) {
					await this.statusBar.showError(
						loc.MIGRATION_RETRY_ERROR,
						loc.MIGRATION_RETRY_ERROR,
						e.message);
					logError(TelemetryViews.MigrationsTab, MenuCommands.RetryMigration, e);
				}
			}));
	}

	private async _populateMigrationTable(): Promise<void> {
		try {
			this._filteredMigrations = filterMigrations(
				this._migrations,
				(<azdata.CategoryValue>this._statusDropdown.value).name,
				this._searchBox.value!);

			this._filteredMigrations.sort((m1, m2) => {
				if (!m1.properties?.startedOn) {
					return 1;
				} else if (!m2.properties?.startedOn) {
					return -1;
				}
				return new Date(m1.properties?.startedOn) > new Date(m2.properties?.startedOn) ? -1 : 1;
			});

			const data: any[] = this._filteredMigrations.map((migration, index) => {
				return [
					<azdata.HyperlinkColumnCellValue>{
						icon: IconPathHelper.sqlDatabaseLogo,
						title: migration.properties.sourceDatabaseName ?? EmptySettingValue,
					},															// sourceDatabase
					migration.properties.sourceServerName ?? EmptySettingValue,	// sourceServer
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
						context: migration.id,
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
						width: 190,
						type: azdata.ColumnType.hyperlink,
						showText: true,
					},
					{
						cssClass: rowCssStyles,
						headerCssClass: headerCssStyles,
						name: loc.SRC_SERVER,
						value: 'sourceServer',
						width: 190,
						type: azdata.ColumnType.text,
					},
					<azdata.HyperlinkColumn>{
						cssClass: rowCssStyles,
						headerCssClass: headerCssStyles,
						name: loc.STATUS_COLUMN,
						value: 'status',
						width: 120,
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

		this.disposables.push(this._statusTable.onCellAction!(async (rowState: azdata.ICellActionEventArgs) => {
			const buttonState = <azdata.ICellActionEventArgs>rowState;
			const migration = this._filteredMigrations[rowState.row];
			switch (buttonState?.column) {
				case 2:
					const status = getMigrationStatus(migration);
					const statusMessage = loc.DATABASE_MIGRATION_STATUS_LABEL(status);
					const errors = this.getMigrationErrors(migration!);

					this.showDialogMessage(
						loc.DATABASE_MIGRATION_STATUS_TITLE,
						statusMessage,
						errors);
					break;
				case 0:
					await this._openMigrationDetails(migration);
					break;
			}
		}));

		return this._statusTable;
	}

	private _getMenuCommands(migration: DatabaseMigration): string[] {
		const menuCommands: string[] = [];

		if (getMigrationModeEnum(migration) === MigrationMode.ONLINE &&
			canCutoverMigration(migration)) {
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
