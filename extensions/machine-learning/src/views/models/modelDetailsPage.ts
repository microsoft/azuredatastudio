/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase, ModelViewData } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';
import { IPageView, IDataComponent } from '../interfaces';
import { ModelsDetailsTableComponent } from './modelsDetailsTableComponent';

/**
 * View to pick model details
 */
export class ModelDetailsPage extends ModelViewBase implements IPageView, IDataComponent<ModelViewData[]> {

	private _form: azdata.FormContainer | undefined;
	private _formBuilder: azdata.FormBuilder | undefined;
	public modelDetails: ModelsDetailsTableComponent | undefined;

	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder Register components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {

		this._formBuilder = modelBuilder.formContainer();
		this.modelDetails = new ModelsDetailsTableComponent(this._apiWrapper, modelBuilder, this);
		this.modelDetails.registerComponent(modelBuilder);
		this.modelDetails.addComponents(this._formBuilder);
		this.refresh();
		this._form = this._formBuilder.component();
		return this._form;
	}

	/**
	 * Returns selected data
	 */
	public get data(): ModelViewData[] | undefined {
		return this.modelDetails?.data;
	}

	/**
	 * Returns the component
	 */
	public get component(): azdata.Component | undefined {
		return this._form;
	}

	/**
	 * Refreshes the view
	 */
	public async refresh(): Promise<void> {
		if (this.modelDetails) {
			await this.modelDetails.refresh();
		}
	}

	public async onEnter(): Promise<void> {
		await this.refresh();
	}

	/**
	 * Returns page title
	 */
	public get title(): string {
		return constants.modelDetailsPageTitle;
	}

	public validate(): Promise<boolean> {
		if (this.data && this.data.length > 0 && !this.data.find(x => !x.modelDetails?.modelName)) {
			return Promise.resolve(true);
		} else {
			this.showErrorMessage(constants.modelNameRequiredError);
			return Promise.resolve(false);
		}
	}
}
