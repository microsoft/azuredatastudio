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

/**
 * View to render filters to pick an azure resource
 */
const componentWidth = 60;
export class OutputColumnsComponent extends ModelViewBase implements IDataComponent<PredictColumn[]> {

	private _form: azdata.FormContainer | undefined;
	private _flex: azdata.FlexContainer | undefined;
	private _columnName: azdata.InputBoxComponent | undefined;
	private _columnTypes: azdata.DropDownComponent | undefined;
	private _dataTypes: string[] = [
		'int',
		'nvarchar(MAX)',
		'varchar(MAX)',
		'float',
		'double',
		'bit'
	];

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
		this._columnName = modelBuilder.inputBox().withProperties({
			width: this.componentMaxLength - componentWidth - this.spaceBetweenComponentsLength
		}).component();
		this._columnTypes = modelBuilder.dropDown().withProperties({
			width: componentWidth
		}).component();

		let flex = modelBuilder.flexContainer()
			.withLayout({
				width: this._columnName.width
			}).withItems([
				this._columnName]
			).component();
		this._flex = modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
				justifyContent: 'space-between',
				width: this.componentMaxLength
			}).withItems([
				flex, this._columnTypes]
			).component();

		this._form = modelBuilder.formContainer().withFormItems([{
			title: constants.azureAccount,
			component: this._flex
		}]).component();
		return this._form;
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this._flex) {
			formBuilder.addFormItems([{
				title: constants.outputColumns,
				component: this._flex
			}]);
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._flex) {
			formBuilder.removeFormItem({
				title: constants.outputColumns,
				component: this._flex
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
		if (this._columnTypes) {
			this._columnTypes.values = this._dataTypes;
			this._columnTypes.value = this._dataTypes[0];
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
		return this._columnName && this._columnTypes ? [{
			name: this._columnName.value || '',
			dataType: <string>this._columnTypes.value || ''
		}] : undefined;
	}
}
