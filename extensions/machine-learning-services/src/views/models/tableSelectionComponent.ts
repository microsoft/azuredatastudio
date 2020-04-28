/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ModelViewBase } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';
import { IDataComponent } from '../interfaces';
import { DatabaseTable } from '../../prediction/interfaces';

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
	public readonly onSelectedChanged: vscode.Event<void> = this._onSelectedChanged.event;

	/**
	 * Creates a new view
	 */
	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase, private _editable: boolean) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 * Register components
	 * @param modelBuilder model builder
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this._databases = modelBuilder.dropDown().withProperties({
			width: this.componentMaxLength,
			editable: this._editable,
			fireOnTextChange: this._editable
		}).component();
		this._tables = modelBuilder.dropDown().withProperties({
			width: this.componentMaxLength,
			editable: this._editable,
			fireOnTextChange: this._editable
		}).component();

		this._databases.onValueChanged(async () => {
			await this.onDatabaseSelected();
		});

		this._tables.onValueChanged(async (value) => {
			// There's an issue with dropdown doesn't set the value in editable mode. this is the workaround

			if (this._tables && value) {
				this._selectedTableName = this._editable ? value : value.selected;
			}
			await this.onTableSelected();
		});

		const databaseForm = modelBuilder.formContainer().withFormItems([{
			title: constants.columnDatabase,
			component: this._databases,
		}]).withLayout({
			padding: '0px'
		}).component();
		const tableForm = modelBuilder.formContainer().withFormItems([{
			title: constants.columnTable,
			component: this._tables
		}]).withLayout({
			padding: '0px'
		}).component();
		this._dbTableComponent = modelBuilder.flexContainer().withItems([
			databaseForm,
			tableForm
		], {
			flex: '0 0 auto',
			CSSStyles: {
				'align-items': 'flex-start'
			}
		}).withLayout({
			flexFlow: 'row',
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
		if (this._databases && this._tables) {
			formBuilder.addFormItems([{
				title: constants.databaseName,
				component: this._databases
			}, {
				title: constants.tableName,
				component: this._tables
			}]);
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._databases && this._tables) {
			formBuilder.removeFormItem({
				title: constants.databaseName,
				component: this._databases
			});
			formBuilder.removeFormItem({
				title: constants.tableName,
				component: this._tables
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
		if (this._databases && this._dbNames && this._dbNames.length > 0) {
			this._databases.values = this._dbNames;
			if (this.importTable) {
				this._databases.value = this.importTable.databaseName;
			} else {
				this._databases.value = this._dbNames[0];
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
		if (this._tables && this._tableNames && this._tableNames.length > 0) {
			this._tables.values = this._tableNames.map(t => this.getTableFullName(t));
			if (this.importTable) {
				const selectedTable = this._tableNames.find(t => t.tableName === this.importTable?.tableName && t.schema === this.importTable?.schema);
				if (selectedTable) {
					this._selectedTableName = this.getTableFullName(selectedTable);
					this._tables.value = this.getTableFullName(selectedTable);
				} else {
					this._selectedTableName = this._editable ? this.getTableFullName(this.importTable) : this.getTableFullName(this._tableNames[0]);
				}
			} else {
				this._selectedTableName = this.getTableFullName(this._tableNames[0]);
			}
			this._tables.value = this._selectedTableName;
		} else if (this._tables) {
			this._tables.values = [];
			this._tables.value = '';
		}
		await this.onTableSelected();
	}

	private getTableFullName(table: DatabaseTable): string {
		return `${table.schema}.${table.tableName}`;
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
