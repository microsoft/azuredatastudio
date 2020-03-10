/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../common/constants';
import { ModelViewBase } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import { RegisteredModel } from '../../modelManagement/interfaces';

/**
 * View to render registered models table
 */
export class CurrentModelsTable extends ModelViewBase {

	private _table: azdata.DeclarativeTableComponent;

	/**
	 * Creates new view
	 */
	constructor(apiWrapper: ApiWrapper, private _modelBuilder: azdata.ModelBuilder, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
		this._table = this.registerComponent(this._modelBuilder);
	}

	/**
	 *
	 * @param modelBuilder register the components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.DeclarativeTableComponent {
		this._table = modelBuilder.declarativeTable()
			.withProperties<azdata.DeclarativeTableProperties>(
				{
					columns: [
						{ // Artifact name
							displayName: constants.modelArtifactName,
							ariaLabel: constants.modelArtifactName,
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
						{ // Created
							displayName: constants.modelCreated,
							ariaLabel: constants.modelCreated,
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

	/**
	 * Returns the component
	 */
	public get component(): azdata.DeclarativeTableComponent {
		return this._table;
	}

	/**
	 * Loads the data in the component
	 */
	public async loadData(): Promise<void> {
		let models: RegisteredModel[] | undefined;

		models = await this.listModels();
		let tableData: any[][] = [];

		if (models) {
			tableData = tableData.concat(models.map(model => this.createTableRow(model)));
		}

		this._table.data = tableData;
	}

	private createTableRow(model: RegisteredModel): any[] {
		if (this._modelBuilder) {
			let editLanguageButton = this._modelBuilder.button().withProperties({
				label: '',
				title: constants.deleteTitle,
				iconPath: {
					dark: this.asAbsolutePath('images/dark/edit_inverse.svg'),
					light: this.asAbsolutePath('images/light/edit.svg')
				},
				width: 15,
				height: 15
			}).component();
			editLanguageButton.onDidClick(() => {
			});
			return [model.artifactName, model.title, model.created, editLanguageButton];
		}

		return [];
	}

	/**
	 * Refreshes the view
	 */
	public async refresh(): Promise<void> {
		await this.loadData();
	}
}
