/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import { AzureSqlDatabaseServer } from '../../api/azure';
import { collectSourceDatabaseTableInfo, collectTargetDatabaseTableInfo, TableInfo } from '../../api/sqlUtils';
import { MigrationStateModel } from '../../models/stateMachine';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { Tab } from 'azdata';
import { updateControlDisplay } from '../../api/utils';

const DialogName = 'TableMigrationSelection';

export class TableMigrationSelectionDialog {
	private _dialog: azdata.window.Dialog | undefined;
	private _headingText!: azdata.TextComponent;
	private _refreshButton!: azdata.ButtonComponent;
	private _filterInputBox!: azdata.InputBoxComponent;
	private _tableSelectionTable!: azdata.TableComponent;
	private _missingTargetTablesTable!: azdata.TableComponent;
	private _refreshLoader!: azdata.LoadingComponent;
	private _disposables: vscode.Disposable[] = [];
	private _isOpen: boolean = false;
	private _model: MigrationStateModel;
	private _sourceDatabaseName: string;
	private _tableSelectionMap!: Map<string, TableInfo>;
	private _targetTableMap!: Map<string, TableInfo>;
	private _onSaveCallback: () => Promise<void>;
	private _missingTableCount: number = 0;
	private _selectableTablesTab!: Tab;
	private _missingTablesTab!: Tab;
	private _tabs!: azdata.TabbedPanelComponent;

	constructor(
		model: MigrationStateModel,
		sourceDatabaseName: string,
		onSaveCallback: () => Promise<void>
	) {
		this._model = model;
		this._sourceDatabaseName = sourceDatabaseName;
		this._onSaveCallback = onSaveCallback;
	}

	private async _loadData(): Promise<void> {
		try {
			this._refreshLoader.loading = true;
			this._dialog!.message = { text: '' };

			await this._updateRowSelection();
			await updateControlDisplay(this._tableSelectionTable, false);
			await updateControlDisplay(this._missingTargetTablesTable, false);

			const targetDatabaseInfo = this._model._sourceTargetMapping.get(this._sourceDatabaseName);
			if (targetDatabaseInfo) {
				const sourceTableList: TableInfo[] = await collectSourceDatabaseTableInfo(
					this._sourceDatabaseName);

				const targetTableList: TableInfo[] = await collectTargetDatabaseTableInfo(
					this._model._targetServerInstance as AzureSqlDatabaseServer,
					targetDatabaseInfo.databaseName,
					this._model._azureTenant.id,
					this._model._targetUserName,
					this._model._targetPassword);

				this._targetTableMap = new Map();
				targetTableList.forEach(table =>
					this._targetTableMap.set(
						table.tableName, {
						databaseName: table.databaseName,
						rowCount: table.rowCount,
						selectedForMigration: false,
						tableName: table.tableName,
					}));

				this._tableSelectionMap = new Map();
				sourceTableList.forEach(table => {
					// If the source table doesn't exist in the target, set isSelected to false.
					// Otherwise, set it to true as default.
					var isSelected = false;
					var sourceTable = targetDatabaseInfo.sourceTables.get(table.tableName);
					if (sourceTable === null || sourceTable === undefined) {
						sourceTable = this._targetTableMap.get(table.tableName);
						isSelected = sourceTable === null || sourceTable === undefined ? false : true;
					} else {
						isSelected = sourceTable.selectedForMigration;
					}

					const tableInfo: TableInfo = {
						databaseName: table.databaseName,
						rowCount: table.rowCount,
						selectedForMigration: isSelected,
						tableName: table.tableName,
					};
					this._tableSelectionMap.set(table.tableName, tableInfo);
				});
			}
		} catch (error) {
			this._dialog!.message = {
				text: constants.DATABASE_TABLE_CONNECTION_ERROR,
				description: constants.DATABASE_TABLE_CONNECTION_ERROR_MESSAGE(error.message),
				level: azdata.window.MessageLevel.Error
			};
		} finally {
			await updateControlDisplay(this._tableSelectionTable, true, 'flex');
			await updateControlDisplay(this._missingTargetTablesTable, true, 'flex');
			this._refreshLoader.loading = false;

			await this._loadControls();
		}
	}

	private async _loadControls(): Promise<void> {
		const data: any[][] = [];
		const missingData: any[][] = [];
		const filterText = this._filterInputBox.value ?? '';
		const selectedItems: number[] = [];
		let tableRow = 0;
		this._missingTableCount = 0;
		this._tableSelectionMap.forEach(sourceTable => {
			const tableName = sourceTable.tableName.toLocaleLowerCase();
			const searchText = filterText.toLocaleLowerCase();
			if (filterText?.length === 0 || tableName.indexOf(searchText) > -1) {
				const targetTable = this._targetTableMap.get(sourceTable.tableName);
				if (targetTable) {
					const targetTableRowCount = targetTable?.rowCount ?? 0;
					const tableStatus = targetTableRowCount > 0
						? constants.TARGET_TABLE_NOT_EMPTY
						: '--';

					data.push([
						sourceTable.selectedForMigration,
						sourceTable.tableName,
						tableStatus]);

					if (sourceTable.selectedForMigration) {
						selectedItems.push(tableRow);
					}

					tableRow++;
				} else {
					this._missingTableCount++;
					missingData.push([sourceTable.tableName]);
				}
			}
		});
		await this._tableSelectionTable.updateProperty('data', data);
		this._tableSelectionTable.selectedRows = selectedItems;
		await this._missingTargetTablesTable.updateProperty('data', missingData);

		await this._updateRowSelection();
		if (this._missingTableCount > 0 && this._tabs.items.length === 1) {
			this._tabs.updateTabs([this._selectableTablesTab, this._missingTablesTab]);
		}
	}

	private async _initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		const tab = azdata.window.createTab('');
		tab.registerContent(async (view) => {

			this._tabs = view.modelBuilder.tabbedPanel()
				.withTabs([])
				.component();

			await this._createSelectableTablesTab(view);
			await this._createMissingTablesTab(view);

			this._tabs.updateTabs([this._selectableTablesTab]);

			this._disposables.push(
				view.onClosed(e =>
					this._disposables.forEach(
						d => { try { d.dispose(); } catch { } })));

			await view.initializeModel(this._tabs);
			await this._loadData();
		});

		dialog.content = [tab];
	}

	public async openDialog(dialogTitle: string) {
		if (!this._isOpen) {
			this._isOpen = true;
			this._dialog = azdata.window.createModelViewDialog(
				dialogTitle,
				DialogName,
				600, undefined, undefined, false);

			this._dialog.okButton.label = constants.TABLE_SELECTION_UPDATE_BUTTON;
			this._dialog.okButton.position = 'left';
			this._disposables.push(
				this._dialog.okButton.onClick(
					async () => this._save()));

			this._dialog.cancelButton.label = constants.TABLE_SELECTION_CANCEL_BUTTON;
			this._dialog.cancelButton.position = 'left';
			this._disposables.push(
				this._dialog.cancelButton.onClick(
					async () => this._isOpen = false));

			const promise = this._initializeDialog(this._dialog);
			azdata.window.openDialog(this._dialog);
			await promise;
		}
	}

	private async _createSelectableTablesTab(view: azdata.ModelView): Promise<void> {
		this._headingText = view.modelBuilder.text()
			.withProps({ value: constants.DATABASE_LOADING_TABLES })
			.component();

		this._filterInputBox = view.modelBuilder.inputBox()
			.withProps({
				inputType: 'search',
				placeHolder: constants.TABLE_SELECTION_FILTER,
				width: 268,
			}).component();

		this._disposables.push(
			this._filterInputBox.onTextChanged(
				async e => await this._loadControls()));

		this._refreshButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.refresh,
				label: constants.DATABASE_TABLE_REFRESH_LABEL,
				width: 70,
				CSSStyles: { 'margin': '5px 0 0 15px' },
			})
			.component();
		this._disposables.push(
			this._refreshButton.onDidClick(
				async e => await this._loadData()));

		this._refreshLoader = view.modelBuilder.loadingComponent()
			.withItem(this._refreshButton)
			.withProps({
				loading: false,
				CSSStyles: { 'height': '8px', 'margin': '5px 0 0 15px' }
			})
			.component();

		const flexTopRow = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
				flexWrap: 'wrap',
			})
			.component();
		flexTopRow.addItem(this._filterInputBox, { flex: '0 0 auto' });
		flexTopRow.addItem(this._refreshLoader, { flex: '0 0 auto' });

		this._tableSelectionTable = await this._createSelectionTable(view);

		const flex = view.modelBuilder.flexContainer()
			.withItems([])
			.withItems([
				flexTopRow,
				this._headingText,
				this._tableSelectionTable,
			], { flex: '0 0 auto' })
			.withProps({ CSSStyles: { 'margin': '10px 0 0 15px' } })
			.withLayout({
				flexFlow: 'column',
				height: '100%',
				width: 550,
			}).component();

		this._selectableTablesTab = {
			content: flex,
			id: 'tableSelectionTab',
			title: constants.SELECT_TABLES_FOR_MIGRATION,
		};
	}

	private async _createMissingTablesTab(view: azdata.ModelView): Promise<void> {
		this._missingTargetTablesTable = await this._createMissingTablesTable(view);

		const flex = view.modelBuilder.flexContainer()
			.withItems([this._missingTargetTablesTable], { flex: '0 0 auto' })
			.withItems([])
			.withProps({ CSSStyles: { 'margin': '10px 0 0 15px' } })
			.withLayout({
				flexFlow: 'column',
				height: '100%',
				width: 550,
			}).component();

		this._missingTablesTab = {
			content: flex,
			id: 'missingTablesTab',
			title: constants.MISSING_TARGET_TABLES_COUNT(this._missingTableCount),
		};
	}

	private async _createSelectionTable(view: azdata.ModelView): Promise<azdata.TableComponent> {
		const cssClass = 'no-borders';
		const table = view.modelBuilder.table()
			.withProps({
				data: [],
				width: 550,
				height: '600px',
				display: 'flex',
				forceFitColumns: azdata.ColumnSizingMode.ForceFit,
				columns: [
					<azdata.CheckboxColumn>{
						value: '',
						width: 10,
						type: azdata.ColumnType.checkBox,
						action: azdata.ActionOnCellCheckboxCheck.selectRow,
						resizable: false,
						cssClass: cssClass,
						headerCssClass: cssClass,
					},
					{
						name: constants.TABLE_SELECTION_TABLENAME_COLUMN,
						value: 'tableName',
						type: azdata.ColumnType.text,
						width: 285,
						cssClass: cssClass,
						headerCssClass: cssClass,
					},
					{
						name: constants.TABLE_SELECTION_HASROWS_COLUMN,
						value: 'hasRows',
						type: azdata.ColumnType.text,
						width: 255,
						cssClass: cssClass,
						headerCssClass: cssClass,
					}]
			})
			.withValidation(() => true)
			.component();

		this._disposables.push(
			table.onRowSelected(
				async e => {
					// collect table list selected for migration
					const selectedRows = this._tableSelectionTable.selectedRows ?? [];
					selectedRows.forEach(rowIndex => {
						// get selected source table name
						const rowData = this._tableSelectionTable.data[rowIndex];
						const sourceTableName = rowData.length > 1
							? rowData[1] as string
							: '';
						// get source table info
						const sourceTableInfo = this._tableSelectionMap.get(sourceTableName);
						if (sourceTableInfo) {
							// see if source table exists on target database
							const targetTableInfo = this._targetTableMap.get(sourceTableName);
							// keep source table selected
							sourceTableInfo.selectedForMigration = targetTableInfo !== undefined;
							// update table selection map with new selectedForMigration value
							this._tableSelectionMap.set(sourceTableName, sourceTableInfo);
						}
					});

					await this._updateRowSelection();
				}));

		return table;
	}

	private async _createMissingTablesTable(view: azdata.ModelView): Promise<azdata.TableComponent> {
		const cssClass = 'no-borders';
		const table = view.modelBuilder.table()
			.withProps({
				data: [],
				width: 550,
				height: '600px',
				display: 'flex',
				forceFitColumns: azdata.ColumnSizingMode.ForceFit,
				columns: [{
					name: constants.MISSING_TABLE_NAME_COLUMN,
					value: 'tableName',
					type: azdata.ColumnType.text,
					cssClass: cssClass,
					headerCssClass: cssClass,
				}],
			})
			.withValidation(() => true)
			.component();

		return table;
	}

	private async _updateRowSelection(): Promise<void> {
		this._headingText.value = this._refreshLoader.loading
			? constants.DATABASE_LOADING_TABLES
			: this._tableSelectionTable.data?.length > 0
				? constants.TABLE_SELECTED_COUNT(
					this._tableSelectionTable.selectedRows?.length ?? 0,
					this._tableSelectionTable.data?.length ?? 0)
				: constants.DATABASE_MISSING_TABLES;

		this._missingTablesTab.title = constants.MISSING_TARGET_TABLES_COUNT(this._missingTableCount);
	}

	private async _save(): Promise<void> {
		const targetDatabaseInfo = this._model._sourceTargetMapping.get(this._sourceDatabaseName);
		if (targetDatabaseInfo) {
			// collect table list selected for migration
			const selectedRows = this._tableSelectionTable.selectedRows ?? [];
			const selectedTables = new Map<String, TableInfo>();
			selectedRows.forEach(rowIndex => {
				const tableRow = this._tableSelectionTable.data[rowIndex];
				const tableName = tableRow.length > 1
					? tableRow[1] as string
					: '';
				const tableInfo = this._tableSelectionMap.get(tableName);
				if (tableInfo) {
					selectedTables.set(tableName, tableInfo);
				}
			});

			// copy table map selection status from grid
			this._tableSelectionMap.forEach(tableInfo => {
				const selectedTableInfo = selectedTables.get(tableInfo.tableName);
				tableInfo.selectedForMigration = selectedTableInfo?.selectedForMigration === true;
				this._tableSelectionMap.set(tableInfo.tableName, tableInfo);
			});

			// save table selection changes to migration source target map
			targetDatabaseInfo.sourceTables = this._tableSelectionMap;
			this._model._sourceTargetMapping.set(this._sourceDatabaseName, targetDatabaseInfo);
		}
		await this._onSaveCallback();
		this._isOpen = false;
	}
}
