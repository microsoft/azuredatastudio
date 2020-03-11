/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../../common/constants';
import { ModelViewBase } from '../modelViewBase';
import { ApiWrapper } from '../../../common/apiWrapper';
import { IDataComponent } from '../../interfaces';
import { PredictColumn, DatabaseTable, TableColumn } from '../../../prediction/interfaces';
import { ModelParameter, ModelParameters } from '../../../modelManagement/interfaces';

/**
 * View to render azure models in a table
 */
export class ColumnsTable extends ModelViewBase implements IDataComponent<PredictColumn[]> {

	private _table: azdata.DeclarativeTableComponent | undefined;
	private _parameters: PredictColumn[] = [];
	private _loader: azdata.LoadingComponent;
	private _dataTypes: string[] = [
		'int',
		'nvarchar(MAX)',
		'varchar(MAX)',
		'float',
		'double',
		'bit'
	];


	/**
	 * Creates a view to render azure models in a table
	 */
	constructor(apiWrapper: ApiWrapper, private _modelBuilder: azdata.ModelBuilder, parent: ModelViewBase, private _forInput: boolean = true) {
		super(apiWrapper, parent.root, parent);
		this._loader = this.registerComponent(this._modelBuilder);
	}

	/**
	 * Register components
	 * @param modelBuilder model builder
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.LoadingComponent {
		this._table = modelBuilder.declarativeTable()
			.withProperties<azdata.DeclarativeTableProperties>(
				{
					columns: [
						{ // Name
							displayName: this._forInput ? constants.inputName : constants.outputName,
							ariaLabel: this._forInput ? constants.inputName : constants.outputName,
							valueType: azdata.DeclarativeDataType.string,
							isReadOnly: true,
							width: 120,
							headerCssStyles: {
								...constants.cssStyles.tableHeader
							},
							rowCssStyles: {
								...constants.cssStyles.tableRow
							},
						},
						{ // Action
							displayName: this._forInput ? constants.columnName : constants.dataTypeName,
							ariaLabel: this._forInput ? constants.columnName : constants.dataTypeName,
							valueType: azdata.DeclarativeDataType.component,
							isReadOnly: true,
							width: 50,
							headerCssStyles: {
								...constants.cssStyles.tableHeader
							},
							rowCssStyles: {
								...constants.cssStyles.tableRow
							},
						}
					],
					data: [],
					ariaLabel: constants.mlsConfigTitle
				})
			.component();
		this._loader = modelBuilder.loadingComponent()
			.withItem(this._table)
			.withProperties({
				loading: true
			}).component();
		return this._loader;
	}

	public async onLoading(): Promise<void> {
		if (this._loader) {
			await this._loader.updateProperties({ loading: true });
		}
	}

	public async onLoaded(): Promise<void> {
		if (this._loader) {
			await this._loader.updateProperties({ loading: false });
		}
	}

	public get component(): azdata.Component {
		return this._loader;
	}

	/**
	 * Load data in the component
	 * @param workspaceResource Azure workspace
	 */
	public async loadInputs(modelParameters: ModelParameters | undefined, table: DatabaseTable): Promise<void> {
		this.onLoading();
		this._parameters = [];
		let tableData: any[][] = [];

		if (this._table) {
			if (this._forInput) {
				const columns = await this.listColumnNames(table);
				if (modelParameters?.inputs && columns) {
					tableData = tableData.concat(modelParameters.inputs.map(input => this.createInputTableRow(input, columns)));
				}
			}

			this._table.data = tableData;
		}
		this.onLoaded();
	}

	public async loadOutputs(modelParameters: ModelParameters | undefined): Promise<void> {
		this.onLoading();
		this._parameters = [];
		let tableData: any[][] = [];

		if (this._table) {
			if (!this._forInput) {
				if (modelParameters?.outputs && this._dataTypes) {
					tableData = tableData.concat(modelParameters.outputs.map(output => this.createOutputTableRow(output, this._dataTypes)));
				}
			}

			this._table.data = tableData;
		}
		this.onLoaded();
	}

	private createOutputTableRow(modelParameter: ModelParameter, dataTypes: string[]): any[] {
		if (this._modelBuilder) {

			let nameInput = this._modelBuilder.dropDown().withProperties({
				values: dataTypes,
				width: 150
			}).component();
			const name = modelParameter.name;
			const dataType = dataTypes.find(x => x === modelParameter.type);
			if (dataType) {
				nameInput.value = dataType;
			}
			this._parameters.push({ columnName: name, paramName: name, dataType: modelParameter.type });

			nameInput.onValueChanged(() => {
				const value = <string>nameInput.value;
				if (value !== modelParameter.type) {
					let selectedRow = this._parameters.find(x => x.paramName === name);
					if (selectedRow) {
						selectedRow.dataType = value;
					}
				}
			});
			return [`${name}(${modelParameter.type})`, nameInput];
		}

		return [];
	}

	private createInputTableRow(modelParameter: ModelParameter, columns: TableColumn[] | undefined): any[] {
		if (this._modelBuilder && columns) {
			const values = columns.map(c => { return { name: c.columnName, displayName: `${c.columnName}(${c.dataType})` }; });
			let nameInput = this._modelBuilder.dropDown().withProperties({
				values: values,
				width: 150
			}).component();
			const name = modelParameter.name;
			const column = values.find(x => x.name === modelParameter.name);
			if (column) {
				nameInput.value = column;
			}
			this._parameters.push({ columnName: name, paramName: name });

			nameInput.onValueChanged(() => {
				const selectedColumn = nameInput.value;
				const value = selectedColumn ? (<azdata.CategoryValue>selectedColumn).name : undefined;
				if (value !== name) {
					let selectedRow = this._parameters.find(x => x.paramName === name);
					if (selectedRow) {
						selectedRow.columnName = value || '';
					}
				}
			});
			return [`${name}(${modelParameter.type})`, nameInput];
		}

		return [];
	}

	/**
	 * Returns selected data
	 */
	public get data(): PredictColumn[] | undefined {
		return this._parameters;
	}

	/**
	 * Refreshes the view
	 */
	public async refresh(): Promise<void> {
	}
}
