/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import { AzureSqlDatabaseServer } from '../../api/azure';
import { collectTargetDatabaseTableInfo, TargetTableInfo } from '../../api/sqlUtils';
import { MigrationStateModel } from '../../models/stateMachine';
import { formatNumber } from '../../constants/helper';

const DialogName = 'TableMigrationSelection';

export class TableMigrationSelectionDialog {
	private _dialog: azdata.window.Dialog | undefined;
	private _headingText!: azdata.TextComponent;
	private _filterInputBox!: azdata.InputBoxComponent;
	private _tableSelectionTable!: azdata.TableComponent;
	private _tableLoader!: azdata.LoadingComponent;
	private _disposables: vscode.Disposable[] = [];
	private _isOpen: boolean = false;
	private _model: MigrationStateModel;
	private _sourceDatabaseName: string;
	private _tableSelectionMap!: Map<string, TargetTableInfo>;
	private _onSaveCallback: () => Promise<void>;

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
			this._tableLoader.loading = true;
			const targetDatabaseInfo = this._model._sourceTargetMapping.get(this._sourceDatabaseName);
			if (targetDatabaseInfo) {
				const tableList: TargetTableInfo[] = await collectTargetDatabaseTableInfo(
					this._model._targetServerInstance as AzureSqlDatabaseServer,
					targetDatabaseInfo.databaseName,
					this._model._azureTenant.id,
					this._model._targetUserName,
					this._model._targetPassword);

				this._tableSelectionMap = new Map();
				tableList.forEach(table => {
					const isSelected = targetDatabaseInfo.targetTables.get(table.tableName)?.selectedForMigration === true;
					const tableInfo: TargetTableInfo = {
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
			this._tableLoader.loading = false;
			await this._loadControls();
		}
	}

	private async _loadControls(): Promise<void> {
		const data: any[][] = [];
		const filterText = this._filterInputBox.value ?? '';
		const selectedItems: number[] = [];
		let tableRow = 0;
		this._tableSelectionMap.forEach(table => {
			if (filterText?.length === 0 || table.tableName.indexOf(filterText) > -1) {
				data.push([
					table.selectedForMigration,
					table.tableName,
					table.rowCount > 0
						? `${formatNumber(table.rowCount)}`
						: '--']);
				if (table.selectedForMigration) {
					selectedItems.push(tableRow);
				}
				tableRow++;
			}
		});
		await this._tableSelectionTable.updateProperty('data', data);
		this._tableSelectionTable.selectedRows = selectedItems;
		this._updateRowSelection();
	}

	private async _initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		dialog.registerContent(async (view) => {
			this._filterInputBox = view.modelBuilder.inputBox()
				.withProps({
					inputType: 'search',
					placeHolder: constants.TABLE_SELECTION_FILTER,
					width: 268,
				}).component();

			this._disposables.push(
				this._filterInputBox.onTextChanged(
					async e => await this._loadControls()));

			this._headingText = view.modelBuilder.text()
				.withProps({ value: constants.DATABASE_LOADING_TABLES })
				.component();

			this._tableSelectionTable = await this._createSelectionTable(view);
			this._tableLoader = view.modelBuilder.loadingComponent()
				.withItem(this._tableSelectionTable)
				.withProps({
					loading: false,
					loadingText: constants.DATABASE_TABLE_DATA_LOADING
				}).component();

			const flex = view.modelBuilder.flexContainer()
				.withItems([
					this._filterInputBox,
					this._headingText,
					this._tableLoader],
					{ flex: '0 0 auto' })
				.withProps({ CSSStyles: { 'margin': '0 0 0 15px' } })
				.withLayout({
					flexFlow: 'column',
					height: '100%',
					width: 565,
				}).component();

			this._disposables.push(
				view.onClosed(e =>
					this._disposables.forEach(
						d => { try { d.dispose(); } catch { } })));

			await view.initializeModel(flex);
			await this._loadData();
		});
	}

	public async openDialog(dialogTitle: string) {
		if (!this._isOpen) {
			this._isOpen = true;
			this._dialog = azdata.window.createModelViewDialog(
				dialogTitle,
				DialogName,
				600);

			this._dialog.okButton.label = constants.TABLE_SELECTION_UPDATE_BUTTON;
			this._disposables.push(
				this._dialog.okButton.onClick(
					async () => this._save()));

			this._dialog.cancelButton.label = constants.TABLE_SELECTION_CANCEL_BUTTON;
			this._disposables.push(
				this._dialog.cancelButton.onClick(
					async () => this._isOpen = false));

			const promise = this._initializeDialog(this._dialog);
			azdata.window.openDialog(this._dialog);
			await promise;
		}
	}

	private async _createSelectionTable(view: azdata.ModelView): Promise<azdata.TableComponent> {
		const cssClass = 'no-borders';
		const table = view.modelBuilder.table()
			.withProps({
				data: [],
				width: 565,
				height: '500px',
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
						width: 300,
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
			table.onRowSelected(e => {
				// collect table list selected for migration
				const selectedRows = this._tableSelectionTable.selectedRows ?? [];
				const selectedTables = new Map<String, TargetTableInfo>();
				selectedRows.forEach(rowIndex => {
					const tableName = this._tableSelectionTable.data[rowIndex][1] as string;
					const tableInfo = this._tableSelectionMap.get(tableName);
					if (tableInfo) {
						selectedTables.set(tableName, tableInfo);
					}
				});

				// update visible table selections in table map
				this._tableSelectionTable.data.forEach(tableRow => {
					const tableName = tableRow[1] as string;
					const tableInfo = this._tableSelectionMap.get(tableName);
					if (tableInfo) {
						const isSelected = selectedTables.has(tableName);
						tableInfo.selectedForMigration = isSelected;
						this._tableSelectionMap.set(tableInfo.tableName, tableInfo);
					}
				});

				// update table selections in table map
				this._tableSelectionMap.forEach(tableInfo => {
					const isSelected = selectedTables.has(tableInfo.tableName);
					tableInfo.selectedForMigration = isSelected;
					this._tableSelectionMap.set(tableInfo.tableName, tableInfo);
				});

				this._updateRowSelection();
			}));

		return table;
	}

	private _updateRowSelection(): void {
		this._headingText.value = this._tableSelectionTable.data.length > 0
			? constants.TABLE_SELECTED_COUNT(this._tableSelectionTable.selectedRows?.length ?? 0, this._tableSelectionTable.data.length)
			: this._tableLoader.loading
				? constants.DATABASE_LOADING_TABLES
				: constants.DATABASE_MISSING_TABLES;
	}

	private async _save(): Promise<void> {
		const targetDatabaseInfo = this._model._sourceTargetMapping.get(this._sourceDatabaseName);
		if (targetDatabaseInfo) {
			// collect table list selected for migration
			const selectedRows = this._tableSelectionTable.selectedRows ?? [];
			const selectedTables = new Map<String, TargetTableInfo>();
			selectedRows.forEach(rowIndex => {
				const tableName = this._tableSelectionTable.data[rowIndex][1] as string;
				const tableInfo = this._tableSelectionMap.get(tableName);
				if (tableInfo) {
					selectedTables.set(tableName, tableInfo);
				}
			});

			// copy table map selection status from grid
			this._tableSelectionMap.forEach(tableInfo => {
				tableInfo.selectedForMigration = selectedTables.has(tableInfo.tableName);
				this._tableSelectionMap.set(tableInfo.tableName, tableInfo);
			});

			// save table selection changes to migration source target map
			targetDatabaseInfo.targetTables = this._tableSelectionMap;
			this._model._sourceTargetMapping.set(this._sourceDatabaseName, targetDatabaseInfo);
		}
		await this._onSaveCallback();
		this._isOpen = false;
	}
}
