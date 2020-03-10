/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase } from '../modelViewBase';
import { ApiWrapper } from '../../../common/apiWrapper';
import * as constants from '../../../common/constants';
import { IDataComponent } from '../../interfaces';
import { ColumnsTable } from './columnsTable';
import { PredictColumn, PredictInputParameters, DatabaseTable } from '../../../prediction/interfaces';

/**
 * View to render filters to pick an azure resource
 */
export class ColumnsFilterComponent extends ModelViewBase implements IDataComponent<PredictInputParameters> {

	private _form: azdata.FormContainer | undefined;
	private _databases: azdata.DropDownComponent | undefined;
	private _tables: azdata.DropDownComponent | undefined;
	private _columns: ColumnsTable | undefined;
	private _dbNames: string[] = [];
	private _tableNames: DatabaseTable[] = [];

	/**
	 * Creates a new view
	 */
	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 * Register components
	 * @param modelBuilder model builder
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this._databases = modelBuilder.dropDown().withProperties({
			width: this.componentMaxLength
		}).component();
		this._tables = modelBuilder.dropDown().withProperties({
			width: this.componentMaxLength
		}).component();
		this._columns = new ColumnsTable(this._apiWrapper, modelBuilder, this);

		this._databases.onValueChanged(async () => {
			await this.onDatabaseSelected();
		});

		this._tables.onValueChanged(async () => {
			await this.onTableSelected();
		});


		this._form = modelBuilder.formContainer().withFormItems([{
			title: constants.azureAccount,
			component: this._databases
		}, {
			title: constants.azureSubscription,
			component: this._tables
		}, {
			title: constants.azureGroup,
			component: this._columns.component
		}]).component();
		return this._form;
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this._databases && this._tables && this._columns) {
			formBuilder.addFormItems([{
				title: constants.columnDatabase,
				component: this._databases
			}, {
				title: constants.columnTable,
				component: this._tables
			}, {
				title: constants.inputColumns,
				component: this._columns.component
			}]);
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._databases && this._tables && this._columns) {
			formBuilder.removeFormItem({
				title: constants.azureAccount,
				component: this._databases
			});
			formBuilder.removeFormItem({
				title: constants.azureSubscription,
				component: this._tables
			});
			formBuilder.removeFormItem({
				title: constants.azureGroup,
				component: this._columns.component
			});
		}
	}

	/**
	 * Returns the created component
	 */
	public get component(): azdata.Component | undefined {
		return this._form;
	}

	/**
	 * Returns selected data
	 */
	public get data(): PredictInputParameters | undefined {
		return Object.assign({}, this.databaseTable, {
			inputColumns: this.columnNames
		});
	}

	/**
	 * loads data in the components
	 */
	public async loadData(): Promise<void> {
		this._dbNames = await this.listDatabaseNames();
		if (this._databases && this._dbNames && this._dbNames.length > 0) {
			this._databases.values = this._dbNames;
			this._databases.value = this._dbNames[0];
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
			this._tables.value = this.getTableFullName(this._tableNames[0]);
		}
		await this.onTableSelected();
	}

	private getTableFullName(table: DatabaseTable): string {
		return `${table.schema}.${table.tableName}`;
	}

	private async onTableSelected(): Promise<void> {
		this._columns?.loadData(this.databaseTable);
	}

	private get databaseName(): string | undefined {
		return <string>this._databases?.value;
	}

	private get databaseTable(): DatabaseTable {
		let selectedItem = this._tableNames.find(x => this.getTableFullName(x) === this._tables?.value);
		return {
			databaseName: this.databaseName,
			tableName: selectedItem?.tableName,
			schema: selectedItem?.schema
		};
	}

	private get columnNames(): PredictColumn[] | undefined {
		return this._columns?.data;
	}
}
