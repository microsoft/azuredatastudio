/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';
import { IPageView, IDataComponent } from '../interfaces';
import { ModelDetailsComponent } from './modelDetailsComponent';
import { RegisteredModelDetails } from '../../modelManagement/interfaces';

/**
 * View to pick model details
 */
export class ModelDetailsPage extends ModelViewBase implements IPageView, IDataComponent<RegisteredModelDetails> {

	private _form: azdata.FormContainer | undefined;
	private _formBuilder: azdata.FormBuilder | undefined;
	public modelDetails: ModelDetailsComponent | undefined;

	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder Register components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {

		this._formBuilder = modelBuilder.formContainer();
		this.modelDetails = new ModelDetailsComponent(this._apiWrapper, this);
		this.modelDetails.registerComponent(modelBuilder);

		this.modelDetails.addComponents(this._formBuilder);
		this.refresh();
		this._form = this._formBuilder.component();
		return this._form;
	}

	/**
	 * Returns selected data
	 */
	public get data(): RegisteredModelDetails | undefined {
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
	}

	/**
	 * Returns page title
	 */
	public get title(): string {
		return constants.modelDetailsPageTitle;
	}

	public validate(): Promise<boolean> {
		if (this.data && this.data.title) {
			return Promise.resolve(true);
		} else {
			this.showErrorMessage(constants.modelNameRequiredError);
			return Promise.resolve(false);
		}
	}
}
