/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase, ModelViewData } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';
import { IDataComponent } from '../interfaces';

/**
 * View to pick local models file
 */
export class ModelsDetailsTableComponent extends ModelViewBase implements IDataComponent<ModelViewData[]> {
	private _table: azdata.DeclarativeTableComponent | undefined;

	/**
	 * Creates new view
	 */
	constructor(apiWrapper: ApiWrapper, private _modelBuilder: azdata.ModelBuilder, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder Register the components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this._table = modelBuilder.declarativeTable()
			.withProperties<azdata.DeclarativeTableProperties>(
				{
					columns: [
						{ // Name
							displayName: constants.modelFileName,
							ariaLabel: constants.modelFileName,
							valueType: azdata.DeclarativeDataType.string,
							isReadOnly: true,
							width: 150,
							headerCssStyles: {
								...constants.cssStyles.tableHeader
							},
							rowCssStyles: {
								...constants.cssStyles.tableRow
							},
						},
						{ // Name
							displayName: constants.modelName,
							ariaLabel: constants.modelName,
							valueType: azdata.DeclarativeDataType.component,
							isReadOnly: true,
							width: 150,
							headerCssStyles: {
								...constants.cssStyles.tableHeader
							},
							rowCssStyles: {
								...constants.cssStyles.tableRow
							},
						},
						{ // Created
							displayName: constants.modelDescription,
							ariaLabel: constants.modelDescription,
							valueType: azdata.DeclarativeDataType.component,
							isReadOnly: true,
							width: 100,
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

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this._table) {
			formBuilder.addFormItems([{
				title: '',
				component: this._table
			}]);
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._table) {
			formBuilder.removeFormItem({
				title: '',
				component: this._table
			});
		}
	}

	/**
	 * Load data in the component
	 * @param workspaceResource Azure workspace
	 */
	public async loadData(): Promise<void> {

		const models = this.modelsViewData;
		if (this._table && models) {

			let tableData: any[][] = [];
			tableData = tableData.concat(models.map(model => this.createTableRow(model)));
			this._table.data = tableData;
		}
	}

	private createTableRow(model: ModelViewData | undefined): any[] {
		if (this._modelBuilder && model && model.modelDetails) {
			const nameComponent = this._modelBuilder.inputBox().withProperties({
				value: model.modelDetails.modelName,
				width: this.componentMaxLength - 100,
				required: true
			}).component();
			const descriptionComponent = this._modelBuilder.inputBox().withProperties({
				value: model.modelDetails.description,
				width: this.componentMaxLength
			}).component();
			descriptionComponent.onTextChanged(() => {
				if (model.modelDetails) {
					model.modelDetails.description = descriptionComponent.value;
				}
			});
			nameComponent.onTextChanged(() => {
				if (model.modelDetails) {
					model.modelDetails.modelName = nameComponent.value || '';
				}
			});
			let deleteButton = this._modelBuilder.button().withProperties({
				label: '',
				title: constants.deleteTitle,
				width: 15,
				height: 15,
				iconPath: {
					dark: this.asAbsolutePath('images/dark/delete_inverse.svg'),
					light: this.asAbsolutePath('images/light/delete.svg')
				},
			}).component();
			deleteButton.onDidClick(async () => {
				this.modelsViewData = this.modelsViewData.filter(x => x !== model);
				await this.refresh();
			});
			return [model.modelDetails.fileName, nameComponent, descriptionComponent, deleteButton];
		}

		return [];
	}

	/**
	 * Returns selected data
	 */
	public get data(): ModelViewData[] {
		return this.modelsViewData;
	}

	/**
	 * Returns the component
	 */
	public get component(): azdata.Component | undefined {
		return this._table;
	}

	/**
	 * Refreshes the view
	 */
	public async refresh(): Promise<void> {
		await this.loadData();
	}
}
