/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { getCurrentMigrations, getSelectedServiceStatus, MigrationLocalStorage, MigrationStatus } from '../../models/migrationLocalStorage';
import { MigrationCutoverDialog } from '../migrationCutover/migrationCutoverDialog';
import { AdsMigrationStatus, MigrationStatusDialogModel } from './migrationStatusDialogModel';
import * as loc from '../../constants/strings';
import { clearDialogMessage, convertTimeDifferenceToDuration, displayDialogErrorMessage, filterMigrations, getMigrationStatusImage } from '../../api/utils';
import { SqlMigrationServiceDetailsDialog } from '../sqlMigrationService/sqlMigrationServiceDetailsDialog';
import { ConfirmCutoverDialog } from '../migrationCutover/confirmCutoverDialog';
import { MigrationCutoverDialogModel } from '../migrationCutover/migrationCutoverDialogModel';
import { getMigrationTargetType, getMigrationMode, canRetryMigration } from '../../constants/helper';
import { RetryMigrationDialog } from '../retryMigration/retryMigrationDialog';
import { DatabaseMigration, getResourceName } from '../../api/azure';
import { logError, TelemetryViews } from '../../telemtery';
import { SelectMigrationServiceDialog } from '../selectMigrationService/selectMigrationServiceDialog';

const MenuCommands = {
	Cutover: 'sqlmigration.cutover',
	ViewDatabase: 'sqlmigration.view.database',
	ViewTarget: 'sqlmigration.view.target',
	ViewService: 'sqlmigration.view.service',
	CopyMigration: 'sqlmigration.copy.migration',
	CancelMigration: 'sqlmigration.cancel.migration',
	RetryMigration: 'sqlmigration.retry.migration',
};

export class MigrationStatusDialog {
	private _context: vscode.ExtensionContext;
	private _model: MigrationStatusDialogModel;
	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;
	private _searchBox!: azdata.InputBoxComponent;
	private _refresh!: azdata.ButtonComponent;
	private _serviceContextButton!: azdata.ButtonComponent;
	private _statusDropdown!: azdata.DropDownComponent;
	private _statusTable!: azdata.TableComponent;
	private _refreshLoader!: azdata.LoadingComponent;
	private _disposables: vscode.Disposable[] = [];
	private _filteredMigrations: DatabaseMigration[] = [];

	private isRefreshing = false;

	constructor(
		context: vscode.ExtensionContext,
		private _filter: AdsMigrationStatus,
		private _onClosedCallback: () => Promise<void>) {

		this._context = context;
		this._model = new MigrationStatusDialogModel([]);
		this._dialogObject = azdata.window.createModelViewDialog(
			loc.MIGRATION_STATUS,
			'MigrationControllerDialog',
			'wide');
	}

	async initialize() {
		let tab = azdata.window.createTab('');
		tab.registerContent(async (view: azdata.ModelView) => {
			this._view = view;
			this.registerCommands();
			const form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{ component: await this.createSearchAndRefreshContainer() },
						{ component: this.createStatusTable() }
					],
					{ horizontal: false }
				).withLayout({ width: '100%' })
				.component();
			this._disposables.push(
				this._view.onClosed(async e => {
					this._disposables.forEach(
						d => { try { d.dispose(); } catch { } });

					await this._onClosedCallback();
				}));

			await view.initializeModel(form);
			return await this.refreshTable();
		});
		this._dialogObject.content = [tab];
		this._dialogObject.cancelButton.hidden = true;
		this._dialogObject.okButton.label = loc.CLOSE;
		azdata.window.openDialog(this._dialogObject);
	}

	private canCancelMigration = (status: string | undefined) => status &&
		(
			status === MigrationStatus.InProgress ||
			status === MigrationStatus.Creating ||
			status === MigrationStatus.Completing ||
			status === MigrationStatus.Canceling
		);

	private canCutoverMigration = (status: string | undefined) => status === MigrationStatus.InProgress;

	private async createSearchAndRefreshContainer(): Promise<azdata.FlexContainer> {
		this._searchBox = this._view.modelBuilder.inputBox()
			.withProps({
				stopEnterPropagation: true,
				placeHolder: loc.SEARCH_FOR_MIGRATIONS,
				width: '360px'
			}).component();
		this._disposables.push(
			this._searchBox.onTextChanged(
				async (value) => await this.populateMigrationTable()));

		this._refresh = this._view.modelBuilder.button()
			.withProps({
				iconPath: IconPathHelper.refresh,
				iconHeight: '16px',
				iconWidth: '20px',
				label: loc.REFRESH_BUTTON_LABEL,
			}).component();
		this._disposables.push(
			this._refresh.onDidClick(
				async (e) => await this.refreshTable()));

		this._statusDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: loc.MIGRATION_STATUS_FILTER,
				values: this._model.statusDropdownValues,
				width: '220px'
			}).component();
		this._disposables.push(
			this._statusDropdown.onValueChanged(
				async (value) => await this.populateMigrationTable()));

		if (this._filter) {
			this._statusDropdown.value =
				(<azdata.CategoryValue[]>this._statusDropdown.values)
					.find(value => value.name === this._filter);
		}

		this._refreshLoader = this._view.modelBuilder.loadingComponent()
			.withProps({ loading: false })
			.component();

		const searchLabel = this._view.modelBuilder.text()
			.withProps({
				value: 'Status',
				CSSStyles: {
					'font-size': '13px',
					'font-weight': '600',
					'margin': '3px 0 0 0',
				},
			}).component();

		const serviceContextLabel = await getSelectedServiceStatus();
		this._serviceContextButton = this._view.modelBuilder.button()
			.withProps({
				iconPath: IconPathHelper.sqlMigrationService,
				iconHeight: 22,
				iconWidth: 22,
				label: serviceContextLabel,
				title: serviceContextLabel,
				description: loc.MIGRATION_SERVICE_DESCRIPTION,
				buttonType: azdata.ButtonType.Informational,
				width: 270,
			}).component();

		const onDialogClosed = async (): Promise<void> => {
			const label = await getSelectedServiceStatus();
			this._serviceContextButton.label = label;
			this._serviceContextButton.title = label;
			await this.refreshTable();
		};

		this._disposables.push(
			this._serviceContextButton.onDidClick(
				async () => {
					const dialog = new SelectMigrationServiceDialog(onDialogClosed);
					await dialog.initialize();
				}));

		const flexContainer = this._view.modelBuilder.flexContainer()
			.withProps({
				width: '100%',
				CSSStyles: {
					'justify-content': 'left',
					'align-items': 'center',
					'padding': '0px',
					'display': 'flex',
					'flex-direction': 'row',
				},
			}).component();

		flexContainer.addItem(this._searchBox, { flex: '0' });
		flexContainer.addItem(this._serviceContextButton, { flex: '0', CSSStyles: { 'margin-left': '20px' } });
		flexContainer.addItem(searchLabel, { flex: '0', CSSStyles: { 'margin-left': '20px' } });
		flexContainer.addItem(this._statusDropdown, { flex: '0', CSSStyles: { 'margin-left': '5px' } });
		flexContainer.addItem(this._refresh, { flex: '0', CSSStyles: { 'margin-left': '20px' } });
		flexContainer.addItem(this._refreshLoader, { flex: '0 0 auto', CSSStyles: { 'margin-left': '20px' } });

		const container = this._view.modelBuilder.flexContainer()
			.withProps({ width: 1245 })
			.component();
		container.addItem(flexContainer, { flex: '0 0 auto', });
		return container;
	}

	private registerCommands(): void {
		this._disposables.push(vscode.commands.registerCommand(
			MenuCommands.Cutover,
			async (migrationId: string) => {
				try {
					clearDialogMessage(this._dialogObject);
					const migration = this._model._migrations.find(
						migration => migration.id === migrationId);

					if (this.canCutoverMigration(migration?.properties.migrationStatus)) {
						const cutoverDialogModel = new MigrationCutoverDialogModel(
							await MigrationLocalStorage.getMigrationServiceContext(),
							migration!);
						await cutoverDialogModel.fetchStatus();
						const dialog = new ConfirmCutoverDialog(cutoverDialogModel);
						await dialog.initialize();
						if (cutoverDialogModel.CutoverError) {
							displayDialogErrorMessage(this._dialogObject, loc.MIGRATION_CUTOVER_ERROR, cutoverDialogModel.CutoverError);
						}
					} else {
						await vscode.window.showInformationMessage(loc.MIGRATION_CANNOT_CUTOVER);
					}
				} catch (e) {
					displayDialogErrorMessage(this._dialogObject, loc.MIGRATION_CUTOVER_ERROR, e);
					console.log(e);
				}
			}));

		this._disposables.push(vscode.commands.registerCommand(
			MenuCommands.ViewDatabase,
			async (migrationId: string) => {
				try {
					const migration = this._model._migrations.find(migration => migration.id === migrationId);
					const dialog = new MigrationCutoverDialog(
						this._context,
						await MigrationLocalStorage.getMigrationServiceContext(),
						migration!,
						this._onClosedCallback);
					await dialog.initialize();
				} catch (e) {
					console.log(e);
				}
			}));

		this._disposables.push(vscode.commands.registerCommand(
			MenuCommands.ViewTarget,
			async (migrationId: string) => {
				try {
					const migration = this._model._migrations.find(migration => migration.id === migrationId);
					const url = 'https://portal.azure.com/#resource/' + migration!.properties.scope;
					await vscode.env.openExternal(vscode.Uri.parse(url));
				} catch (e) {
					console.log(e);
				}
			}));

		this._disposables.push(vscode.commands.registerCommand(
			MenuCommands.ViewService,
			async (migrationId: string) => {
				try {
					const migration = this._model._migrations.find(migration => migration.id === migrationId);
					const dialog = new SqlMigrationServiceDetailsDialog(
						await MigrationLocalStorage.getMigrationServiceContext(),
						migration!);
					await dialog.initialize();
				} catch (e) {
					console.log(e);
				}
			}));

		this._disposables.push(vscode.commands.registerCommand(
			MenuCommands.CopyMigration,
			async (migrationId: string) => {
				try {
					clearDialogMessage(this._dialogObject);
					const migration = this._model._migrations.find(migration => migration.id === migrationId);
					const cutoverDialogModel = new MigrationCutoverDialogModel(
						await MigrationLocalStorage.getMigrationServiceContext(),
						migration!);
					await cutoverDialogModel.fetchStatus();
					await vscode.env.clipboard.writeText(JSON.stringify(cutoverDialogModel.migrationStatus, undefined, 2));

					await vscode.window.showInformationMessage(loc.DETAILS_COPIED);
				} catch (e) {
					displayDialogErrorMessage(this._dialogObject, loc.MIGRATION_STATUS_REFRESH_ERROR, e);
					console.log(e);
				}
			}));

		this._disposables.push(vscode.commands.registerCommand(
			MenuCommands.CancelMigration,
			async (migrationId: string) => {
				try {
					clearDialogMessage(this._dialogObject);
					const migration = this._model._migrations.find(migration => migration.id === migrationId);
					if (this.canCancelMigration(migration?.properties.migrationStatus)) {
						void vscode.window.showInformationMessage(loc.CANCEL_MIGRATION_CONFIRMATION, loc.YES, loc.NO).then(async (v) => {
							if (v === loc.YES) {
								const cutoverDialogModel = new MigrationCutoverDialogModel(
									await MigrationLocalStorage.getMigrationServiceContext(),
									migration!);
								await cutoverDialogModel.fetchStatus();
								await cutoverDialogModel.cancelMigration();

								if (cutoverDialogModel.CancelMigrationError) {
									displayDialogErrorMessage(this._dialogObject, loc.MIGRATION_CANNOT_CANCEL, cutoverDialogModel.CancelMigrationError);
								}
							}
						});
					} else {
						await vscode.window.showInformationMessage(loc.MIGRATION_CANNOT_CANCEL);
					}
				} catch (e) {
					displayDialogErrorMessage(this._dialogObject, loc.MIGRATION_CANCELLATION_ERROR, e);
					console.log(e);
				}
			}));

		this._disposables.push(vscode.commands.registerCommand(
			MenuCommands.RetryMigration,
			async (migrationId: string) => {
				try {
					clearDialogMessage(this._dialogObject);
					const migration = this._model._migrations.find(migration => migration.id === migrationId);
					if (canRetryMigration(migration?.properties.migrationStatus)) {
						let retryMigrationDialog = new RetryMigrationDialog(
							this._context,
							await MigrationLocalStorage.getMigrationServiceContext(),
							migration!,
							this._onClosedCallback);
						await retryMigrationDialog.openDialog();
					}
					else {
						await vscode.window.showInformationMessage(loc.MIGRATION_CANNOT_RETRY);
					}
				} catch (e) {
					displayDialogErrorMessage(this._dialogObject, loc.MIGRATION_RETRY_ERROR, e);
					console.log(e);
				}
			}));
	}

	private async populateMigrationTable(): Promise<void> {
		try {
			this._filteredMigrations = filterMigrations(
				this._model._migrations,
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
						title: migration.properties.sourceDatabaseName ?? '-',
					},															// database
					<azdata.HyperlinkColumnCellValue>{
						icon: getMigrationStatusImage(migration.properties.migrationStatus),
						title: this._getMigrationStatus(migration),
					},															// statue
					getMigrationMode(migration),								// mode
					getMigrationTargetType(migration),							// targetType
					getResourceName(migration.id),								// targetName
					getResourceName(migration.properties.migrationService),		// migrationService
					this._getMigrationDuration(
						migration.properties.startedOn,
						migration.properties.endedOn),							// duration
					this._getMigrationTime(migration.properties.startedOn),		// startTime
					this._getMigrationTime(migration.properties.endedOn),		// endTime
				];
			});

			await this._statusTable.updateProperty('data', data);
		} catch (e) {
			logError(TelemetryViews.MigrationStatusDialog, 'Error populating migrations list page', e);
		}
	}

	private _getMigrationTime(migrationTime: string): string {
		return migrationTime
			? new Date(migrationTime).toLocaleString()
			: '---';
	}

	private _getMigrationDuration(startDate: string, endDate: string): string {
		if (startDate) {
			if (endDate) {
				return convertTimeDifferenceToDuration(
					new Date(startDate),
					new Date(endDate));
			} else {
				return convertTimeDifferenceToDuration(
					new Date(startDate),
					new Date());
			}
		}

		return '---';
	}

	private _getMigrationStatus(migration: DatabaseMigration): string {
		const properties = migration.properties;
		const migrationStatus = properties.migrationStatus ?? properties.provisioningState;
		let warningCount = 0;

		if (properties.migrationFailureError?.message) {
			warningCount++;
		}
		if (properties.migrationStatusDetails?.fileUploadBlockingErrors) {
			warningCount += properties.migrationStatusDetails?.fileUploadBlockingErrors.length;
		}
		if (properties.migrationStatusDetails?.restoreBlockingReason) {
			warningCount++;
		}

		return loc.STATUS_VALUE(migrationStatus, warningCount) + (loc.STATUS_WARNING_COUNT(migrationStatus, warningCount) ?? '');
	}

	public openCalloutDialog(dialogHeading: string, dialogName?: string, calloutMessageText?: string): void {
		const dialog = azdata.window.createModelViewDialog(dialogHeading, dialogName, 288, 'callout', 'left', true, false, {
			xPos: 0,
			yPos: 0,
			width: 20,
			height: 20
		});
		const tab: azdata.window.DialogTab = azdata.window.createTab('');
		tab.registerContent(async view => {
			const warningContentContainer = view.modelBuilder.divContainer().component();
			const messageTextComponent = view.modelBuilder.text().withProps({
				value: calloutMessageText,
				CSSStyles: {
					'font-size': '12px',
					'line-height': '16px',
					'margin': '0 0 12px 0',
					'display': '-webkit-box',
					'-webkit-box-orient': 'vertical',
					'-webkit-line-clamp': '5',
					'overflow': 'hidden'
				}
			}).component();
			warningContentContainer.addItem(messageTextComponent);

			await view.initializeModel(warningContentContainer);
		});

		dialog.content = [tab];

		azdata.window.openDialog(dialog);
	}

	private async refreshTable(): Promise<void> {
		if (this.isRefreshing) {
			return;
		}

		this.isRefreshing = true;
		try {
			clearDialogMessage(this._dialogObject);
			this._refreshLoader.loading = true;
			this._model._migrations = await getCurrentMigrations();
			await this.populateMigrationTable();
		} catch (e) {
			displayDialogErrorMessage(this._dialogObject, loc.MIGRATION_STATUS_REFRESH_ERROR, e);
			console.log(e);
		} finally {
			this.isRefreshing = false;
			this._refreshLoader.loading = false;
		}
	}

	private createStatusTable(): azdata.TableComponent {
		const headerCssStyles = undefined;
		const rowCssStyles = undefined;

		this._statusTable = this._view.modelBuilder.table().withProps({
			ariaLabel: loc.MIGRATION_STATUS,
			data: [],
			forceFitColumns: azdata.ColumnSizingMode.ForceFit,
			height: '600px',
			width: '1095px',
			display: 'grid',
			columns: [
				<azdata.HyperlinkColumn>{
					cssClass: rowCssStyles,
					headerCssClass: headerCssStyles,
					name: loc.DATABASE,
					value: 'database',
					width: 190,
					type: azdata.ColumnType.hyperlink,
					icon: IconPathHelper.sqlDatabaseLogo,
					showText: true,
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
					width: 85,
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
					name: loc.TARGET_AZURE_SQL_INSTANCE_NAME,
					value: 'targetName',
					width: 125,
					type: azdata.ColumnType.text,
				},
				{
					cssClass: rowCssStyles,
					headerCssClass: headerCssStyles,
					name: loc.DATABASE_MIGRATION_SERVICE,
					value: 'migrationService',
					width: 140,
					type: azdata.ColumnType.text,
				},
				{
					cssClass: rowCssStyles,
					headerCssClass: headerCssStyles,
					name: loc.DURATION,
					value: 'duration',
					width: 50,
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
			]
		}).component();

		this._disposables.push(this._statusTable.onCellAction!(async (rowState: azdata.ICellActionEventArgs) => {
			const buttonState = <azdata.ICellActionEventArgs>rowState;
			switch (buttonState?.column) {
				case 0:
				case 1:
					const migration = this._filteredMigrations[rowState.row];
					const dialog = new MigrationCutoverDialog(
						this._context,
						await MigrationLocalStorage.getMigrationServiceContext(),
						migration,
						this._onClosedCallback);
					await dialog.initialize();
					break;
			}
		}));

		return this._statusTable;
	}
}
