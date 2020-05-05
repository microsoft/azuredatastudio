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
		'bigint',
		'int',
		'smallint',
		'real',
		'float',
		'varchar(MAX)',
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
		let columnHeader: azdata.DeclarativeTableColumn[];
		if (this._forInput) {
			columnHeader = [
				{ // Action
					displayName: constants.columnName,
					ariaLabel: constants.columnName,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: 50,
					headerCssStyles: {
						...constants.cssStyles.tableHeader
					},
					rowCssStyles: {
						...constants.cssStyles.tableRow
					},
				},
				{ // Name
					displayName: '',
					ariaLabel: '',
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: 50,
					headerCssStyles: {
						...constants.cssStyles.tableHeader
					},
					rowCssStyles: {
						...constants.cssStyles.tableRow
					},
				},
				{ // Name
					displayName: constants.inputName,
					ariaLabel: constants.inputName,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: 120,
					headerCssStyles: {
						...constants.cssStyles.tableHeader
					},
					rowCssStyles: {
						...constants.cssStyles.tableRow
					},
				}
			];
		} else {
			columnHeader = [
				{ // Name
					displayName: constants.outputName,
					ariaLabel: constants.outputName,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: 200,
					headerCssStyles: {
						...constants.cssStyles.tableHeader
					},
					rowCssStyles: {
						...constants.cssStyles.tableRow
					},
				},
				{ // Action
					displayName: constants.displayName,
					ariaLabel: constants.displayName,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: 50,
					headerCssStyles: {
						...constants.cssStyles.tableHeader
					},
					rowCssStyles: {
						...constants.cssStyles.tableRow
					},
				},
				{ // Action
					displayName: constants.dataTypeName,
					ariaLabel: constants.dataTypeName,
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
			];
		}
		this._table = modelBuilder.declarativeTable()

			.withProperties<azdata.DeclarativeTableProperties>(
				{
					columns: columnHeader,
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
		await this.onLoading();
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
		await this.onLoaded();
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
				width: this.componentMaxLength
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
			let displayNameInput = this._modelBuilder.inputBox().withProperties({
				value: name,
				width: 200
			}).component();
			displayNameInput.onTextChanged(() => {
				let selectedRow = this._parameters.find(x => x.paramName === name);
				if (selectedRow) {
					selectedRow.columnName = displayNameInput.value || name;
				}
			});
			return [`${name}(${modelParameter.type ? modelParameter.type : constants.unsupportedModelParameterType})`, displayNameInput, nameInput];
		}

		return [];
	}

	private createInputTableRow(modelParameter: ModelParameter, columns: TableColumn[] | undefined): any[] {
		if (this._modelBuilder && columns) {
			const values = columns.map(c => { return { name: c.columnName, displayName: `${c.columnName}(${c.dataType})` }; });
			let nameInput = this._modelBuilder.dropDown().withProperties({
				values: values,
				width: this.componentMaxLength
			}).component();
			const name = modelParameter.name;
			let column = values.find(x => x.name === modelParameter.name);
			if (!column) {
				column = values[0];
			}
			nameInput.value = column;

			this._parameters.push({ columnName: column.name, paramName: name });

			nameInput.onValueChanged(() => {
				const selectedColumn = nameInput.value;
				const value = selectedColumn ? (<azdata.CategoryValue>selectedColumn).name : undefined;

				let selectedRow = this._parameters.find(x => x.paramName === name);
				if (selectedRow) {
					selectedRow.columnName = value || '';
				}
			});
			const label = this._modelBuilder.inputBox().withProperties({
				value: `${name}(${modelParameter.type ? modelParameter.type : constants.unsupportedModelParameterType})`,
				enabled: false,
				width: this.componentMaxLength
			}).component();
			const image = this._modelBuilder.image().withProperties({
				width: 50,
				height: 50,
				iconPath: {
					dark: this.asAbsolutePath('images/arrow.svg'),
					light: this.asAbsolutePath('images/arrow.svg')
				},
				iconWidth: 20,
				iconHeight: 20,
				title: 'maps'
			}).component();
			return [nameInput, image, label];
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
