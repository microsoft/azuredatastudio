/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';
import { IDataComponent } from '../interfaces';
import { RegisteredModelDetails } from '../../modelManagement/interfaces';

/**
 * View to pick local models file
 */
export class ModelDetailsComponent extends ModelViewBase implements IDataComponent<RegisteredModelDetails> {

	private _form: azdata.FormContainer | undefined;
	private _nameComponent: azdata.InputBoxComponent | undefined;
	private _descriptionComponent: azdata.InputBoxComponent | undefined;

	/**
	 * Creates new view
	 */
	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder Register the components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this._nameComponent = modelBuilder.inputBox().withProperties({
			value: '',
			width: this.componentMaxLength - this.browseButtonMaxLength - this.spaceBetweenComponentsLength
		}).component();
		this._descriptionComponent = modelBuilder.inputBox().withProperties({
			value: '',
			multiline: true,
			width: this.componentMaxLength - this.browseButtonMaxLength - this.spaceBetweenComponentsLength,
			hight: '50px'
		}).component();

		this._form = modelBuilder.formContainer().withFormItems([{
			title: constants.modelName,
			component: this._nameComponent
		}, {
			title: constants.modelDescription,
			component: this._descriptionComponent
		}]).component();
		return this._form;
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this._nameComponent && this._descriptionComponent) {
			formBuilder.addFormItems([{
				title: constants.modelName,
				component: this._nameComponent
			}, {
				title: constants.modelDescription,
				component: this._descriptionComponent
			}]);
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._nameComponent && this._descriptionComponent) {
			formBuilder.removeFormItem({
				title: constants.modelName,
				component: this._nameComponent
			});
			formBuilder.removeFormItem({
				title: constants.modelDescription,
				component: this._descriptionComponent
			});
		}
	}


	/**
	 * Returns selected data
	 */
	public get data(): RegisteredModelDetails {
		return {
			title: this._nameComponent?.value || '',
			description: this._descriptionComponent?.value
		};
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
}
