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
import { TableSelectionComponent } from '../tableSelectionComponent';

/**
 * View to render filters to pick an azure resource
 */
export class InputColumnsComponent extends ModelViewBase implements IDataComponent<PredictInputParameters> {

	private _form: azdata.FormContainer | undefined;
	private _tableSelectionComponent: TableSelectionComponent | undefined;
	private _columns: ColumnsTable | undefined;
	private _modelParameters: ModelParameters | undefined;

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
		this._tableSelectionComponent = new TableSelectionComponent(this._apiWrapper, this,
			{
				editable: false,
				preSelected: false,
				databaseTitle: constants.columnDatabase,
				tableTitle: constants.columnTable,
				databaseInfo: constants.columnDatabaseInfo,
				tableInfo: constants.columnTableInfo
			});
		this._tableSelectionComponent.registerComponent(modelBuilder);
		this._tableSelectionComponent.onSelectedChanged(async () => {
			await this.onTableSelected();
		});

		this._columns = new ColumnsTable(this._apiWrapper, modelBuilder, this);

		this._form = modelBuilder.formContainer().withFormItems([{
			title: constants.inputColumns,
			component: this._columns.component
		}]).component();
		return this._form;
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this._columns && this._tableSelectionComponent && this._tableSelectionComponent.component) {
			formBuilder.addFormItems([{
				title: '',
				component: this._tableSelectionComponent.component
			}, {
				title: constants.inputColumns,
				component: this._columns.component
			}]);
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._columns && this._tableSelectionComponent && this._tableSelectionComponent.component) {
			formBuilder.removeFormItem({
				title: '',
				component: this._tableSelectionComponent.component
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
		if (this._tableSelectionComponent) {
			this._tableSelectionComponent.refresh();
		}
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

	private async onTableSelected(): Promise<void> {
		this._columns?.loadInputs(this._modelParameters, this.databaseTable);
	}

	private get databaseTable(): DatabaseTable {
		let selectedItem = this._tableSelectionComponent?.data;
		return {
			databaseName: selectedItem?.databaseName,
			tableName: selectedItem?.tableName,
			schema: selectedItem?.schema
		};
	}

	private get columnNames(): PredictColumn[] | undefined {
		return this._columns?.data;
	}
}
