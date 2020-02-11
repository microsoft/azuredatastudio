/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import { AzureResourceFilterComponent } from './azureResourceFilterComponent';
import { AzureModelsTable } from './azureModelsTable';

export class AzureModelsComponent extends ModelViewBase {

	private _form: azdata.FormContainer;
	public azureModelsTable: AzureModelsTable | undefined;
	public azureFilterComponent: AzureResourceFilterComponent | undefined;
	private _loader: azdata.LoadingComponent | undefined;

	/**
	 *
	 */
	constructor(apiWrapper: ApiWrapper, private _modelBuilder: azdata.ModelBuilder, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
		this.azureFilterComponent = new AzureResourceFilterComponent(this._apiWrapper, this._modelBuilder, this);
		this.azureModelsTable = new AzureModelsTable(this._apiWrapper, this._modelBuilder, this);
		this._loader = this._modelBuilder.loadingComponent()
			.withItem(this.azureModelsTable.component)
			.withProperties({
				loading: true
			}).component();

		this.azureFilterComponent.onWorkspacesSelected(async () => {
			await this.onLoading();
			await this.azureModelsTable?.loadData(
				this.azureFilterComponent?.account,
				this.azureFilterComponent?.subscription,
				this.azureFilterComponent?.group,
				this.azureFilterComponent?.workspace);
			await this.onLoaded();
		});

		this._form = this._modelBuilder.formContainer().withFormItems([{
			title: '',
			component: this.azureFilterComponent.component
		}, {
			title: '',
			component: this._loader
		}]).component();

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

	public get component(): azdata.Component {
		return this._form;
	}

	public async loadData() {
		await this.azureFilterComponent?.loadData();
	}

	public async reset(): Promise<void> {
		await this.loadData();
	}
}
