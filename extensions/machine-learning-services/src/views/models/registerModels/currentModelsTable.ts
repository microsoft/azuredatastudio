/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../../common/constants';
import { ModelViewBase } from '../modelViewBase';
import { ApiWrapper } from '../../../common/apiWrapper';
import { RegisteredModel } from '../../../modelManagement/interfaces';
import { IDataComponent } from '../../interfaces';
import { ModelArtifact } from '../prediction/modelArtifact';

/**
 * View to render registered models table
 */
export class CurrentModelsTable extends ModelViewBase implements IDataComponent<RegisteredModel> {

	private _table: azdata.DeclarativeTableComponent | undefined;
	private _modelBuilder: azdata.ModelBuilder | undefined;
	private _selectedModel: any;
	private _loader: azdata.LoadingComponent | undefined;
	private _downloadedFile: ModelArtifact | undefined;
	private _onModelSelectionChanged: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onModelSelectionChanged: vscode.Event<void> = this._onModelSelectionChanged.event;

	/**
	 * Creates new view
	 */
	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder register the components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this._modelBuilder = modelBuilder;
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
		this._loader = modelBuilder.loadingComponent()
			.withItem(this._table)
			.withProperties({
				loading: true
			}).component();
		return this._loader;
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this.component) {
			formBuilder.addFormItem({ title: constants.modelSourcesTitle, component: this.component });
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this.component) {
			formBuilder.removeFormItem({ title: constants.modelSourcesTitle, component: this.component });
		}
	}


	/**
	 * Returns the component
	 */
	public get component(): azdata.Component | undefined {
		return this._loader;
	}

	/**
	 * Loads the data in the component
	 */
	public async loadData(): Promise<void> {
		await this.onLoading();
		if (this._table) {
			let models: RegisteredModel[] | undefined;

			models = await this.listModels();
			let tableData: any[][] = [];

			if (models) {
				tableData = tableData.concat(models.map(model => this.createTableRow(model)));
			}

			this._table.data = tableData;
		}
		this.onModelSelected();
		await this.onLoaded();
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

	private createTableRow(model: RegisteredModel): any[] {
		if (this._modelBuilder) {
			let selectModelButton = this._modelBuilder.radioButton().withProperties({
				name: 'amlModel',
				value: model.id,
				width: 15,
				height: 15,
				checked: false
			}).component();
			selectModelButton.onDidClick(async () => {
				this._selectedModel = model;
				await this.onModelSelected();
			});
			return [model.artifactName, model.title, model.created, selectModelButton];
		}

		return [];
	}

	private async onModelSelected(): Promise<void> {
		this._onModelSelectionChanged.fire();
		if (this._downloadedFile) {
			await this._downloadedFile.close();
		}
		this._downloadedFile = undefined;
	}

	/**
	 * Returns selected data
	 */
	public get data(): RegisteredModel | undefined {
		return this._selectedModel;
	}

	public async getDownloadedModel(): Promise<ModelArtifact> {
		if (!this._downloadedFile) {
			this._downloadedFile = new ModelArtifact(await this.downloadRegisteredModel(this.data));
		}
		return this._downloadedFile;
	}

	/**
	 * disposes the view
	 */
	public async disposeComponent(): Promise<void> {
		if (this._downloadedFile) {
			await this._downloadedFile.close();
		}
	}

	/**
	 * Refreshes the view
	 */
	public async refresh(): Promise<void> {
		await this.loadData();
	}
}
