/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase } from '../modelViewBase';
import { ApiWrapper } from '../../../common/apiWrapper';
import * as constants from '../../../common/constants';
import { IDataComponent } from '../../interfaces';
import { PredictColumn } from '../../../prediction/interfaces';
import { ColumnsTable } from './columnsTable';
import { ModelParameters } from '../../../modelManagement/interfaces';

/**
 * View to render filters to pick an azure resource
 */

export class OutputColumnsComponent extends ModelViewBase implements IDataComponent<PredictColumn[]> {

	private _form: azdata.FormContainer | undefined;
	private _columns: ColumnsTable | undefined;
	private _modelParameters: ModelParameters | undefined;

	/**
	 * Creates a new view
	 */
	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 * Register components
	 * @param modelBuilder model builder
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this._columns = new ColumnsTable(this._apiWrapper, modelBuilder, this, false);

		this._form = modelBuilder.formContainer().withFormItems([{
			title: constants.azureAccount,
			component: this._columns.component
		}]).component();
		return this._form;
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this._columns) {
			formBuilder.addFormItems([{
				title: constants.outputColumns,
				component: this._columns.component
			}]);
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._columns) {
			formBuilder.removeFormItem({
				title: constants.outputColumns,
				component: this._columns.component
			});
		}
	}

	/**
	 * Returns the created component
	 */
	public get component(): azdata.Component | undefined {
		return this._form;
	}

	/**
	 * loads data in the components
	 */
	public async loadData(): Promise<void> {
		if (this._modelParameters) {
			this._columns?.loadOutputs(this._modelParameters);
		}
	}

	public set modelParameters(value: ModelParameters) {
		this._modelParameters = value;
	}

	public async onLoading(): Promise<void> {
		if (this._columns) {
			await this._columns.onLoading();
		}
	}

	public async onLoaded(): Promise<void> {
		if (this._columns) {
			await this._columns.onLoaded();
		}
	}

	/**
	 * refreshes the view
	 */
	public async refresh(): Promise<void> {
		await this.loadData();
	}

	/**
	 * Returns selected data
	 */
	public get data(): PredictColumn[] | undefined {
		return this._columns?.data;
	}
}
