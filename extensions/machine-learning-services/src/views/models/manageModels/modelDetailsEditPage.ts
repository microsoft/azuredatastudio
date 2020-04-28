/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase } from '../modelViewBase';
import { ApiWrapper } from '../../../common/apiWrapper';
import * as constants from '../../../common/constants';
import { IPageView, IDataComponent } from '../../interfaces';
import { ImportedModel } from '../../../modelManagement/interfaces';
import { ModelDetailsComponent } from './modelDetailsComponent';

/**
 * View to pick model source
 */
export class ModelDetailsEditPage extends ModelViewBase implements IPageView, IDataComponent<ImportedModel> {

	private _form: azdata.FormContainer | undefined;
	private _formBuilder: azdata.FormBuilder | undefined;
	public modelDetailsComponent: ModelDetailsComponent | undefined;

	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase, private _model: ImportedModel) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder Register components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {

		this._formBuilder = modelBuilder.formContainer();
		this.modelDetailsComponent = new ModelDetailsComponent(this._apiWrapper, this, this._model);

		this.modelDetailsComponent.registerComponent(modelBuilder);
		this.modelDetailsComponent.addComponents(this._formBuilder);
		this._form = this._formBuilder.component();
		return this._form;
	}

	/**
	 * Returns selected data
	 */
	public get data(): ImportedModel | undefined {
		return this.modelDetailsComponent?.data;
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
		if (this.modelDetailsComponent) {
			await this.modelDetailsComponent.refresh();
		}
	}

	/**
	 * Returns page title
	 */
	public get title(): string {
		return constants.modelImportTargetPageTitle;
	}

	public async disposePage(): Promise<void> {
	}

	public async validate(): Promise<boolean> {
		let validated = false;

		if (this.data?.modelName) {
			validated = true;
		} else {
			this.showErrorMessage(constants.modelNameRequiredError);
		}
		return validated;
	}
}
