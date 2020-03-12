/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase, SourceModelSelectedEventName } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';
import { IDataComponent } from '../interfaces';

export enum ModelSourceType {
	Local,
	Azure,
	RegisteredModels
}
/**
 * View to pick model source
 */
export class ModelSourcesComponent extends ModelViewBase implements IDataComponent<ModelSourceType> {

	private _form: azdata.FormContainer | undefined;
	private _flexContainer: azdata.FlexContainer | undefined;
	private _amlModel: azdata.RadioButtonComponent | undefined;
	private _localModel: azdata.RadioButtonComponent | undefined;
	private _registeredModels: azdata.RadioButtonComponent | undefined;
	private _sourceType: ModelSourceType = ModelSourceType.Local;

	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase, private _options: ModelSourceType[] = [ModelSourceType.Local, ModelSourceType.Azure]) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder Register components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this._localModel = modelBuilder.radioButton()
			.withProperties({
				value: 'local',
				name: 'modelLocation',
				label: constants.localModelSource,
				checked: this._options[0] === ModelSourceType.Local
			}).component();


		this._amlModel = modelBuilder.radioButton()
			.withProperties({
				value: 'aml',
				name: 'modelLocation',
				label: constants.azureModelSource,
				checked: this._options[0] === ModelSourceType.Azure
			}).component();

		this._registeredModels = modelBuilder.radioButton()
			.withProperties({
				value: 'registered',
				name: 'modelLocation',
				label: constants.registeredModelsSource,
				checked: this._options[0] === ModelSourceType.RegisteredModels
			}).component();

		this._localModel.onDidClick(() => {
			this._sourceType = ModelSourceType.Local;
			this.sendRequest(SourceModelSelectedEventName);

		});
		this._amlModel.onDidClick(() => {
			this._sourceType = ModelSourceType.Azure;
			this.sendRequest(SourceModelSelectedEventName);
		});
		this._registeredModels.onDidClick(() => {
			this._sourceType = ModelSourceType.RegisteredModels;
			this.sendRequest(SourceModelSelectedEventName);
		});
		let components: azdata.RadioButtonComponent[] = [];

		this._options.forEach(option => {
			switch (option) {
				case ModelSourceType.Local:
					if (this._localModel) {
						components.push(this._localModel);
					}
					break;
				case ModelSourceType.Azure:
					if (this._amlModel) {
						components.push(this._amlModel);
					}
					break;
				case ModelSourceType.RegisteredModels:
					if (this._registeredModels) {
						components.push(this._registeredModels);
					}
					break;
			}
		});
		this._sourceType = this._options[0];

		this._flexContainer = modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column',
				justifyContent: 'space-between'
			}).withItems(components).component();

		this._form = modelBuilder.formContainer().withFormItems([{
			title: '',
			component: this._flexContainer
		}]).component();

		return this._form;
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this._flexContainer) {
			formBuilder.addFormItem({ title: constants.modelSourcesTitle, component: this._flexContainer });
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._flexContainer) {
			formBuilder.removeFormItem({ title: constants.modelSourcesTitle, component: this._flexContainer });
		}
	}

	/**
	 * Returns selected data
	 */
	public get data(): ModelSourceType {
		return this._sourceType;
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
