/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase, SourceModelSelectedEventName, ModelSourceType } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';
import { IDataComponent } from '../interfaces';

/**
 * View to pick model source
 */
export class ModelSourcesComponent extends ModelViewBase implements IDataComponent<ModelSourceType> {

	private _form: azdata.FormContainer | undefined;
	private _flexContainer: azdata.FlexContainer | undefined;
	private _amlModel: azdata.CardComponent | undefined;
	private _localModel: azdata.CardComponent | undefined;
	private _registeredModels: azdata.CardComponent | undefined;
	private _sourceType: ModelSourceType = ModelSourceType.Local;

	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase, private _options: ModelSourceType[] = [ModelSourceType.Local, ModelSourceType.Azure]) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder Register components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {

		this._sourceType = this._options && this._options.length > 0 ? this._options[0] : ModelSourceType.Local;
		this.modelSourceType = this._sourceType;
		this._localModel = modelBuilder.card()
			.withProperties({
				value: 'local',
				name: 'modelLocation',
				label: constants.localModelSource,
				selected: this._sourceType === ModelSourceType.Local,
				cardType: azdata.CardType.VerticalButton,
				iconPath: { light: this.asAbsolutePath('images/fileUpload.svg'), dark: this.asAbsolutePath('images/fileUpload.svg') },
				width: 50
			}).component();
		this._amlModel = modelBuilder.card()
			.withProperties({
				value: 'aml',
				name: 'modelLocation',
				label: constants.azureModelSource,
				selected: this._sourceType === ModelSourceType.Azure,
				cardType: azdata.CardType.VerticalButton,
				iconPath: { light: this.asAbsolutePath('images/aml.svg'), dark: this.asAbsolutePath('images/aml.svg') },
				width: 50
			}).component();

		this._registeredModels = modelBuilder.card()
			.withProperties({
				value: 'registered',
				name: 'modelLocation',
				label: constants.registeredModelsSource,
				selected: this._sourceType === ModelSourceType.RegisteredModels,
				cardType: azdata.CardType.VerticalButton,
				iconPath: { light: this.asAbsolutePath('images/imported.svg'), dark: this.asAbsolutePath('images/imported.svg') },
				width: 50
			}).component();

		this._localModel.onCardSelectedChanged(() => {
			this._sourceType = ModelSourceType.Local;
			this.sendRequest(SourceModelSelectedEventName, this._sourceType);
			if (this._amlModel && this._registeredModels) {
				this._amlModel.selected = false;
				this._registeredModels.selected = false;
			}
		});
		this._amlModel.onCardSelectedChanged(() => {
			this._sourceType = ModelSourceType.Azure;
			this.sendRequest(SourceModelSelectedEventName, this._sourceType);
			if (this._localModel && this._registeredModels) {
				this._localModel.selected = false;
				this._registeredModels.selected = false;
			}
		});
		this._registeredModels.onCardSelectedChanged(() => {
			this._sourceType = ModelSourceType.RegisteredModels;
			this.sendRequest(SourceModelSelectedEventName, this._sourceType);
			if (this._localModel && this._amlModel) {
				this._localModel.selected = false;
				this._amlModel.selected = false;
			}
		});
		let components: azdata.Component[] = [];

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
		this._flexContainer = modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
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
			formBuilder.addFormItem({ title: '', component: this._flexContainer });
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._flexContainer) {
			formBuilder.removeFormItem({ title: '', component: this._flexContainer });
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
