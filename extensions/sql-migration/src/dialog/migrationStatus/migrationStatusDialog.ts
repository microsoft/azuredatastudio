/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { MigrationContext, MigrationLocalStorage } from '../../models/migrationLocalStorage';
import { MigrationCutoverDialog } from '../migrationCutover/migrationCutoverDialog';
import { AdsMigrationStatus, MigrationStatusDialogModel } from './migrationStatusDialogModel';
import * as loc from '../../constants/strings';
import { convertTimeDifferenceToDuration, filterMigrations, SupportedAutoRefreshIntervals } from '../../api/utils';
import { SqlMigrationServiceDetailsDialog } from '../sqlMigrationService/sqlMigrationServiceDetailsDialog';
import { ConfirmCutoverDialog } from '../migrationCutover/confirmCutoverDialog';
import { MigrationCutoverDialogModel } from '../migrationCutover/migrationCutoverDialogModel';

const refreshFrequency: SupportedAutoRefreshIntervals = 180000;

export class MigrationStatusDialog {
	private _model: MigrationStatusDialogModel;
	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;
	private _searchBox!: azdata.InputBoxComponent;
	private _refresh!: azdata.ButtonComponent;
	private _statusDropdown!: azdata.DropDownComponent;
	private _statusTable!: azdata.DeclarativeTableComponent;
	private _refreshLoader!: azdata.LoadingComponent;
	private _autoRefreshHandle!: NodeJS.Timeout;

	constructor(migrations: MigrationContext[], private _filter: AdsMigrationStatus) {
		this._model = new MigrationStatusDialogModel(migrations);
		this._dialogObject = azdata.window.createModelViewDialog(loc.MIGRATION_STATUS, 'MigrationControllerDialog', 'wide');
	}

	initialize() {
		let tab = azdata.window.createTab('');
		tab.registerContent(async (view: azdata.ModelView) => {
			this._view = view;

			this._statusDropdown = this._view.modelBuilder.dropDown().withProps({
				ariaLabel: loc.MIGRATION_STATUS_FILTER,
				values: this._model.statusDropdownValues,
				width: '220px'
			}).component();

			this._statusDropdown.onValueChanged((value) => {
				this.populateMigrationTable();
			});

			if (this._filter) {
				this._statusDropdown.value = (<azdata.CategoryValue[]>this._statusDropdown.values).find((value) => {
					return value.name === this._filter;
				});
			}

			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: this.createSearchAndRefreshContainer()
					},
					{
						component: this._statusDropdown
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
			this._view.onClosed(e => {
				clearInterval(this._autoRefreshHandle);
			});
			return view.initializeModel(form);
		});
		this._dialogObject.content = [tab];
		this._dialogObject.cancelButton.hidden = true;
		this._dialogObject.okButton.label = loc.CLOSE;
		this._dialogObject.okButton.onClick(e => {
			clearInterval(this._autoRefreshHandle);
		});
		azdata.window.openDialog(this._dialogObject);
	}

	private canCancelMigration = (status: string | undefined) => status && status in ['InProgress', 'Creating', 'Completing', 'Creating'];
	private canCutoverMigration = (status: string | undefined) => status === 'InProgress';

	private createSearchAndRefreshContainer(): azdata.FlexContainer {
		this._searchBox = this._view.modelBuilder.inputBox().withProps({
			stopEnterPropagation: true,
			placeHolder: loc.SEARCH_FOR_MIGRATIONS,
			width: '360px'
		}).component();

		this._searchBox.onTextChanged((value) => {
			this.populateMigrationTable();
		});

		this._refresh = this._view.modelBuilder.button().withProps({
			iconPath: {
				light: IconPathHelper.refresh.light,
				dark: IconPathHelper.refresh.dark
			},
			iconHeight: '16px',
			iconWidth: '20px',
			height: '30px',
			label: loc.REFRESH_BUTTON_LABEL,
		}).component();

		this._refresh.onDidClick((e) => {
			this.refreshTable();
		});

		const flexContainer = this._view.modelBuilder.flexContainer().withProps({
			width: 900,
			CSSStyles: {
				'justify-content': 'left'
			},
		}).component();

		flexContainer.addItem(this._searchBox, {
			flex: '0'
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
			this._autoRefreshHandle = setInterval(function () { classVariable.refreshTable(); }, interval);
		}
	}

	private async populateMigrationTable(): Promise<void> {
		try {
			const migrations = filterMigrations(
				this._model._migrations,
				(<azdata.CategoryValue>this._statusDropdown.value).name,
				this._searchBox.value!);

			migrations.sort((m1, m2) => {
				return new Date(m1.migrationContext.properties.startedOn) > new Date(m2.migrationContext.properties.startedOn) ? -1 : 1;
			});

			vscode.commands.registerCommand(
				'sqlmigration.cutover',
				async (migrationId: string) => {
					try {
						const migration = migrations.find(migration => migration.migrationContext.id === migrationId);
						if (this.canCutoverMigration(migration?.migrationContext.properties.migrationStatus)) {
							const cutoverDialogModel = new MigrationCutoverDialogModel(migration!);
							await cutoverDialogModel.fetchStatus();
							const dialog = new ConfirmCutoverDialog(cutoverDialogModel);
							await dialog.initialize();
						} else {
							await vscode.window.showInformationMessage(loc.MIGRATION_CANNOT_CUTOVER);
						}
					} catch (e) {
						console.log(e);
					}
				});

			vscode.commands.registerCommand(
				'sqlmigration.view.database',
				async (migrationId: string) => {
					try {
						const migration = migrations.find(migration => migration.migrationContext.id === migrationId);
						const dialog = new MigrationCutoverDialog(migration!);
						await dialog.initialize();
					} catch (e) {
						console.log(e);
					}
				});

			vscode.commands.registerCommand(
				'sqlmigration.view.target',
				async (migrationId: string) => {
					try {
						const migration = migrations.find(migration => migration.migrationContext.id === migrationId);
						const url = 'https://portal.azure.com/#resource/' + migration!.targetManagedInstance.id;
						await vscode.env.openExternal(vscode.Uri.parse(url));
					} catch (e) {
						console.log(e);
					}
				});

			vscode.commands.registerCommand(
				'sqlmigration.view.service',
				async (migrationId: string) => {
					try {
						const migration = migrations.find(migration => migration.migrationContext.id === migrationId);
						const dialog = new SqlMigrationServiceDetailsDialog(migration!);
						await dialog.initialize();
					} catch (e) {
						console.log(e);
					}
				});

			vscode.commands.registerCommand(
				'sqlmigration.copy.migration',
				async (migrationId: string) => {
					try {
						const migration = migrations.find(migration => migration.migrationContext.id === migrationId);
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
						console.log(e);
					}
				});

			vscode.commands.registerCommand(
				'sqlmigration.cancel.migration',
				async (migrationId: string) => {
					try {
						const migration = migrations.find(migration => migration.migrationContext.id === migrationId);
						if (this.canCancelMigration(migration?.migrationContext.properties.migrationStatus)) {
							vscode.window.showInformationMessage(loc.CANCEL_MIGRATION_CONFIRMATION, loc.YES, loc.NO).then(async (v) => {
								if (v === loc.YES) {
									const cutoverDialogModel = new MigrationCutoverDialogModel(migration!);
									await cutoverDialogModel.fetchStatus();
									await cutoverDialogModel.cancelMigration();
								}
							});
						} else {
							await vscode.window.showInformationMessage(loc.MIGRATION_CANNOT_CANCEL);
						}
					} catch (e) {
						console.log(e);
					}
				});

			const data: azdata.DeclarativeTableCellValue[][] = migrations.map((migration, index) => {
				return [
					{ value: this._getDatabaserHyperLink(migration) },
					{ value: this._getMigrationStatus(migration) },
					{ value: loc.ONLINE },
					{ value: this._getMigrationTargetType(migration) },
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
							commands: [
								'sqlmigration.cutover',
								'sqlmigration.view.database',
								'sqlmigration.view.target',
								'sqlmigration.view.service',
								'sqlmigration.copy.migration',
								'sqlmigration.cancel.migration',
							],
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

	private _getDatabaserHyperLink(migration: MigrationContext): azdata.HyperlinkComponent {
		const databaseHyperLink = this._view.modelBuilder
			.hyperlink()
			.withProps({
				label: migration.migrationContext.properties.sourceDatabaseName,
				url: '',
			}).component();

		databaseHyperLink.onDidClick(
			async (e) => await (new MigrationCutoverDialog(migration)).initialize());

		return databaseHyperLink;
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

	private _getMigrationTargetType(migration: MigrationContext): string {
		return migration.targetManagedInstance.type === 'microsoft.sql/managedinstances'
			? loc.SQL_MANAGED_INSTANCE
			: loc.SQL_VIRTUAL_MACHINE;
	}

	private _getMigrationStatus(migration: MigrationContext): string {
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

		return loc.STATUS_WARNING_COUNT(migrationStatus, warningCount);
	}

	private async refreshTable(): Promise<void> {
		this._refreshLoader.loading = true;
		const currentConnection = await azdata.connection.getCurrentConnection();
		this._model._migrations = await MigrationLocalStorage.getMigrationsBySourceConnections(currentConnection, true);
		await this.populateMigrationTable();
		this._refreshLoader.loading = false;
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
					valueType: azdata.DeclarativeDataType.string,
					width: '150px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles
				},
				{
					displayName: loc.MIGRATION_MODE,
					valueType: azdata.DeclarativeDataType.string,
					width: '100px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles
				},
				{
					displayName: loc.AZURE_SQL_TARGET,
					valueType: azdata.DeclarativeDataType.string,
					width: '140px',
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
					width: '120px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles
				},
				{
					displayName: loc.FINISH_TIME,
					valueType: azdata.DeclarativeDataType.string,
					width: '120px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles
				},
				{
					displayName: '',
					valueType: azdata.DeclarativeDataType.menu,
					width: '60px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles,
				}
			]
		}).component();
		return this._statusTable;
	}
}
