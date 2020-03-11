/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../../common/constants';
import { ModelViewBase } from '../modelViewBase';
import { ApiWrapper } from '../../../common/apiWrapper';
import { IDataComponent } from '../../interfaces';
import { PredictColumn, DatabaseTable } from '../../../prediction/interfaces';

/**
 * View to render azure models in a table
 */
export class ColumnsTable extends ModelViewBase implements IDataComponent<PredictColumn[]> {

	private _table: azdata.DeclarativeTableComponent;
	private _selectedColumns: PredictColumn[] = [];
	private _columns: string[] | undefined;

	/**
	 * Creates a view to render azure models in a table
	 */
	constructor(apiWrapper: ApiWrapper, private _modelBuilder: azdata.ModelBuilder, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
		this._table = this.registerComponent(this._modelBuilder);
	}

	/**
	 * Register components
	 * @param modelBuilder model builder
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.DeclarativeTableComponent {
		this._table = modelBuilder.declarativeTable()
			.withProperties<azdata.DeclarativeTableProperties>(
				{
					columns: [
						{ // Name
							displayName: constants.columnDatabase,
							ariaLabel: constants.columnName,
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
							displayName: constants.inputName,
							ariaLabel: constants.inputName,
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
							displayName: '',
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
		return this._table;
	}

	public get component(): azdata.DeclarativeTableComponent {
		return this._table;
	}

	/**
	 * Load data in the component
	 * @param workspaceResource Azure workspace
	 */
	public async loadData(table: DatabaseTable): Promise<void> {
		this._selectedColumns = [];
		if (this._table) {
			this._columns = await this.listColumnNames(table);
			let tableData: any[][] = [];

			if (this._columns) {
				tableData = tableData.concat(this._columns.map(model => this.createTableRow(model)));
			}

			this._table.data = tableData;
		}
	}

	private createTableRow(column: string): any[] {
		if (this._modelBuilder) {
			let selectRowButton = this._modelBuilder.checkBox().withProperties({

				width: 15,
				height: 15,
				checked: true
			}).component();
			let nameInputBox = this._modelBuilder.inputBox().withProperties({
				value: '',
				width: 150
			}).component();
			this._selectedColumns.push({ name: column });
			selectRowButton.onChanged(() => {
				if (selectRowButton.checked) {
					if (!this._selectedColumns.find(x => x.name === column)) {
						this._selectedColumns.push({ name: column });
					}
				} else {
					if (this._selectedColumns.find(x => x.name === column)) {
						this._selectedColumns = this._selectedColumns.filter(x => x.name !== column);
					}
				}
			});
			nameInputBox.onTextChanged(() => {
				let selectedRow = this._selectedColumns.find(x => x.name === column);
				if (selectedRow) {
					selectedRow.displayName = nameInputBox.value;
				}
			});
			return [column, nameInputBox, selectRowButton];
		}

		return [];
	}

	/**
	 * Returns selected data
	 */
	public get data(): PredictColumn[] | undefined {
		return this._selectedColumns;
	}

	/**
	 * Refreshes the view
	 */
	public async refresh(): Promise<void> {
	}
}
