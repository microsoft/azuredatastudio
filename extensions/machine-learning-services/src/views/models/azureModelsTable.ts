/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../common/constants';
import { ModelViewBase } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import { WorkspaceModel } from '../../modelManagement/interfaces';
import { IDataComponent, AzureWorkspaceResource } from '../interfaces';

/**
 * View to render azure models in a table
 */
export class AzureModelsTable extends ModelViewBase implements IDataComponent<WorkspaceModel> {

	private _table: azdata.DeclarativeTableComponent;
	private _selectedModelId: any;
	private _models: WorkspaceModel[] | undefined;
	private _onModelSelectionChanged: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onModelSelectionChanged: vscode.Event<void> = this._onModelSelectionChanged.event;

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
							width: 100,
							headerCssStyles: {
								...constants.cssStyles.tableHeader
							},
							rowCssStyles: {
								...constants.cssStyles.tableRow
							},
						},
						{ // Version
							displayName: constants.modelVersion,
							ariaLabel: constants.modelVersion,
							valueType: azdata.DeclarativeDataType.string,
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

	public get component(): azdata.DeclarativeTableComponent {
		return this._table;
	}

	/**
	 * Load data in the component
	 * @param workspaceResource Azure workspace
	 */
	public async loadData(workspaceResource?: AzureWorkspaceResource | undefined): Promise<void> {

		if (this._table && workspaceResource) {
			this._models = await this.listAzureModels(workspaceResource);
			let tableData: any[][] = [];

			if (this._models) {
				tableData = tableData.concat(this._models.map(model => this.createTableRow(model)));
			}

			this._table.data = tableData;
		}
		this._onModelSelectionChanged.fire();
	}

	private createTableRow(model: WorkspaceModel): any[] {
		if (this._modelBuilder) {
			let selectModelButton = this._modelBuilder.radioButton().withProperties({
				name: 'amlModel',
				value: model.id,
				width: 15,
				height: 15,
				checked: false
			}).component();
			selectModelButton.onDidClick(() => {
				this._selectedModelId = model.id;
				this._onModelSelectionChanged.fire();
			});
			return [model.name, model.createdTime, model.frameworkVersion, selectModelButton];
		}

		return [];
	}

	/**
	 * Returns selected data
	 */
	public get data(): WorkspaceModel | undefined {
		if (this._models && this._selectedModelId) {
			return this._models.find(x => x.id === this._selectedModelId);
		}
		return undefined;
	}

	/**
	 * Refreshes the view
	 */
	public async refresh(): Promise<void> {
		await this.loadData();
	}
}
