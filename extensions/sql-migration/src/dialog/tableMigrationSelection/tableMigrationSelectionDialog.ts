/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import { AzureSqlDatabaseServer, getIrNodes, getResourceName } from '../../api/azure';
import { collectSourceDatabaseTableInfo, collectTargetDatabaseTableInfo, getActiveIrVersionsNotSupportingSchemaMigration, getActiveIrVersionsSupportingSchemaMigration, SchemaMigrationRequiredIntegrationRuntimeMinimumVersion, TableInfo } from '../../api/sqlUtils';
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
	private _dataMigrationHeader!: azdata.TextComponent;
	private _filterInputBox!: azdata.InputBoxComponent;
	private _availableTablesSelectionTable!: azdata.TableComponent;
	private _missingTablesSelectionTable!: azdata.TableComponent;
	private _unavailableSourceTablesTable!: azdata.TableComponent;
	private _refreshLoader!: azdata.LoadingComponent;
	private _disposables: vscode.Disposable[] = [];
	private _isOpen: boolean = false;
	private _model: MigrationStateModel;
	private _sourceDatabaseName: string;
	private _availableTablesSelectionMap!: Map<string, TableInfo>;
	private _missingTablesSelectionMap!: Map<string, TableInfo>;
	private _unavailableTablesMap!: Map<string, TableInfo>;
	private _targetTableMap!: Map<string, TableInfo>;
	private _onSaveCallback: () => Promise<void>;
	private _availableTableCount: number = 0;
	private _missingTableCount: number = 0;
	private _unavailableTableCount: number = 0;
	private _availableTablesTab!: Tab;
	private _missingTablesTab!: Tab;
	private _unavailableTablesTab!: Tab;
	private _tabs!: azdata.TabbedPanelComponent;
	private _hasMissingTables: boolean = false;

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
			await updateControlDisplay(this._availableTablesSelectionTable, false);
			await updateControlDisplay(this._missingTablesSelectionTable, false);
			await updateControlDisplay(this._unavailableSourceTablesTable, false);

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

				this._availableTablesSelectionMap = new Map();
				this._missingTablesSelectionMap = new Map();
				this._unavailableTablesMap = new Map();
				sourceTableList.forEach(table => {
					var sourceTable = this._targetTableMap.get(table.tableName);
					if (table.rowCount === 0) {
						// if source table row count is 0, it is unavailable to select for data migration
						// But it is still available for schema migration
						const tableInfo: TableInfo = {
							databaseName: table.databaseName,
							rowCount: table.rowCount,
							selectedForMigration: false,
							tableName: table.tableName,
						};
						this._unavailableTablesMap.set(table.tableName, tableInfo);
					} else if (sourceTable === null || sourceTable === undefined) {
						// If the source table doesn't exist in the target, it is missing table and set isSelected to false.
						const tableInfo: TableInfo = {
							databaseName: table.databaseName,
							rowCount: table.rowCount,
							selectedForMigration: false,
							tableName: table.tableName,
						};
						this._missingTablesSelectionMap.set(table.tableName, tableInfo);
					} else {
						// if source table exists in target and source table has rows, it is ready for migration
						var savedSourceTable = targetDatabaseInfo.sourceTables.get(table.tableName);
						const tableInfo: TableInfo = {
							databaseName: table.databaseName,
							rowCount: table.rowCount,
							selectedForMigration: savedSourceTable === null || savedSourceTable === undefined ? true : savedSourceTable.selectedForMigration,
							tableName: table.tableName,
						};
						this._availableTablesSelectionMap.set(table.tableName, tableInfo);
					}
				});

				this._availableTableCount = this._availableTablesSelectionMap.size;
				this._missingTableCount = this._missingTablesSelectionMap.size;
				this._unavailableTableCount = this._unavailableTablesMap.size;
				const hasMissingUnavailableTables = Array.from(this._unavailableTablesMap.values()).find(t => this._targetTableMap.get(t.tableName) === undefined) !== undefined;
				this._hasMissingTables = this._missingTableCount > 0 || hasMissingUnavailableTables;

				// Every time open the dialog, collect the latest nodes
				const irNodes = await getIrNodes(
					this._model._azureAccount,
					this._model._sqlMigrationServiceSubscription,
					getResourceName(this._model._sqlMigrationServiceResourceGroup.id),
					this._model._location.name,
					this._model._sqlMigrationService!.name);
				const irVersionsSupportingSchemaMigration = getActiveIrVersionsSupportingSchemaMigration(irNodes);
				this._model.isSchemaMigrationSupported = irVersionsSupportingSchemaMigration.length > 0;

				if (!this._model.isSchemaMigrationSupported) {
					// The current IR(s) version or Windows auth don't support schema migration
					this._schemaMigrationCheckBox.enabled = false;
					this._schemaMigrationCheckBox.checked = false;
					const irVersionsNotSupportingSchemaMigration = getActiveIrVersionsNotSupportingSchemaMigration(irNodes);
					await this._schemaMigrationInfoBox.updateProperties(<azdata.InfoBoxComponentProperties>{
						text: constants.SCHEMA_MIGRATION_UPDATE_IR_VERSION_ERROR_MESSAGE(SchemaMigrationRequiredIntegrationRuntimeMinimumVersion, irVersionsNotSupportingSchemaMigration),
						style: "warning",
						width: '600px',
						CSSStyles: { ...styles.BODY_CSS, 'margin': '5px 0 0 0' },
						isClickable: true
					});
				} else if (this._unavailableTableCount === sourceTableList.length) {
					// All of source tables are empty. No table is not available to select for data migration.
					// Check if anyone of unavailable tables exist in target. If not, it is available for schema migration.
					this._schemaMigrationCheckBox.enabled = hasMissingUnavailableTables;
					await this._schemaMigrationInfoBox.updateProperties(<azdata.InfoBoxComponentProperties>{
						text: constants.ALL_SOURCE_TABLES_EMPTY,
						style: "information",
						width: '600px',
						CSSStyles: { ...styles.BODY_CSS, 'margin': '5px 0 0 0' },
						isClickable: true
					});
				} else if (this._availableTablesSelectionMap.size === 0) {
					// Full schema missing on the target
					this._schemaMigrationCheckBox.enabled = true;
					await this._schemaMigrationInfoBox.updateProperties(<azdata.InfoBoxComponentProperties>{
						text: constants.FULL_SCHEMA_MISSING_ON_TARGET,
						style: "warning",
						width: '600px',
						CSSStyles: { ...styles.BODY_CSS, 'margin': '5px 0 0 0' },
						isClickable: true
					});
				} else if (this._missingTablesSelectionMap.size > 0 || hasMissingUnavailableTables) {
					// Partial schema found on the target
					this._schemaMigrationCheckBox.enabled = true;
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
			await this._dataMigrationHeader.updateProperty("description", constants.DATA_MIGRATION_INFO);
			await updateControlDisplay(this._availableTablesSelectionTable, true, 'flex');
			await updateControlDisplay(this._missingTablesSelectionTable, true, 'flex');
			await updateControlDisplay(this._unavailableSourceTablesTable, true, 'flex');
			await this._loadControls();
			this._updateTabs();
		}
	}

	private _updateTabs(): void {
		// Update tabs only once to avoid 'Update' button disabled.
		this._availableTablesTab.title = constants.AVAILABLE_TABLE_COUNT_ON_TARGET(this._availableTableCount);
		this._missingTablesTab.title = constants.MISSING_TARGET_TABLES_COUNT(this._missingTableCount);
		this._unavailableTablesTab.title = constants.UNAVAILABLE_SOURCE_TABLES_COUNT(this._unavailableTableCount);
		if (this._tabs.items.length === 1) {
			if (this._missingTableCount > 0 && this._unavailableTableCount > 0) {
				this._tabs.updateTabs([this._availableTablesTab, this._missingTablesTab, this._unavailableTablesTab]);
			} else if (this._missingTableCount > 0) {
				this._tabs.updateTabs([this._availableTablesTab, this._missingTablesTab]);
			} else if (this._unavailableTableCount > 0) {
				this._tabs.updateTabs([this._availableTablesTab, this._unavailableTablesTab]);
			} else {
				this._tabs.updateTabs([this._availableTablesTab]);
			}
		}
	}

	private async _createMigrationContainer(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		// Schema migration components
		const schemaMigrationHeader = view.modelBuilder.text()
			.withProps({
				value: constants.SCHEMA_MIGRATION_HEADER,
				requiredIndicator: true,
				CSSStyles: { ...styles.SECTION_HEADER_CSS, 'margin-top': '4px' }
			}).component();

		this._schemaMigrationCheckBox = view.modelBuilder.checkBox()
			.withProps({
				enabled: false,
				checked: false,
				label: constants.SCHEMA_MIGRATION_CHECKBOX_INFO,
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
						this._missingTablesSelectionMap.forEach(sourceTable => {
							sourceTable.selectedForMigration = checked;
							missingData.push([
								sourceTable.selectedForMigration,
								sourceTable.tableName,
								'--'
							]);
							if (sourceTable.selectedForMigration) {
								selectedItems.push(tableRow);
							}
							tableRow++;
						});

						await this._missingTablesSelectionTable.updateProperty('data', missingData);
						this._missingTablesSelectionTable.selectedRows = selectedItems;
						this._updateRowSelection();
					}
				}
			)
		)

		// Data migration component
		this._dataMigrationHeader = view.modelBuilder.text()
			.withProps({
				value: constants.DATA_MIGRATION_HEADER,
				requiredIndicator: true,
				CSSStyles: { ...styles.SECTION_HEADER_CSS, 'margin-top': '4px' }
			}).component();

		this._tabs = view.modelBuilder.tabbedPanel()
			.withTabs([])
			.component();

		await this._createAvailableTablesTab(view);
		await this._createMissingTablesTab(view);
		await this._createUnavailableTablesTab(view);

		this._tabs.updateTabs([this._availableTablesTab]);

		this._disposables.push(
			view.onClosed(e =>
				this._disposables.forEach(
					d => { try { d.dispose(); } catch { } })));

		return view.modelBuilder
			.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([schemaMigrationHeader, this._schemaMigrationCheckBox, this._schemaMigrationInfoBox, this._dataMigrationHeader, this._tabs])
			.component();
	}

	private async _loadControls(): Promise<void> {
		const data: any[][] = [];
		const missingData: any[][] = [];
		const unavailableData: any[][] = [];
		const filterText = this._filterInputBox.value ?? '';
		const selectedItems: number[] = [];
		const missingSelectedItems: number[] = [];
		let tableRow = 0;
		let missingTableRow = 0;

		// Available tables to select for migration
		this._availableTablesSelectionMap.forEach(sourceTable => {
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

		// Missing tables on target
		this._missingTablesSelectionMap.forEach(sourceTable => {
			const tableStatus = '--';
			missingData.push(this._model.isSchemaMigrationSupported
				? [
					sourceTable.selectedForMigration,
					sourceTable.tableName,
					tableStatus]
				: [
					sourceTable.tableName,
					tableStatus]);
			if (sourceTable.selectedForMigration) {
				missingSelectedItems.push(missingTableRow);
			}
			missingTableRow++;
		});

		// Unavailable tables to select for schema and data migration
		this._unavailableTablesMap.forEach(sourceTable => {
			const targetTable = this._targetTableMap.get(sourceTable.tableName);
			if (targetTable) {
				unavailableData.push([
					sourceTable.tableName,
					'--'
				]);
			} else {
				unavailableData.push([
					sourceTable.tableName,
					'Yes'
				])
			}
		})

		await this._availableTablesSelectionTable.updateProperty('data', data);
		this._availableTablesSelectionTable.selectedRows = selectedItems;
		await this._missingTablesSelectionTable.updateProperty('data', missingData);
		this._missingTablesSelectionTable.selectedRows = missingSelectedItems;
		await this._unavailableSourceTablesTable.updateProperty('data', unavailableData);

		this._updateRowSelection();
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

	private async _createAvailableTablesTab(view: azdata.ModelView): Promise<void> {
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

		this._availableTablesSelectionTable = this._createAvailableTablesTable(view);

		const flex = view.modelBuilder.flexContainer()
			.withItems([
				flexTopRow,
				this._headingText,
				this._availableTablesSelectionTable],
				{ flex: '0 0 auto' })
			.withProps({ CSSStyles: { 'margin': '10px 0 0 15px' } })
			.withLayout({
				flexFlow: 'column',
				height: '100%',
				width: 550,
			}).component();

		this._availableTablesTab = {
			content: flex,
			id: 'tableSelectionTab',
			title: constants.AVAILABLE_TABLE_COUNT_ON_TARGET(this._availableTableCount),
		};
	}

	private async _createMissingTablesTab(view: azdata.ModelView): Promise<void> {
		const headingText = view.modelBuilder.text()
			.withProps({ value: constants.MISSING_TABLES_HEADING })
			.component();
		this._missingTablesSelectionTable = this._createMissingTablesTable(view);

		const flex = view.modelBuilder.flexContainer()
			.withItems(
				[headingText, this._missingTablesSelectionTable],
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

	private async _createUnavailableTablesTab(view: azdata.ModelView): Promise<void> {
		const headingText = view.modelBuilder.text()
			.withProps({ value: constants.UNAVAILABLE_SOURCE_TABLES_HEADING })
			.component();
		this._unavailableSourceTablesTable = this._createUnavailableTablesTable(view);

		const flex = view.modelBuilder.flexContainer()
			.withItems(
				[headingText, this._unavailableSourceTablesTable],
				{ flex: '0 0 auto' })
			.withProps({ CSSStyles: { 'margin': '10px 0 0 15px' } })
			.withLayout({
				flexFlow: 'column',
				height: '100%',
				width: 550,
			}).component();

		this._unavailableTablesTab = {
			content: flex,
			id: 'unavailableTablesTab',
			title: constants.UNAVAILABLE_SOURCE_TABLES_COUNT(this._unavailableTableCount),
		};
	}

	private _createAvailableTablesTable(view: azdata.ModelView): azdata.TableComponent {
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
					this._updateRowSelection();
				}));

		return table;
	}

	private _createMissingTablesTable(view: azdata.ModelView): azdata.TableComponent {
		const cssClass = 'no-borders';
		const commonColumns = [{
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
		}];

		if (this._model.isSchemaMigrationSupported) {
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
						commonColumns[0],
						commonColumns[1]
					]
				})
				.withValidation(() => true)
				.component();

			this._disposables.push(
				table.onRowSelected(
					async e => {
						if (!(this._schemaMigrationCheckBox.checked ?? false) &&
							(this._missingTablesSelectionTable.selectedRows?.length ?? 0) > 0) {
							// If user selects missing table directly without selecting "Migrate schema to target" option,
							// check schema migration checkbox automatically.
							this._schemaMigrationCheckBox.checked = true;
						}
						this._updateRowSelection();
					}));

			return table;
		} else {
			return view.modelBuilder.table()
				.withProps({
					data: [],
					width: 550,
					height: '600px',
					display: 'flex',
					forceFitColumns: azdata.ColumnSizingMode.ForceFit,
					columns: [
						commonColumns[0],
						commonColumns[1]
					]
				})
				.withValidation(() => true)
				.component();
		}
	}

	private _createUnavailableTablesTable(view: azdata.ModelView): azdata.TableComponent {
		const cssClass = 'no-borders';
		const table = view.modelBuilder.table()
			.withProps({
				data: [],
				width: 550,
				height: '600px',
				display: 'flex',
				forceFitColumns: azdata.ColumnSizingMode.ForceFit,
				columns: [{
					name: constants.UNAVAILABLE_TABLE_NAME_COLUMN,
					value: 'tableName',
					type: azdata.ColumnType.text,
					cssClass: cssClass,
					headerCssClass: cssClass,
				}, {
					name: constants.NOT_EXIST_IN_TARGET_TABLE_NAME_COLUMN,
					value: 'notExistInTarget',
					type: azdata.ColumnType.text,
					cssClass: cssClass,
					headerCssClass: cssClass,
				}],
			})
			.withValidation(() => true)
			.component();

		return table;
	}

	private _updateRowSelection(): void {
		this._headingText.value = this._refreshLoader.loading
			? constants.DATABASE_LOADING_TABLES
			: this._availableTablesSelectionTable.data?.length > 0
				? constants.TABLE_SELECTION_COUNT_TO_TARGET(
					this._availableTablesSelectionTable.selectedRows?.length ?? 0,
					this._availableTablesSelectionTable.data?.length ?? 0)
				: constants.DATABASE_MISSING_TABLES;
	}

	private async _save(): Promise<void> {
		const targetDatabaseInfo = this._model._sourceTargetMapping.get(this._sourceDatabaseName);
		if (targetDatabaseInfo) {
			// Reset selectedForMigration as false
			this._availableTablesSelectionMap.forEach(sourceTable => {
				sourceTable.selectedForMigration = false;
				targetDatabaseInfo.sourceTables.set(sourceTable.tableName, sourceTable);
			})

			// Set selectedForMigration from selectedRows
			const selectedRows = this._availableTablesSelectionTable.selectedRows ?? [];
			selectedRows.forEach(rowIndex => {
				// get selected source table name
				const rowData = this._availableTablesSelectionTable.data[rowIndex];
				const sourceTableName = rowData.length > 1
					? rowData[1] as string
					: '';
				// get source table info
				const sourceTableInfo = this._availableTablesSelectionMap.get(sourceTableName);
				if (sourceTableInfo) {
					// keep source table selected
					sourceTableInfo.selectedForMigration = true;
					// update table selection map with new selectedForMigration value
					targetDatabaseInfo.sourceTables.set(sourceTableInfo.tableName, sourceTableInfo);
				}
			});

			// Reset selectedForMigration as false
			this._missingTablesSelectionMap.forEach(sourceTable => {
				sourceTable.selectedForMigration = false;
				targetDatabaseInfo.sourceTables.set(sourceTable.tableName, sourceTable);
			})

			//Set selectedForMigration from selectedRows
			const selectedRowsFromMissingTable = this._missingTablesSelectionTable.selectedRows ?? [];
			selectedRowsFromMissingTable.forEach(rowIndex => {
				// get selected source table name
				const rowData = this._missingTablesSelectionTable.data[rowIndex];
				const sourceTableName = rowData.length > 1
					? rowData[1] as string
					: '';
				// get source table info
				const sourceTableInfo = this._missingTablesSelectionMap.get(sourceTableName);
				if (sourceTableInfo) {
					// keep source table selected
					sourceTableInfo.selectedForMigration = true;
					// update table selection map with new selectedForMigration value
					targetDatabaseInfo.sourceTables.set(sourceTableInfo.tableName, sourceTableInfo);
				}
			});

			this._unavailableTablesMap.forEach(sourceTable => {
				targetDatabaseInfo.sourceTables.set(sourceTable.tableName, sourceTable);
			})

			targetDatabaseInfo.hasMissingTables = this._hasMissingTables;
			targetDatabaseInfo.enableSchemaMigration = this._schemaMigrationCheckBox.checked ?? selectedRowsFromMissingTable.length > 0;
			targetDatabaseInfo.isSchemaMigrationSupported = this._model.isSchemaMigrationSupported;
			this._model._sourceTargetMapping.set(this._sourceDatabaseName, targetDatabaseInfo);
		}
		await this._onSaveCallback();
		this._isOpen = false;
	}
}
