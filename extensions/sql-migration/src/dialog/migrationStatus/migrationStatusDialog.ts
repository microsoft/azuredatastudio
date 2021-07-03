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
			label: 'Refresh',
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
		let classVariable = this;
		clearInterval(this._autoRefreshHandle);
		if (interval !== -1) {
			this._autoRefreshHandle = setInterval(function () { classVariable.refreshTable(); }, interval);
		}
	}

	private populateMigrationTable(): void {
		try {
			const migrations = filterMigrations(this._model._migrations, (<azdata.CategoryValue>this._statusDropdown.value).name, this._searchBox.value!);

			const data: azdata.DeclarativeTableCellValue[][] = [];

			migrations.sort((m1, m2) => {
				return new Date(m1.migrationContext.properties.startedOn) > new Date(m2.migrationContext.properties.startedOn) ? -1 : 1;
			});

			migrations.forEach((migration, index) => {
				const migrationRow: azdata.DeclarativeTableCellValue[] = [];

				const databaseHyperLink = this._view.modelBuilder.hyperlink().withProps({
					label: migration.migrationContext.properties.sourceDatabaseName,
					url: ''
				}).component();
				databaseHyperLink.onDidClick(async (e) => {
					await (new MigrationCutoverDialog(migration)).initialize();
				});
				migrationRow.push({
					value: databaseHyperLink,
				});

				migrationRow.push({
					value: (migration.targetManagedInstance.type === 'microsoft.sql/managedinstances') ? loc.SQL_MANAGED_INSTANCE : loc.SQL_VIRTUAL_MACHINE
				});

				const sqlMigrationName = this._view.modelBuilder.hyperlink().withProps({
					label: migration.targetManagedInstance.name,
					url: ''
				}).component();
				sqlMigrationName.onDidClick((e) => {
					vscode.window.showInformationMessage(loc.COMING_SOON);
				});

				migrationRow.push({
					value: sqlMigrationName
				});

				const dms = this._view.modelBuilder.hyperlink().withProps({
					label: migration.controller.name,
					url: ''
				}).component();
				dms.onDidClick((e) => {
					(new SqlMigrationServiceDetailsDialog(migration)).initialize();
				});

				migrationRow.push({
					value: dms
				});

				migrationRow.push({
					value: loc.ONLINE
				});

				let migrationStatus = migration.migrationContext.properties.migrationStatus ? migration.migrationContext.properties.migrationStatus : migration.migrationContext.properties.provisioningState;

				let warningCount = 0;

				if (migration.asyncOperationResult?.error?.message) {
					warningCount++;
				}
				if (migration.migrationContext.properties.migrationFailureError?.message) {
					warningCount++;
				}
				if (migration.migrationContext.properties.migrationStatusDetails?.fileUploadBlockingErrors) {
					warningCount += migration.migrationContext.properties.migrationStatusDetails?.fileUploadBlockingErrors.length;
				}
				if (migration.migrationContext.properties.migrationStatusDetails?.restoreBlockingReason) {
					warningCount++;
				}

				migrationRow.push({
					value: loc.STATUS_WARNING_COUNT(migrationStatus, warningCount)
				});

				let duration;
				if (migration.migrationContext.properties.endedOn) {
					duration = convertTimeDifferenceToDuration(new Date(migration.migrationContext.properties.startedOn), new Date(migration.migrationContext.properties.endedOn));
				} else {
					duration = convertTimeDifferenceToDuration(new Date(migration.migrationContext.properties.startedOn), new Date());
				}

				migrationRow.push({
					value: (migration.migrationContext.properties.startedOn) ? duration : '---'
				});

				migrationRow.push({
					value: (migration.migrationContext.properties.startedOn) ? new Date(migration.migrationContext.properties.startedOn).toLocaleString() : '---'
				});
				migrationRow.push({
					value: (migration.migrationContext.properties.endedOn) ? new Date(migration.migrationContext.properties.endedOn).toLocaleString() : '---'
				});

				data.push(migrationRow);
			});

			this._statusTable.dataValues = data;
		} catch (e) {
			console.log(e);
		}
	}

	private async refreshTable(): Promise<void> {
		this._refreshLoader.loading = true;
		const currentConnection = await azdata.connection.getCurrentConnection();
		this._model._migrations = await MigrationLocalStorage.getMigrationsBySourceConnections(currentConnection, true);
		this.populateMigrationTable();
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
					displayName: loc.AZURE_SQL_TARGET,
					valueType: azdata.DeclarativeDataType.string,
					width: '140px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles
				},
				{
					displayName: loc.TARGET_AZURE_SQL_INSTANCE_NAME,
					valueType: azdata.DeclarativeDataType.component,
					width: '130px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles
				},
				{
					displayName: loc.DATABASE_MIGRATION_SERVICE,
					valueType: azdata.DeclarativeDataType.component,
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
					displayName: loc.MIGRATION_STATUS,
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
				}
			]
		}).component();
		return this._statusTable;
	}
}
