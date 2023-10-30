/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase } from '../modelViewBase';
import { ApiWrapper } from '../../../common/apiWrapper';
import * as constants from '../../../common/constants';
import { IPageView, IDataComponent } from '../../interfaces';
import { InputColumnsComponent } from './inputColumnsComponent';
import { OutputColumnsComponent } from './outputColumnsComponent';
import { PredictParameters } from '../../../prediction/interfaces';

/**
 * View to pick model source
 */
export class ColumnsSelectionPage extends ModelViewBase implements IPageView, IDataComponent<PredictParameters> {

	private _form: azdata.FormContainer | undefined;
	private _formBuilder: azdata.FormBuilder | undefined;
	public inputColumnsComponent: InputColumnsComponent | undefined;
	public outputColumnsComponent: OutputColumnsComponent | undefined;

	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder Register components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this._formBuilder = modelBuilder.formContainer();
		this.inputColumnsComponent = new InputColumnsComponent(this._apiWrapper, this);
		this.inputColumnsComponent.registerComponent(modelBuilder);
		this.inputColumnsComponent.addComponents(this._formBuilder);

		this.outputColumnsComponent = new OutputColumnsComponent(this._apiWrapper, this);
		this.outputColumnsComponent.registerComponent(modelBuilder);
		this.outputColumnsComponent.addComponents(this._formBuilder);

		this._form = this._formBuilder.component();
		return this._form;
	}

	/**
	 * Returns selected data
	 */
	public get data(): PredictParameters | undefined {
		return this.inputColumnsComponent?.data && this.outputColumnsComponent?.data ?
			Object.assign({}, this.inputColumnsComponent.data, { outputColumns: this.outputColumnsComponent.data }) :
			undefined;
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
		if (this._formBuilder) {
			if (this.inputColumnsComponent) {
				await this.inputColumnsComponent.refresh();
			}
			if (this.outputColumnsComponent) {
				await this.outputColumnsComponent.refresh();
			}
		}
	}

	public async validate(): Promise<boolean> {
		const data = this.data;
		const validated = data !== undefined && data.databaseName !== undefined && data.inputColumns !== undefined && data.outputColumns !== undefined
			&& data.tableName !== undefined && this.inputColumnsComponent !== undefined && this.inputColumnsComponent?.isDataValue
			&& !data.inputColumns.find(x => (x.columnName === constants.selectColumnTitle) || !x.columnName);
		if (!validated) {
			this.showErrorMessage(constants.invalidModelParametersError);
		}

		return Promise.resolve(validated);
	}

	public async onEnter(): Promise<void> {
		await this.inputColumnsComponent?.onLoading();
		await this.outputColumnsComponent?.onLoading();
		try {
			const modelParameters = await this.loadModelParameters();
			if (modelParameters && this.inputColumnsComponent && this.outputColumnsComponent) {
				this.inputColumnsComponent.modelParameters = modelParameters;
				this.outputColumnsComponent.modelParameters = modelParameters;
				await this.outputColumnsComponent.refresh();
			}
		} catch (error) {
			this.showErrorMessage(constants.loadModelParameterFailedError, error);
		}
		await this.inputColumnsComponent?.onLoaded();
		await this.outputColumnsComponent?.onLoaded();
	}

	/**
	 * Returns page title
	 */
	public get title(): string {
		return constants.columnSelectionPageTitle;
	}
}
