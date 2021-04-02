/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { MigrationContext } from '../../models/migrationLocalStorage';
import { MigrationCutoverDialog } from '../migrationCutover/migrationCutoverDialog';
import { MigrationCategory, MigrationStatusDialogModel } from './migrationStatusDialogModel';
import * as loc from '../../constants/strings';
import { AzureAsyncOperationResource, getMigrationAsyncOperationDetails, getMigrationStatus } from '../../api/azure';
export class MigrationStatusDialog {
	private _model: MigrationStatusDialogModel;
	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;
	private _searchBox!: azdata.InputBoxComponent;
	private _refresh!: azdata.ButtonComponent;
	private _statusDropdown!: azdata.DropDownComponent;
	private _statusTable!: azdata.DeclarativeTableComponent;
	private _refreshLoader!: azdata.LoadingComponent;

	constructor(migrations: MigrationContext[], private _filter: MigrationCategory, _asyncErrors: number[] = []) {
		this._model = new MigrationStatusDialogModel(migrations, _asyncErrors);
		this._dialogObject = azdata.window.createModelViewDialog(loc.MIGRATION_STATUS, 'MigrationControllerDialog', 'wide');
	}

	initialize() {
		let tab = azdata.window.createTab('');
		tab.registerContent((view: azdata.ModelView) => {
			this._view = view;

			this._statusDropdown = this._view.modelBuilder.dropDown().withProps({
				values: this._model.statusDropdownValues,
				width: '220px'
			}).component();

			this._statusDropdown.onValueChanged((value) => {
				this.populateMigrationTable();
			});

			this._statusDropdown.value = this._statusDropdown.values![this._filter];

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
			return view.initializeModel(form);
		});
		this._dialogObject.content = [tab];
		azdata.window.openDialog(this._dialogObject);
	}

	private createSearchAndRefreshContainer(): azdata.FlexContainer {
		this._searchBox = this._view.modelBuilder.inputBox().withProps({
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
			CSSStyles: {
				'justify-content': 'left'
			}
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

		return flexContainer;
	}

	private populateMigrationTable(): void {
		try {
			const migrations = this._model.filterMigration(
				this._searchBox.value!,
				(<azdata.CategoryValue>this._statusDropdown.value).name
			);

			const data: azdata.DeclarativeTableCellValue[][] = [];

			migrations.sort((m1, m2) => {
				return new Date(m1.migrationContext.properties.startedOn) > new Date(m2.migrationContext.properties.startedOn) ? -1 : 1;
			});

			migrations.forEach((migration, index) => {
				const migrationRow: azdata.DeclarativeTableCellValue[] = [];

				const databaseHyperLink = this._view.modelBuilder.hyperlink().withProps({
					label: migration.migrationContext.name,
					url: ''
				}).component();
				databaseHyperLink.onDidClick(async (e) => {
					await (new MigrationCutoverDialog(migration)).initialize();
				});
				migrationRow.push({
					value: databaseHyperLink,
				});

				const targetMigrationIcon = this._view.modelBuilder.image().withProps({
					iconPath: (migration.targetManagedInstance.type === 'microsoft.sql/managedinstances') ? IconPathHelper.sqlMiLogo : IconPathHelper.sqlVmLogo,
					iconWidth: '16px',
					iconHeight: '16px',
					width: '32px',
					height: '20px'
				}).component();
				const sqlMigrationName = this._view.modelBuilder.hyperlink().withProps({
					label: migration.targetManagedInstance.name,
					url: ''
				}).component();
				sqlMigrationName.onDidClick((e) => {
					vscode.window.showInformationMessage(loc.COMING_SOON);
				});

				const sqlMigrationContainer = this._view.modelBuilder.flexContainer().withProps({
					CSSStyles: {
						'justify-content': 'left'
					}
				}).component();
				sqlMigrationContainer.addItem(targetMigrationIcon, {
					flex: '0',
					CSSStyles: {
						'width': '32px'
					}
				});
				sqlMigrationContainer.addItem(sqlMigrationName,
					{
						CSSStyles: {
							'width': 'auto'
						}
					});
				migrationRow.push({
					value: sqlMigrationContainer
				});

				migrationRow.push({
					value: loc.ONLINE
				});

				let migrationStatus = migration.migrationContext.properties.migrationStatus ? migration.migrationContext.properties.migrationStatus : migration.migrationContext.properties.provisioningState;

				if (this._model._migrationWarnings[index]) {
					if (this._model._migrationWarnings[index] === 1) {
						migrationStatus += ` (${this._model._migrationWarnings[index]} Warning)`;
					} else {
						migrationStatus += ` (${this._model._migrationWarnings[index]} Warnings)`;
					}
				}

				migrationRow.push({
					value: migrationStatus
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
		this._model._migrationWarnings = [];
		for (let i = 0; i < this._model._migrations.length; i++) {
			this._model._migrations[i].migrationContext = await getMigrationStatus(
				this._model._migrations[i].azureAccount,
				this._model._migrations[i].subscription,
				this._model._migrations[i].migrationContext
			);

			let warningCount = 0;
			let asynError: AzureAsyncOperationResource | undefined;
			if (this._model._migrations[i].asyncUrl) {
				asynError = await getMigrationAsyncOperationDetails(
					this._model._migrations[i].azureAccount,
					this._model._migrations[i].subscription,
					this._model._migrations[i].asyncUrl
				);
			}
			if (asynError?.error?.message) {
				warningCount++;
			}
			if (this._model._migrations[i].migrationContext.properties.migrationFailureError?.message) {
				warningCount++;
			}
			if (this._model._migrations[i].migrationContext.properties.migrationStatusDetails?.fileUploadBlockingErrors) {
				warningCount += this._model._migrations[i].migrationContext.properties.migrationStatusDetails?.fileUploadBlockingErrors.length!;
			}
			if (this._model._migrations[i].migrationContext.properties.migrationStatusDetails?.restoreBlockingReason) {
				warningCount += 1;
			}

			this._model._migrationWarnings.push(warningCount);
		}
		this.populateMigrationTable();
		this._refreshLoader.loading = false;
	}

	private createStatusTable(): azdata.DeclarativeTableComponent {
		const rowCssStyle: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left',
			'border-bottom': '1px solid'
		};

		const headerCssStyles: azdata.CssStyles = {
			'border': 'none',
			'text-align': 'left',
			'border-bottom': '1px solid',
			'font-weight': 'bold'
		};

		this._statusTable = this._view.modelBuilder.declarativeTable().withProps({
			columns: [
				{
					displayName: loc.DATABASE,
					valueType: azdata.DeclarativeDataType.component,
					width: '100px',
					isReadOnly: true,
					rowCssStyles: rowCssStyle,
					headerCssStyles: headerCssStyles
				},
				{
					displayName: loc.TARGET_AZURE_SQL_INSTANCE_NAME,
					valueType: azdata.DeclarativeDataType.component,
					width: '170px',
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
