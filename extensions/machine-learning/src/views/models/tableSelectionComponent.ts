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
	preSelected: boolean
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
	public registerComponent(modelBuilder: azdata.ModelBuilder, databaseTitle: string, tableTitle: string): azdata.Component {
		this._databases = modelBuilder.dropDown().withProperties({
			width: this.componentMaxLength,
		}).component();
		this._tables = modelBuilder.dropDown().withProperties({
			width: this.componentMaxLength - 10,
		}).component();

		this._databases.onValueChanged(async () => {
			await this.onDatabaseSelected();
		});

		const existingTableButton = modelBuilder.radioButton().withProperties({
			name: 'tableName',
			value: 'existing',
			label: 'Existing table',
			checked: true
		}).component();
		const newTableButton = modelBuilder.radioButton().withProperties({
			name: 'tableName',
			value: 'new',
			label: 'New table',
			checked: false
		}).component();
		const newTableName = modelBuilder.inputBox().withProperties({
			width: this.componentMaxLength - 10,
			enabled: false
		}).component();
		const group = modelBuilder.groupContainer().withItems([
			existingTableButton,
			this._tables,
			newTableButton,
			newTableName
		], {
			CSSStyles: {
				'padding-top': '5px'
			}
		}).component();

		existingTableButton.onDidClick(() => {
			if (this._tables) {
				this._tables.enabled = existingTableButton.checked;
			}
			newTableName.enabled = !existingTableButton.checked;
			this._existingTablesSelected = existingTableButton.checked || false;
		});
		newTableButton.onDidClick(() => {
			if (this._tables) {
				this._tables.enabled = !newTableButton.checked;
			}
			newTableName.enabled = newTableButton.checked;
			this._existingTablesSelected = existingTableButton.checked || false;
		});
		newTableName.onTextChanged(async () => {
			this._selectedTableName = newTableName.value || '';
			await this.onTableSelected();
		});

		this._tables.onValueChanged(async (value) => {
			// There's an issue with dropdown doesn't set the value in editable mode. this is the workaround

			if (this._tables && value) {
				this._selectedTableName = value.selected;
			}
			await this.onTableSelected();
		});

		const databaseForm = modelBuilder.formContainer().withFormItems([{
			title: databaseTitle,
			component: this._databases,
		}], { info: databaseTitle }).withLayout({
			padding: '0px'
		}).component();

		const tableForm = modelBuilder.formContainer();
		if (this._settings.editable) {
			tableForm.addFormItem({
				title: tableTitle,
				component: group
			}, { info: tableTitle });
		} else {
			tableForm.addFormItem({
				title: tableTitle,
				component: this._tables
			}, { info: tableTitle });
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
		if (!this._settings.preSelected && !this._dbNames.find(x => x === constants.selectDatabaseTitle)) {
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
		if (this._existingTablesSelected) {
			this._tableNames = await this.listTableNames(this.databaseName || '');
			let tableNames = this._tableNames;

			if (this._tableNames && !this._settings.preSelected && !this._tableNames.find(x => x.tableName === constants.selectTableTitle)) {
				const firstRow: DatabaseTable = { tableName: constants.selectTableTitle, databaseName: '', schema: '' };
				tableNames = [firstRow].concat(this._tableNames);
			}

			if (this._tables && tableNames && tableNames.length > 0) {
				this._tables.values = tableNames.map(t => this.getTableFullName(t));
				if (this.importTable) {
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
		}
		await this.onTableSelected();
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
