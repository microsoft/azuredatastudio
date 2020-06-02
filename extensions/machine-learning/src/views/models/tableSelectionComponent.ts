/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ModelViewBase } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import { IDataComponent } from '../interfaces';
import { DatabaseTable } from '../../prediction/interfaces';
import * as constants from '../../common/constants';

export interface ITableSelectionSettings {
	editable: boolean,
	preSelected: boolean,
	databaseTitle: string,
	tableTitle: string,
	databaseInfo: string,
	tableInfo: string
}
/**
 * View to render filters to pick an azure resource
 */
export class TableSelectionComponent extends ModelViewBase implements IDataComponent<DatabaseTable> {

	private _form: azdata.FormContainer | undefined;
	private _databases: azdata.DropDownComponent | undefined;
	private _selectedTableName: string = '';
	private _tables: azdata.DropDownComponent | undefined;
	private _dbNames: string[] = [];
	private _tableNames: DatabaseTable[] = [];
	private _dbTableComponent: azdata.FlexContainer | undefined;
	private tableMaxLength = this.componentMaxLength * 2 + 70;
	private _onSelectedChanged: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	private _existingTableButton: azdata.RadioButtonComponent | undefined;
	private _newTableButton: azdata.RadioButtonComponent | undefined;
	private _newTableName: azdata.InputBoxComponent | undefined;
	private _existingTablesSelected: boolean = true;

	public readonly onSelectedChanged: vscode.Event<void> = this._onSelectedChanged.event;

	/**
	 * Creates a new view
	 */
	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase, private _settings: ITableSelectionSettings) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 * Register components
	 * @param modelBuilder model builder
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this._databases = modelBuilder.dropDown().withProperties({
			width: this.componentMaxLength,
		}).component();
		this._tables = modelBuilder.dropDown().withProperties({
			width: this.componentMaxLength - 10,
		}).component();

		this._databases.onValueChanged(async () => {
			await this.onDatabaseSelected();
		});

		this._existingTableButton = modelBuilder.radioButton().withProperties({
			name: 'tableName',
			value: 'existing',
			label: 'Existing table',
			checked: true
		}).component();
		this._newTableButton = modelBuilder.radioButton().withProperties({
			name: 'tableName',
			value: 'new',
			label: 'New table',
			checked: false
		}).component();
		this._newTableName = modelBuilder.inputBox().withProperties({
			width: this.componentMaxLength - 10,
			enabled: false
		}).component();
		const group = modelBuilder.groupContainer().withItems([
			this._existingTableButton,
			this._tables,
			this._newTableButton,
			this._newTableName
		], {
			CSSStyles: {
				'padding-top': '5px'
			}
		}).component();

		this._existingTableButton.onDidClick(() => {
			this._existingTablesSelected = true;
			this.refreshTableComponent();
		});
		this._newTableButton.onDidClick(() => {
			this._existingTablesSelected = false;
			this.refreshTableComponent();
		});
		this._newTableName.onTextChanged(async () => {
			if (this._newTableName) {
				this._selectedTableName = this._newTableName.value || '';
				await this.onTableSelected();
			}
		});

		this._tables.onValueChanged(async (value) => {
			// There's an issue with dropdown doesn't set the value in editable mode. this is the workaround

			if (this._tables && value) {
				this._selectedTableName = value.selected;
			}
			await this.onTableSelected();
		});

		const databaseForm = modelBuilder.formContainer().withFormItems([{
			title: this._settings.databaseTitle,
			component: this._databases,
		}], { info: this._settings.databaseInfo }).withLayout({
			padding: '0px'
		}).component();

		const tableForm = modelBuilder.formContainer();
		if (this._settings.editable) {
			tableForm.addFormItem({
				title: this._settings.tableTitle,
				component: group
			}, { info: this._settings.tableInfo });
		} else {
			tableForm.addFormItem({
				title: this._settings.tableTitle,
				component: this._tables
			}, { info: this._settings.tableInfo });
		}

		this._dbTableComponent = modelBuilder.flexContainer().withItems([
			databaseForm,
			tableForm.withLayout({
				padding: '0px'
			}).component()
		], {
			flex: '0 0 auto',
			CSSStyles: {
				'align-items': 'flex-start'
			}
		}).withLayout({
			flexFlow: this._settings.editable ? 'column' : 'row',
			justifyContent: 'space-between',
			width: this.tableMaxLength
		}).component();

		this._form = modelBuilder.formContainer().withFormItems([{
			title: '',
			component: this._dbTableComponent
		}]).component();
		return this._form;
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this._dbTableComponent) {
			formBuilder.addFormItems([{
				title: '',
				component: this._dbTableComponent
			}]);
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._dbTableComponent) {
			formBuilder.removeFormItem({
				title: '',
				component: this._dbTableComponent
			});

		}
	}

	/**
	 * Returns the created component
	 */
	public get component(): azdata.Component | undefined {
		return this._dbTableComponent;
	}

	/**
	 * Returns selected data
	 */
	public get data(): DatabaseTable | undefined {
		return this.databaseTable;
	}

	/**
	 * loads data in the components
	 */
	public async loadData(): Promise<void> {
		this._dbNames = await this.listDatabaseNames();
		let dbNames = this._dbNames;
		if (!this._dbNames.find(x => x === constants.selectDatabaseTitle)) {
			dbNames = [constants.selectDatabaseTitle].concat(this._dbNames);
		}
		if (this._databases && dbNames && dbNames.length > 0) {
			this._databases.values = dbNames;

			if (this.importTable && this._settings.preSelected) {
				this._databases.value = this.importTable.databaseName;
			} else {
				this._databases.value = dbNames[0];
			}

		}
		await this.onDatabaseSelected();
	}

	/**
	 * refreshes the view
	 */
	public async refresh(): Promise<void> {
		await this.loadData();
	}

	private async onDatabaseSelected(): Promise<void> {
		this._tableNames = await this.listTableNames(this.databaseName || '');
		let tableNames = this._tableNames;
		if (this._settings.editable && this._tables && this._existingTableButton && this._newTableButton && this._newTableName) {
			this._existingTablesSelected = this._tableNames !== undefined && this._tableNames.length > 0;
			this._newTableButton.checked = !this._existingTablesSelected;
			this._existingTableButton.checked = this._existingTablesSelected;
		}
		this.refreshTableComponent();


		if (this._tableNames && !this._tableNames.find(x => x.tableName === constants.selectTableTitle)) {
			const firstRow: DatabaseTable = { tableName: constants.selectTableTitle, databaseName: '', schema: '' };
			tableNames = [firstRow].concat(this._tableNames);
		}

		if (this._tables && tableNames && tableNames.length > 0) {
			this._tables.values = tableNames.map(t => this.getTableFullName(t));
			if (this.importTable && this.importTable.databaseName === this._databases?.value) {
				const selectedTable = tableNames.find(t => t.tableName === this.importTable?.tableName && t.schema === this.importTable?.schema);
				if (selectedTable) {
					this._selectedTableName = this.getTableFullName(selectedTable);
					this._tables.value = this.getTableFullName(selectedTable);
				} else {
					this._selectedTableName = this._settings.editable ? this.getTableFullName(this.importTable) : this.getTableFullName(tableNames[0]);
				}
			} else {
				this._selectedTableName = this.getTableFullName(tableNames[0]);
			}
			this._tables.value = this._selectedTableName;
		} else if (this._tables) {
			this._tables.values = [];
			this._tables.value = '';
		}

		await this.onTableSelected();

	}

	private refreshTableComponent(): void {
		if (this._settings.editable && this._tables && this._existingTableButton && this._newTableButton && this._newTableName) {
			this._tables.enabled = this._existingTablesSelected;
			this._newTableName.enabled = !this._existingTablesSelected;
		}
	}

	private getTableFullName(table: DatabaseTable): string {
		return table.tableName === constants.selectTableTitle ? table.tableName : `${table.schema}.${table.tableName}`;
	}

	private async onTableSelected(): Promise<void> {
		this._onSelectedChanged.fire();
	}

	private get databaseName(): string | undefined {
		return <string>this._databases?.value;
	}

	private get databaseTable(): DatabaseTable {
		let selectedItem = this._tableNames.find(x => this.getTableFullName(x) === this._selectedTableName);
		if (!selectedItem) {
			const value = this._selectedTableName;
			const parts = value ? value.split('.') : undefined;
			selectedItem = {
				databaseName: this.databaseName,
				tableName: parts && parts.length > 1 ? parts[1] : value,
				schema: parts && parts.length > 1 ? parts[0] : 'dbo',
			};
		}
		return {
			databaseName: this.databaseName,
			tableName: selectedItem?.tableName,
			schema: selectedItem?.schema
		};
	}
}
