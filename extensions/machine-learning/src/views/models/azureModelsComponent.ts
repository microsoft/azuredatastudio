/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase, ModelSourceType } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import { AzureResourceFilterComponent } from './azureResourceFilterComponent';
import { AzureModelsTable } from './azureModelsTable';
import { IDataComponent, AzureModelResource } from '../interfaces';
import { ModelArtifact } from './prediction/modelArtifact';
import { AzureSignInComponent } from './azureSignInComponent';
import { DataInfoComponent } from '../dataInfoComponent';
import * as constants from '../../common/constants';

export class AzureModelsComponent extends ModelViewBase implements IDataComponent<AzureModelResource[]> {

	public azureModelsTable: AzureModelsTable | undefined;
	public azureFilterComponent: AzureResourceFilterComponent | undefined;
	public azureSignInComponent: AzureSignInComponent | undefined;

	private _loader: azdata.LoadingComponent | undefined;
	private _form: azdata.FormContainer | undefined;
	private _downloadedFile: ModelArtifact | undefined;
	private _emptyModelsComponent: DataInfoComponent | undefined;

	/**
	 * Component to render a view to pick an azure model
	 */
	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase, private _multiSelect: boolean = true) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 * Register components
	 * @param modelBuilder model builder
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this.azureFilterComponent = new AzureResourceFilterComponent(this._apiWrapper, modelBuilder, this);
		this.azureModelsTable = new AzureModelsTable(this._apiWrapper, modelBuilder, this, this._multiSelect);
		this.azureSignInComponent = new AzureSignInComponent(this._apiWrapper, modelBuilder, this);
		this._loader = modelBuilder.loadingComponent()
			.withItem(this.azureModelsTable.component)
			.withProperties({
				loading: true
			}).component();
		this.azureModelsTable.onModelSelectionChanged(async () => {
			if (this._downloadedFile) {
				await this._downloadedFile.close();
			}
			this._downloadedFile = undefined;
		});

		this._emptyModelsComponent = new DataInfoComponent(this._apiWrapper, this);
		this._emptyModelsComponent.width = 200;
		this._emptyModelsComponent.height = 250;
		this._emptyModelsComponent.iconSettings = {
			css: { 'padding-top': '30px' },
			width: 128,
			height: 128
		};

		this._emptyModelsComponent.registerComponent(modelBuilder);

		this.azureFilterComponent.onWorkspacesSelectedChanged(async () => {
			await this.onLoading();
			await this.azureModelsTable?.loadData(this.azureFilterComponent?.data);
			if (this._emptyModelsComponent) {
				if (this.azureModelsTable?.isTableEmpty) {
					this._emptyModelsComponent.title = constants.azureModelsListEmptyTitle;
					this._emptyModelsComponent.description = constants.azureModelsListEmptyDescription;
					this._emptyModelsComponent.iconSettings.path = this.asAbsolutePath('images/emptyTable.svg');
				} else {
					this._emptyModelsComponent.title = '';
					this._emptyModelsComponent.description = '';
					this._emptyModelsComponent.iconSettings.path = 'noicon';
				}
				await this._emptyModelsComponent.refresh();
			}
			await this.onLoaded();
		});

		this._form = modelBuilder.formContainer().withFormItems([{
			title: '',
			component: this.azureFilterComponent.component
		}, {
			title: '',
			component: this._loader
		}]).component();
		return this._form;
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this.modelSourceType === ModelSourceType.Azure) {
			this.removeComponents(formBuilder);
			if (this.azureFilterComponent?.accountIsValid) {
				this.addAzureComponents(formBuilder);
			} else {
				this.addAzureSignInComponents(formBuilder);
			}
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		this.removeAzureComponents(formBuilder);
		this.removeAzureSignInComponents(formBuilder);
	}

	private addAzureComponents(formBuilder: azdata.FormBuilder) {
		if (this.azureFilterComponent && this._loader && this._emptyModelsComponent?.component) {
			this.azureFilterComponent.addComponents(formBuilder);

			formBuilder.addFormItems([{
				title: '',
				component: this._loader
			}], { horizontal: true });
			formBuilder.addFormItems([{
				title: '',
				component: this._emptyModelsComponent.component
			}], { horizontal: true });
		}
	}

	private removeAzureComponents(formBuilder: azdata.FormBuilder) {
		if (this.azureFilterComponent && this._loader && this._emptyModelsComponent?.component) {
			this.azureFilterComponent.removeComponents(formBuilder);
			formBuilder.removeFormItem({
				title: '',
				component: this._loader
			});
			formBuilder.removeFormItem({
				title: '',
				component: this._emptyModelsComponent.component
			});
		}
	}

	private addAzureSignInComponents(formBuilder: azdata.FormBuilder) {
		if (this.azureSignInComponent) {
			this.azureSignInComponent.addComponents(formBuilder);
		}
	}

	private removeAzureSignInComponents(formBuilder: azdata.FormBuilder) {
		if (this.azureSignInComponent) {
			this.azureSignInComponent.removeComponents(formBuilder);
		}
	}

	private async onLoading(): Promise<void> {
		if (this._loader) {
			await this._loader.updateProperties({ loading: true });
		}
	}

	private async onLoaded(): Promise<void> {
		if (this._loader) {
			await this._loader.updateProperties({ loading: false });
		}
	}

	public get component(): azdata.Component | undefined {
		return this._form;
	}

	/**
	 * Loads the data in the components
	 */
	public async loadData(): Promise<void> {
		await this.onLoaded();
		await this.azureFilterComponent?.loadData();
	}

	/**
	 * Returns selected data
	 */
	public get data(): AzureModelResource[] | undefined {
		return this.azureModelsTable?.data ? this.azureModelsTable?.data.map(x => Object.assign({}, this.azureFilterComponent?.data, {
			model: x
		})) : undefined;
	}

	public async getDownloadedModel(): Promise<ModelArtifact | undefined> {
		const data = this.data;
		if (!this._downloadedFile && data && data.length > 0) {
			this._downloadedFile = new ModelArtifact(await this.downloadAzureModel(data[0]));
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
