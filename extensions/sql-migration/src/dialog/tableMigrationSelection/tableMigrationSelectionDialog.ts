/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
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
	private _schemaMigrationCheckBox!: azdata.CheckBoxComponent;
	private _schemaMigrationInfoBox!: azdata.InfoBoxComponent;
	private _filterInputBox!: azdata.InputBoxComponent;
	private _tableSelectionTable!: azdata.TableComponent;
	private _missingTargetTablesTable!: azdata.TableComponent;
	private _refreshLoader!: azdata.LoadingComponent;
	private _disposables: vscode.Disposable[] = [];
	private _isOpen: boolean = false;
	private _model: MigrationStateModel;
	private _sourceDatabaseName: string;
	private _tableSelectionMap!: Map<string, TableInfo>;
	private _missingTableSelectionMap!: Map<string, TableInfo>;
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

			this._updateRowSelection();
			await updateControlDisplay(this._tableSelectionTable, false);
			await updateControlDisplay(this._missingTargetTablesTable, false);

			const targetDatabaseInfo = this._model._sourceTargetMapping.get(this._sourceDatabaseName);
			if (targetDatabaseInfo) {
				targetDatabaseInfo.enableSchemaMigration = false;
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
				this._missingTableSelectionMap = new Map();
				sourceTableList.forEach(table => {
					// If the source table doesn't exist in the target, set isSelected to false.
					// Otherwise, set it to true as default.
					var isSelected = false;
					var sourceTable = this._targetTableMap.get(table.tableName);
					if (sourceTable === null || sourceTable === undefined) {
						isSelected = false;
						const tableInfo: TableInfo = {
							databaseName: table.databaseName,
							rowCount: table.rowCount,
							selectedForMigration: isSelected,
							tableName: table.tableName,
						};
						this._missingTableSelectionMap.set(table.tableName, tableInfo);
					} else {
						var savedSourceTable = targetDatabaseInfo.sourceTables.get(table.tableName);
						isSelected = savedSourceTable === null || savedSourceTable === undefined ? true : savedSourceTable.selectedForMigration;
						const tableInfo: TableInfo = {
							databaseName: table.databaseName,
							rowCount: table.rowCount,
							selectedForMigration: isSelected,
							tableName: table.tableName,
						};
						this._tableSelectionMap.set(table.tableName, tableInfo);
					}
				});

				this._missingTableCount = this._missingTableSelectionMap.size;
				if (this._tableSelectionMap.size === 0) {
					// Full schema missing on the target
					await this._schemaMigrationInfoBox.updateProperties(<azdata.InfoBoxComponentProperties>{
						text: constants.FULL_SCHEMA_MISSING_ON_TARGET,
						style: "warning",
						width: '600px',
						CSSStyles: { ...styles.BODY_CSS, 'margin': '5px 0 0 0' },
						isClickable: true
					});
				} else if (this._missingTableSelectionMap.size > 0) {
					// Partial schema found on the target
					await this._schemaMigrationInfoBox.updateProperties(<azdata.InfoBoxComponentProperties>{
						text: constants.PARTIAL_SCHEMA_ON_TARGET,
						style: "warning",
						width: '600px',
						CSSStyles: { ...styles.BODY_CSS, 'margin': '5px 0 0 0' },
						isClickable: true
					});
				} else {
					// Full schema found on the target
					this._schemaMigrationCheckBox.checked = false;
					this._schemaMigrationCheckBox.enabled = false;
					await this._schemaMigrationInfoBox.updateProperties(<azdata.InfoBoxComponentProperties>{
						text: constants.FULL_SCHEMA_ON_TARGET,
						style: "information",
						width: '600px',
						CSSStyles: { ...styles.BODY_CSS, 'margin': '5px 0 0 0' },
						isClickable: false
					});
				}
			}

			this._dialog!.message = { text: '', level: azdata.window.MessageLevel.Information };
		} catch (error) {
			this._dialog!.message = {
				text: constants.DATABASE_TABLE_CONNECTION_ERROR,
				description: constants.DATABASE_TABLE_CONNECTION_ERROR_MESSAGE(error.message),
				level: azdata.window.MessageLevel.Error
			};
		} finally {
			this._refreshLoader.loading = false;
			await updateControlDisplay(this._tableSelectionTable, true, 'flex');
			await updateControlDisplay(this._missingTargetTablesTable, true, 'flex');
			await this._loadControls();
		}
	}

	private async _createMigrationContainer(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		// Schema migration components
		const schemaMigrationHeader = view.modelBuilder.text()
			.withProps({
				value: "Schema migration",
				requiredIndicator: true,
				CSSStyles: { ...styles.SECTION_HEADER_CSS, 'margin-top': '4px' }
			}).component();

		this._schemaMigrationCheckBox = view.modelBuilder.checkBox()
			.withProps({
				checked: false,
				label: "Migrate schema to target",
			}).component();

		this._schemaMigrationInfoBox = view.modelBuilder.infoBox()
			.withProps({
				text: '',
				style: "information",
				width: '40px',
				CSSStyles: { ...styles.BODY_CSS, 'margin': '5px 0 0 0' },
			}).component();

		this._disposables.push(
			this._schemaMigrationCheckBox.onChanged(
				async checked => {
					const targetDatabaseInfo = this._model._sourceTargetMapping.get(this._sourceDatabaseName);
					if (targetDatabaseInfo) {
						targetDatabaseInfo.enableSchemaMigration = checked;
						const missingData: any[][] = [];
						const selectedItems: number[] = [];
						let tableRow = 0;
						this._missingTableSelectionMap.forEach(sourceTable => {
							sourceTable.selectedForMigration = checked;
							const tableRowCount = sourceTable?.rowCount ?? 0;
							const tableStatus = tableRowCount > 0
								? constants.TARGET_TABLE_NOT_EMPTY
								: '--';
							missingData.push([
								sourceTable.selectedForMigration,
								sourceTable.tableName,
								tableStatus
							]);
							if (sourceTable.selectedForMigration) {
								selectedItems.push(tableRow);
							}
							tableRow++;
						});

						await this._missingTargetTablesTable.updateProperty('data', missingData);
						this._missingTargetTablesTable.selectedRows = selectedItems;
						this._updateRowSelection();
					}
				}
			)
		)

		// Data migration component
		const dataMigrationHeader = view.modelBuilder.text()
			.withProps({
				description: constants.DATA_MIGRATION_INFO,
				value: "Data migration",
				requiredIndicator: true,
				CSSStyles: { ...styles.SECTION_HEADER_CSS, 'margin-top': '4px' }
			}).component();

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

		return view.modelBuilder
			.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([schemaMigrationHeader, this._schemaMigrationCheckBox, this._schemaMigrationInfoBox, dataMigrationHeader, this._tabs])
			.component();
	}

	private async _loadControls(): Promise<void> {
		const data: any[][] = [];
		const missingData: any[][] = [];
		const filterText = this._filterInputBox.value ?? '';
		const selectedItems: number[] = [];
		const missingSelectedItems: number[] = [];
		let tableRow = 0;
		let missingTableRow = 0;

		this._tableSelectionMap.forEach(sourceTable => {
			const tableName = sourceTable.tableName.toLocaleLowerCase();
			const searchText = filterText.toLocaleLowerCase();
			if (filterText?.length === 0 || tableName.indexOf(searchText) > -1) {
				const targetTable = this._targetTableMap.get(sourceTable.tableName);
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
			}
		});

		this._missingTableSelectionMap.forEach(sourceTable => {
			const tableRowCount = sourceTable?.rowCount ?? 0;
			const tableStatus = tableRowCount > 0
				? constants.TARGET_TABLE_NOT_EMPTY
				: '--';
			missingData.push([
				sourceTable.selectedForMigration,
				sourceTable.tableName,
				tableStatus]);
			if (sourceTable.selectedForMigration) {
				missingSelectedItems.push(missingTableRow);
			}
			missingTableRow++;
		});

		await this._tableSelectionTable.updateProperty('data', data);
		this._tableSelectionTable.selectedRows = selectedItems;
		await this._missingTargetTablesTable.updateProperty('data', missingData);
		this._missingTargetTablesTable.selectedRows = missingSelectedItems;

		this._updateRowSelection();
		if (this._missingTableCount > 0 && this._tabs.items.length === 1) {
			this._tabs.updateTabs([this._selectableTablesTab, this._missingTablesTab]);
		}
	}

	private async _initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		dialog.registerContent(async (view: azdata.ModelView) => {
			dialog.okButton.label = constants.TABLE_SELECTION_UPDATE_BUTTON;
			dialog.okButton.position = 'left';
			this._disposables.push(
				dialog.okButton.onClick(
					async () => this._save()));

			dialog.cancelButton.label = constants.TABLE_SELECTION_CANCEL_BUTTON;
			dialog.cancelButton.position = 'left';
			this._disposables.push(
				dialog.cancelButton.onClick(
					async () => this._isOpen = false));
			const flexContainer = view.modelBuilder
				.flexContainer()
				.withItems([
					await this._createMigrationContainer(view)])
				.withProps({ CSSStyles: { 'padding': '20px' } })
				.component();
			await view.initializeModel(flexContainer);
			await this._loadData();
		});
	}

	public async openDialog(dialogTitle: string) {
		if (!this._isOpen) {
			this._isOpen = true;
			this._dialog = azdata.window.createModelViewDialog(
				dialogTitle,
				DialogName,
				600, undefined, undefined, false);

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

		this._tableSelectionTable = this._createSelectionTable(view);

		const flex = view.modelBuilder.flexContainer()
			.withItems([
				flexTopRow,
				this._headingText,
				this._tableSelectionTable],
				{ flex: '0 0 auto' })
			.withProps({ CSSStyles: { 'margin': '10px 0 0 15px' } })
			.withLayout({
				flexFlow: 'column',
				height: '100%',
				width: 550,
			}).component();

		this._selectableTablesTab = {
			content: flex,
			id: 'tableSelectionTab',
			title: constants.AVAILABLE_TABLE_COUNT_ON_TARGET(0),
		};
	}

	private async _createMissingTablesTab(view: azdata.ModelView): Promise<void> {
		this._missingTargetTablesTable = this._createMissingTablesTable(view);

		const flex = view.modelBuilder.flexContainer()
			.withItems(
				[this._missingTargetTablesTable],
				{ flex: '0 0 auto' })
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

	private _createSelectionTable(view: azdata.ModelView): azdata.TableComponent {
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
					if (selectedRows.length === 0) {
						this._tableSelectionMap.forEach(sourceTable => {
							sourceTable.selectedForMigration = false;
							this._tableSelectionMap.set(sourceTable.tableName, sourceTable);
						})
					} else {
						selectedRows.forEach(rowIndex => {
							// get selected source table name
							const rowData = this._tableSelectionTable.data[rowIndex];
							const sourceTableName = rowData.length > 1
								? rowData[1] as string
								: '';
							// get source table info
							const sourceTableInfo = this._tableSelectionMap.get(sourceTableName);
							if (sourceTableInfo) {
								// keep source table selected
								sourceTableInfo.selectedForMigration = rowData[0] as boolean;
								// update table selection map with new selectedForMigration value
								this._tableSelectionMap.set(sourceTableName, sourceTableInfo);
							}
						});
					}

					this._updateRowSelection();
				}));

		return table;
	}

	private _createMissingTablesTable(view: azdata.ModelView): azdata.TableComponent {
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
					const selectedRows = this._missingTargetTablesTable.selectedRows ?? [];
					if (selectedRows.length === 0) {
						this._missingTableSelectionMap.forEach(sourceTable => {
							sourceTable.selectedForMigration = false;
							this._missingTableSelectionMap.set(sourceTable.tableName, sourceTable);
						})
					} else {
						selectedRows.forEach(rowIndex => {
							// get selected source table name
							const rowData = this._missingTargetTablesTable.data[rowIndex];
							const sourceTableName = rowData.length > 1
								? rowData[1] as string
								: '';
							// get source table info
							const sourceTableInfo = this._missingTableSelectionMap.get(sourceTableName);
							if (sourceTableInfo) {
								// keep source table selected
								sourceTableInfo.selectedForMigration = rowData[0] as boolean;
								// update table selection map with new selectedForMigration value
								this._missingTableSelectionMap.set(sourceTableName, sourceTableInfo);
							}
						});
					}

					this._updateRowSelection();
				}));

		return table;
	}

	private _updateRowSelection(): void {
		this._headingText.value = this._refreshLoader.loading
			? constants.DATABASE_LOADING_TABLES
			: this._tableSelectionTable.data?.length > 0
				? constants.TABLE_SELECTION_COUNT_TO_TARGET(
					this._tableSelectionTable.selectedRows?.length ?? 0,
					this._tableSelectionTable.data?.length ?? 0)
				: constants.DATABASE_MISSING_TABLES;

		this._selectableTablesTab.title = constants.AVAILABLE_TABLE_COUNT_ON_TARGET(this._tableSelectionMap?.size ?? 0);
		this._missingTablesTab.title = constants.MISSING_TARGET_TABLES_COUNT(this._missingTableCount);
	}

	private async _save(): Promise<void> {
		const targetDatabaseInfo = this._model._sourceTargetMapping.get(this._sourceDatabaseName);
		if (targetDatabaseInfo) {
			// collect table list for migration
			this._tableSelectionMap.forEach(sourcetable => {
				targetDatabaseInfo.sourceTables.set(sourcetable.tableName, sourcetable);
			})

			this._missingTableSelectionMap.forEach(sourceTable => {
				targetDatabaseInfo.sourceTables.set(sourceTable.tableName, sourceTable);
			})

			this._model._sourceTargetMapping.set(this._sourceDatabaseName, targetDatabaseInfo);
		}
		await this._onSaveCallback();
		this._isOpen = false;
	}
}
