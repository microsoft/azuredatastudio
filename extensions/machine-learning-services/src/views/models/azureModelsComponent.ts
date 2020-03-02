/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import { AzureResourceFilterComponent } from './azureResourceFilterComponent';
import { AzureModelsTable } from './azureModelsTable';
import * as constants from '../../common/constants';
import { IPageView, IDataComponent, AzureModelResource } from '../interfaces';

export class AzureModelsComponent extends ModelViewBase implements IPageView, IDataComponent<AzureModelResource> {

	public azureModelsTable: AzureModelsTable | undefined;
	public azureFilterComponent: AzureResourceFilterComponent | undefined;

	private _loader: azdata.LoadingComponent | undefined;
	private _form: azdata.FormContainer | undefined;

	/**
	 * Component to render a view to pick an azure model
	 */
	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 * Register components
	 * @param modelBuilder model builder
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this.azureFilterComponent = new AzureResourceFilterComponent(this._apiWrapper, modelBuilder, this);
		this.azureModelsTable = new AzureModelsTable(this._apiWrapper, modelBuilder, this);
		this._loader = modelBuilder.loadingComponent()
			.withItem(this.azureModelsTable.component)
			.withProperties({
				loading: true
			}).component();

		this.azureFilterComponent.onWorkspacesSelected(async () => {
			await this.onLoading();
			await this.azureModelsTable?.loadData(this.azureFilterComponent?.data);
			await this.onLoaded();
		});

		this._form = modelBuilder.formContainer().withFormItems([{
			title: constants.azureModelFilter,
			component: this.azureFilterComponent.component
		}, {
			title: constants.azureModels,
			component: this._loader
		}]).component();
		return this._form;
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
		await this.azureFilterComponent?.loadData();
	}

	/**
	 * Returns selected data
	 */
	public get data(): AzureModelResource | undefined {
		return Object.assign({}, this.azureFilterComponent?.data, {
			model: this.azureModelsTable?.data
		});
	}

	/**
	 * Refreshes the view
	 */
	public async refresh(): Promise<void> {
		await this.loadData();
	}

	/**
	 * Returns the title of the page
	 */
	public get title(): string {
		return constants.azureModelsTitle;
	}
}
