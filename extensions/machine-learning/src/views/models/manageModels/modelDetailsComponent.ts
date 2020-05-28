/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase } from '../modelViewBase';
import { ApiWrapper } from '../../../common/apiWrapper';
import * as constants from '../../../common/constants';
import { IDataComponent } from '../../interfaces';
import { ImportedModel } from '../../../modelManagement/interfaces';

/**
 * View to render filters to pick an azure resource
 */
export class ModelDetailsComponent extends ModelViewBase implements IDataComponent<ImportedModel> {

	private _form: azdata.FormContainer | undefined;
	private _nameComponent: azdata.InputBoxComponent | undefined;
	private _descriptionComponent: azdata.InputBoxComponent | undefined;
	private _createdComponent: azdata.Component | undefined;
	private _deployedComponent: azdata.Component | undefined;
	private _frameworkComponent: azdata.Component | undefined;
	private _frameworkVersionComponent: azdata.Component | undefined;
	/**
	 * Creates a new view
	 */
	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase, private _model: ImportedModel) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 * Register components
	 * @param modelBuilder model builder
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this._createdComponent = modelBuilder.text().withProperties({
			value: this._model.created
		}).component();
		this._deployedComponent = modelBuilder.text().withProperties({
			value: this._model.deploymentTime
		}).component();
		this._frameworkComponent = modelBuilder.text().withProperties({
			value: this._model.framework
		}).component();
		this._frameworkVersionComponent = modelBuilder.text().withProperties({
			value: this._model.frameworkVersion
		}).component();
		this._nameComponent = modelBuilder.inputBox().withProperties({
			width: this.componentMaxLength,
			value: this._model.modelName
		}).component();
		this._descriptionComponent = modelBuilder.inputBox().withProperties({
			width: this.componentMaxLength,
			value: this._model.description,
			multiline: true,
			height: 50
		}).component();

		this._form = modelBuilder.formContainer().withFormItems([{
			title: '',
			component: this._nameComponent
		},
		{
			title: '',
			component: this._descriptionComponent
		}]).component();
		return this._form;
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this._nameComponent && this._descriptionComponent && this._createdComponent && this._deployedComponent && this._frameworkComponent && this._frameworkVersionComponent) {
			formBuilder.addFormItems([{
				title: constants.modelName,
				component: this._nameComponent
			}, {
				title: constants.modelCreated,
				component: this._createdComponent
			},
			{
				title: constants.modelImported,
				component: this._deployedComponent
			}, {
				title: constants.modelFramework,
				component: this._frameworkComponent
			}, {
				title: constants.modelFrameworkVersion,
				component: this._frameworkVersionComponent
			}, {
				title: constants.modelDescription,
				component: this._descriptionComponent
			}]);
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._nameComponent && this._descriptionComponent && this._createdComponent && this._deployedComponent && this._frameworkComponent && this._frameworkVersionComponent) {
			formBuilder.removeFormItem({
				title: constants.modelCreated,
				component: this._createdComponent
			});
			formBuilder.removeFormItem({
				title: constants.modelCreated,
				component: this._frameworkComponent
			});
			formBuilder.removeFormItem({
				title: constants.modelCreated,
				component: this._frameworkVersionComponent
			});
			formBuilder.removeFormItem({
				title: constants.modelCreated,
				component: this._deployedComponent
			});
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
	 * Returns the created component
	 */
	public get component(): azdata.Component | undefined {
		return this._form;
	}

	/**
	 * Returns selected data
	 */
	public get data(): ImportedModel | undefined {
		let model = Object.assign({}, this._model);
		model.modelName = this._nameComponent?.value || '';
		model.description = this._descriptionComponent?.value || '';
		return model;
	}

	/**
	 * loads data in the components
	 */
	public async loadData(): Promise<void> {
	}

	/**
	 * refreshes the view
	 */
	public async refresh(): Promise<void> {
		await this.loadData();
	}
}
