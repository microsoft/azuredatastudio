/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase } from '../modelViewBase';
import { ApiWrapper } from '../../../common/apiWrapper';
import * as constants from '../../../common/constants';
import { IDataComponent } from '../../interfaces';
import { PredictColumn, PredictInputParameters, DatabaseTable } from '../../../prediction/interfaces';
import { ModelParameters } from '../../../modelManagement/interfaces';
import { ColumnsTable } from './columnsTable';

/**
 * View to render filters to pick an azure resource
 */
export class InputColumnsComponent extends ModelViewBase implements IDataComponent<PredictInputParameters> {

	private _form: azdata.FormContainer | undefined;
	private _databases: azdata.DropDownComponent | undefined;
	private _tables: azdata.DropDownComponent | undefined;
	private _columns: ColumnsTable | undefined;
	private _dbNames: string[] = [];
	private _tableNames: DatabaseTable[] = [];
	private _modelParameters: ModelParameters | undefined;
	private _dbTableComponent: azdata.FlexContainer | undefined;
	private tableMaxLength = this.componentMaxLength * 2 + 70;
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


		const databaseForm = modelBuilder.formContainer().withFormItems([{
			title: constants.columnDatabase,
			component: this._databases
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
		}, {
			title: constants.inputColumns,
			component: this._columns.component
		}]).component();
		return this._form;
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this._columns && this._dbTableComponent) {
			formBuilder.addFormItems([{
				title: '',
				component: this._dbTableComponent
			}, {
				title: constants.inputColumns,
				component: this._columns.component
			}]);
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._columns && this._dbTableComponent) {
			formBuilder.removeFormItem({
				title: '',
				component: this._dbTableComponent
			});
			formBuilder.removeFormItem({
				title: constants.inputColumns,
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

	public set modelParameters(value: ModelParameters) {
		this._modelParameters = value;
	}

	public async onLoading(): Promise<void> {
		if (this._columns) {
			await this._columns.onLoading();
		}
	}

	public async onLoaded(): Promise<void> {
		if (this._columns) {
			await this._columns.onLoaded();
		}
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
		this._columns?.loadInputs(this._modelParameters, this.databaseTable);
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
