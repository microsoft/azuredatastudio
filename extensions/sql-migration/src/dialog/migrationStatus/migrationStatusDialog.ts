/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { MigrationContext, MigrationLocalStorage, MigrationStatus } from '../../models/migrationLocalStorage';
import { MigrationCutoverDialog } from '../migrationCutover/migrationCutoverDialog';
import { AdsMigrationStatus, MigrationStatusDialogModel } from './migrationStatusDialogModel';
import * as loc from '../../constants/strings';
import { clearDialogMessage, convertTimeDifferenceToDuration, displayDialogErrorMessage, filterMigrations, getMigrationStatusImage, SupportedAutoRefreshIntervals } from '../../api/utils';
import { SqlMigrationServiceDetailsDialog } from '../sqlMigrationService/sqlMigrationServiceDetailsDialog';
import { ConfirmCutoverDialog } from '../migrationCutover/confirmCutoverDialog';
import { MigrationCutoverDialogModel } from '../migrationCutover/migrationCutoverDialogModel';
import { getMigrationTargetType, getMigrationMode } from '../../constants/helper';
import { RetryMigrationDialog } from '../retryMigration/retryMigrationDialog';

const refreshFrequency: SupportedAutoRefreshIntervals = 180000;

const statusImageSize: number = 14;
const imageCellStyles: azdata.CssStyles = { 'margin': '3px 3px 0 0', 'padding': '0' };
const statusCellStyles: azdata.CssStyles = { 'margin': '0', 'padding': '0' };

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
	private _statusDropdown!: azdata.DropDownComponent;
	private _statusTable!: azdata.DeclarativeTableComponent;
	private _refreshLoader!: azdata.LoadingComponent;
	private _autoRefreshHandle!: NodeJS.Timeout;
	private _disposables: vscode.Disposable[] = [];

	private isRefreshing = false;

	constructor(context: vscode.ExtensionContext, migrations: MigrationContext[], private _filter: AdsMigrationStatus) {
		this._context = context;
		this._model = new MigrationStatusDialogModel(migrations);
		this._dialogObject = azdata.window.createModelViewDialog(loc.MIGRATION_STATUS, 'MigrationControllerDialog', 'wide');
	}

	initialize() {
		let tab = azdata.window.createTab('');
		tab.registerContent(async (view: azdata.ModelView) => {
			this._view = view;
			this.registerCommands();
			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: this.createSearchAndRefreshContainer()
					},
					{
						component: this.createStatusTable()
					}
				],
				{
					horizontal: false
				}
			);
			const form = formBuilder.withLayout({ width: '100%' }).component();
			this._disposables.push(this._view.onClosed(e => {
				clearInterval(this._autoRefreshHandle);
				this._disposables.forEach(
					d => { try { d.dispose(); } catch { } });
			}));

			return view.initializeModel(form);
		});
		this._dialogObject.content = [tab];
		this._dialogObject.cancelButton.hidden = true;
		this._dialogObject.okButton.label = loc.CLOSE;
		this._disposables.push(this._dialogObject.okButton.onClick(e => {
			clearInterval(this._autoRefreshHandle);
		}));
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

	private canRetryMigration = (status: string | undefined) => (
		status !== MigrationStatus.InProgress &&
		status !== MigrationStatus.Creating &&
		status !== MigrationStatus.Completing &&
		status !== MigrationStatus.Canceling
	);

	private createSearchAndRefreshContainer(): azdata.FlexContainer {
		this._searchBox = this._view.modelBuilder.inputBox().withProps({
			stopEnterPropagation: true,
			placeHolder: loc.SEARCH_FOR_MIGRATIONS,
			width: '360px'
		}).component();

		this._disposables.push(this._searchBox.onTextChanged(async (value) => {
			await this.populateMigrationTable();
		}));

		this._refresh = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh,
			iconHeight: '16px',
			iconWidth: '20px',
			height: '30px',
			label: loc.REFRESH_BUTTON_LABEL,
		}).component();

		this._disposables.push(
			this._refresh.onDidClick(
				async (e) => { await this.refreshTable(); }));

		const flexContainer = this._view.modelBuilder.flexContainer().withProps({
			width: 900,
			CSSStyles: {
				'justify-content': 'left'
			},
		}).component();

		flexContainer.addItem(this._searchBox, {
			flex: '0'
		});

		this._statusDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: loc.MIGRATION_STATUS_FILTER,
			values: this._model.statusDropdownValues,
			width: '220px'
		}).component();

		this._disposables.push(this._statusDropdown.onValueChanged(async (value) => {
			await this.populateMigrationTable();
		}));

		if (this._filter) {
			this._statusDropdown.value = (<azdata.CategoryValue[]>this._statusDropdown.values).find((value) => {
				return value.name === this._filter;
			});
		}

		flexContainer.addItem(this._statusDropdown, {
			flex: '0',
			CSSStyles: {
				'margin-left': '20px'
			}
		});

		flexContainer.addItem(this._refresh, {
			flex: '0',
			CSSStyles: {
				'margin-left': '20px'
			}
		});

		this._refreshLoader = this._view.modelBuilder.loadingComponent().withProps({
			loading: false,
			height: '55px'
		}).component();

		flexContainer.addItem(this._refreshLoader, {
			flex: '0 0 auto',
			CSSStyles: {
				'margin-left': '20px'
			}
		});
		this.setAutoRefresh(refreshFrequency);
		const container = this._view.modelBuilder.flexContainer().withProps({
			width: 1000
		}).component();
		container.addItem(flexContainer, {
			flex: '0 0 auto',
			CSSStyles: {
				'width': '980px'
			}
		});
		return container;
	}

	private setAutoRefresh(interval: SupportedAutoRefreshIntervals): void {
		const classVariable = this;
		clearInterval(this._autoRefreshHandle);
		if (interval !== -1) {
			this._autoRefreshHandle = setInterval(async function () { await classVariable.refreshTable(); }, interval);
		}
	}

	private registerCommands(): void {
		this._disposables.push(vscode.commands.registerCommand(
			MenuCommands.Cutover,
			async (migrationId: string) => {
				try {
					clearDialogMessage(this._dialogObject);
					const migration = this._model._migrations.find(migration => migration.migrationContext.id === migrationId);
					if (this.canCutoverMigration(migration?.migrationContext.properties.migrationStatus)) {
						const cutoverDialogModel = new MigrationCutoverDialogModel(migration!);
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
					const migration = this._model._migrations.find(migration => migration.migrationContext.id === migrationId);
					const dialog = new MigrationCutoverDialog(this._context, migration!);
					await dialog.initialize();
				} catch (e) {
					console.log(e);
				}
			}));

		this._disposables.push(vscode.commands.registerCommand(
			MenuCommands.ViewTarget,
			async (migrationId: string) => {
				try {
					const migration = this._model._migrations.find(migration => migration.migrationContext.id === migrationId);
					const url = 'https://portal.azure.com/#resource/' + migration!.targetManagedInstance.id;
					await vscode.env.openExternal(vscode.Uri.parse(url));
				} catch (e) {
					console.log(e);
				}
			}));

		this._disposables.push(vscode.commands.registerCommand(
			MenuCommands.ViewService,
			async (migrationId: string) => {
				try {
					const migration = this._model._migrations.find(migration => migration.migrationContext.id === migrationId);
					const dialog = new SqlMigrationServiceDetailsDialog(migration!);
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
					const migration = this._model._migrations.find(migration => migration.migrationContext.id === migrationId);
					const cutoverDialogModel = new MigrationCutoverDialogModel(migration!);
					await cutoverDialogModel.fetchStatus();
					if (cutoverDialogModel.migrationOpStatus) {
						await vscode.env.clipboard.writeText(JSON.stringify({
							'async-operation-details': cutoverDialogModel.migrationOpStatus,
							'details': cutoverDialogModel.migrationStatus
						}, undefined, 2));
					} else {
						await vscode.env.clipboard.writeText(JSON.stringify(cutoverDialogModel.migrationStatus, undefined, 2));
					}

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
					const migration = this._model._migrations.find(migration => migration.migrationContext.id === migrationId);
					if (this.canCancelMigration(migration?.migrationContext.properties.migrationStatus)) {
						void vscode.window.showInformationMessage(loc.CANCEL_MIGRATION_CONFIRMATION, loc.YES, loc.NO).then(async (v) => {
							if (v === loc.YES) {
								const cutoverDialogModel = new MigrationCutoverDialogModel(migration!);
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
					const migration = this._model._migrations.find(migration => migration.migrationContext.id === migrationId);
					if (this.canRetryMigration(migration?.migrationContext.properties.migrationStatus)) {
						let retryMigrationDialog = new RetryMigrationDialog(this._context, migration!);
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
			const migrations = filterMigrations(
				this._model._migrations,
				(<azdata.CategoryValue>this._statusDropdown.value).name,
				this._searchBox.value!);

			migrations.sort((m1, m2) => {
				return new Date(m1.migrationContext.properties?.startedOn) > new Date(m2.migrationContext.properties?.startedOn) ? -1 : 1;
			});

			const data: azdata.DeclarativeTableCellValue[][] = migrations.map((migration, index) => {
				return [
					{ value: this._getDatabaserHyperLink(migration) },
					{ value: this._getMigrationStatus(migration) },
					{ value: getMigrationMode(migration) },
					{ value: getMigrationTargetType(migration) },
					{ value: migration.targetManagedInstance.name },
					{ value: migration.controller.name },
					{
						value: this._getMigrationDuration(
							migration.migrationContext.properties.startedOn,
							migration.migrationContext.properties.endedOn)
					},
					{ value: this._getMigrationTime(migration.migrationContext.properties.startedOn) },
					{ value: this._getMigrationTime(migration.migrationContext.properties.endedOn) },
					{
						value: {
							commands: this._getMenuCommands(migration),
							context: migration.migrationContext.id
						},
					}
				];
			});

			await this._statusTable.setDataValues(data);
		} catch (e) {
			console.log(e);
		}
	}

	private _getDatabaserHyperLink(migration: MigrationContext): azdata.FlexContainer {
		const imageControl = this._view.modelBuilder.image()
			.withProps({
				iconPath: IconPathHelper.sqlDatabaseLogo,
				iconHeight: statusImageSize,
				iconWidth: statusImageSize,
				height: statusImageSize,
				width: statusImageSize,
				CSSStyles: imageCellStyles
			})
			.component();

		const databaseHyperLink = this._view.modelBuilder
			.hyperlink()
			.withProps({
				label: migration.migrationContext.properties.sourceDatabaseName,
				url: '',
				CSSStyles: statusCellStyles
			}).component();

		this._disposables.push(databaseHyperLink.onDidClick(
			async (e) => await (new MigrationCutoverDialog(this._context, migration)).initialize()));

		return this._view.modelBuilder
			.flexContainer()
			.withItems([imageControl, databaseHyperLink])
			.withProps({ CSSStyles: statusCellStyles, display: 'inline-flex' })
			.component();
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

	private _getMenuCommands(migration: MigrationContext): string[] {
		const menuCommands: string[] = [];
		const migrationStatus = migration?.migrationContext?.properties?.migrationStatus;

		if (getMigrationMode(migration) === loc.ONLINE &&
			this.canCutoverMigration(migrationStatus)) {
			menuCommands.push(MenuCommands.Cutover);
		}

		menuCommands.push(...[
			MenuCommands.ViewDatabase,
			MenuCommands.ViewTarget,
			MenuCommands.ViewService,
			MenuCommands.CopyMigration]);

		if (this.canCancelMigration(migrationStatus)) {
			menuCommands.push(MenuCommands.CancelMigration);
		}

		if (this.canRetryMigration(migrationStatus)) {
			menuCommands.push(MenuCommands.RetryMigration);
		}

		return menuCommands;
	}

	private _getMigrationStatus(migration: MigrationContext): azdata.FlexContainer {
		const properties = migration.migrationContext.properties;
		const migrationStatus = properties.migrationStatus ?? properties.provisioningState;
		let warningCount = 0;
		if (migration.asyncOperationResult?.error?.message) {
			warningCount++;
		}
		if (properties.migrationFailureError?.message) {
			warningCount++;
		}
		if (properties.migrationStatusDetails?.fileUploadBlockingErrors) {
			warningCount += properties.migrationStatusDetails?.fileUploadBlockingErrors.length;
		}
		if (properties.migrationStatusDetails?.restoreBlockingReason) {
			warningCount++;
		}

		return this._getStatusControl(migrationStatus, warningCount, migration);
	}

	public openCalloutDialog(dialogHeading: string, dialogName?: string, calloutMessageText?: string): void {
		const dialog = azdata.window.createModelViewDialog(dialogHeading, dialogName, 288, 'callout', 'left', true, false,
			{
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

	private _getStatusControl(status: string, count: number, migration: MigrationContext): azdata.DivContainer {
		const control = this._view.modelBuilder
			.divContainer()
			.withItems([
				// migration status icon
				this._view.modelBuilder.image()
					.withProps({
						iconPath: getMigrationStatusImage(status),
						iconHeight: statusImageSize,
						iconWidth: statusImageSize,
						height: statusImageSize,
						width: statusImageSize,
						CSSStyles: imageCellStyles
					})
					.component(),
				// migration status text
				this._view.modelBuilder.text().withProps({
					value: loc.STATUS_VALUE(status, count),
					height: statusImageSize,
					CSSStyles: statusCellStyles,
				}).component()
			])
			.withProps({ CSSStyles: statusCellStyles, display: 'inline-flex' })
			.component();

		if (count > 0) {
			const migrationWarningImage = this._view.modelBuilder.image()
				.withProps({
					iconPath: this._statusInfoMap(status),
					iconHeight: statusImageSize,
					iconWidth: statusImageSize,
					height: statusImageSize,
					width: statusImageSize,
					CSSStyles: imageCellStyles
				}).component();

			const migrationWarningCount = this._view.modelBuilder.hyperlink()
				.withProps({
					label: loc.STATUS_WARNING_COUNT(status, count) ?? '',
					ariaLabel: loc.ERROR,
					url: '',
					height: statusImageSize,
					CSSStyles: statusCellStyles,
				}).component();

			control.addItems([
				migrationWarningImage,
				migrationWarningCount
			]);

			this._disposables.push(migrationWarningCount.onDidClick(async () => {
				const cutoverDialogModel = new MigrationCutoverDialogModel(migration!);
				const errors = await cutoverDialogModel.fetchErrors();
				this.openCalloutDialog(
					status === MigrationStatus.InProgress
						|| status === MigrationStatus.Completing
						? loc.WARNING
						: loc.ERROR,
					'input-table-row-dialog',
					errors
				);
			}));
		}

		return control;
	}

	private async refreshTable(): Promise<void> {
		if (this.isRefreshing) {
			return;
		}

		this.isRefreshing = true;
		try {
			clearDialogMessage(this._dialogObject);
			this._refreshLoader.loading = true;
			const currentConnection = await azdata.connection.getCurrentConnection();
			this._model._migrations = await MigrationLocalStorage.getMigrationsBySourceConnections(currentConnection, true);
			await this.populateMigrationTable();
		} catch (e) {
			displayDialogErrorMessage(this._dialogObject, loc.MIGRATION_STATUS_REFRESH_ERROR, e);
			console.log(e);
		} finally {
			this.isRefreshing = false;
			this._refreshLoader.loading = false;
		}
	}

	private createStatusTable(): azdata.DeclarativeTableComponent {
		const rowCssStyle: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left',
			'border-bottom': '1px solid',
		};

		const headerCssStyles: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left',
			'border-bottom': '1px solid',
			'font-weight': 'bold',
			'padding-left': '0px',
			'padding-right': '0px'
		};

		this._statusTable = this._view.modelBuilder.declarativeTable().withProps({
			ariaLabel: loc.MIGRATION_STATUS,
			columns: [
				{
					displayName: loc.DATABASE,
					valueType: azdata.DeclarativeDataType.component,
					width: '90px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles
				},
				{
					displayName: loc.MIGRATION_STATUS,
					valueType: azdata.DeclarativeDataType.component,
					width: '170px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles
				},
				{
					displayName: loc.MIGRATION_MODE,
					valueType: azdata.DeclarativeDataType.string,
					width: '90px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles
				},
				{
					displayName: loc.AZURE_SQL_TARGET,
					valueType: azdata.DeclarativeDataType.string,
					width: '130px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles
				},
				{
					displayName: loc.TARGET_AZURE_SQL_INSTANCE_NAME,
					valueType: azdata.DeclarativeDataType.string,
					width: '130px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles
				},
				{
					displayName: loc.DATABASE_MIGRATION_SERVICE,
					valueType: azdata.DeclarativeDataType.string,
					width: '150px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles
				},
				{
					displayName: loc.DURATION,
					valueType: azdata.DeclarativeDataType.string,
					width: '55px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles
				},
				{
					displayName: loc.START_TIME,
					valueType: azdata.DeclarativeDataType.string,
					width: '140px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles
				},
				{
					displayName: loc.FINISH_TIME,
					valueType: azdata.DeclarativeDataType.string,
					width: '140px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles
				},
				{
					displayName: '',
					valueType: azdata.DeclarativeDataType.menu,
					width: '20px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles,
				}
			]
		}).component();
		return this._statusTable;
	}

	private _statusInfoMap(status: string): azdata.IconPath {
		return status === MigrationStatus.InProgress
			|| status === MigrationStatus.Creating
			|| status === MigrationStatus.Completing
			? IconPathHelper.warning
			: IconPathHelper.error;
	}
}
