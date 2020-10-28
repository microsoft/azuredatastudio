/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase, SourceModelSelectedEventName, ModelSourceType, ModelActionType } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';
import { IDataComponent } from '../interfaces';

/**
 * View to pick model source
 */
export class ModelSourcesComponent extends ModelViewBase implements IDataComponent<ModelSourceType> {

	private _form: azdata.FormContainer | undefined;
	private _flexContainer: azdata.FlexContainer | undefined;
	private _amlModel: azdata.RadioCard | undefined;
	private _localModel: azdata.RadioCard | undefined;
	private _registeredModels: azdata.RadioCard | undefined;
	private _sourceType: ModelSourceType = ModelSourceType.Local;
	private _defaultSourceType = ModelSourceType.Local;
	private _selectedSourceLabel: azdata.TextComponent | undefined;

	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase, private _options: ModelSourceType[] = [ModelSourceType.Local, ModelSourceType.Azure]) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder Register components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {

		this._sourceType = this._options && this._options.length > 0 ? this._options[0] : this._defaultSourceType;
		this.modelSourceType = this._sourceType;
		let selectedCardId: string = this.convertSourceIdToString(this._sourceType);

		this._localModel = {
			descriptions: [{
				textValue: constants.localModelSource,
				textStyles: {
					'font-size': '14px'
				}
			}],
			id: this.convertSourceIdToString(ModelSourceType.Local),
			icon: { light: this.asAbsolutePath('images/fileUpload.svg'), dark: this.asAbsolutePath('images/fileUpload.svg') }
		};
		this._amlModel = {
			descriptions: [{
				textValue: constants.azureModelSource,
				textStyles: {
					'font-size': '14px'
				}
			}],

			id: this.convertSourceIdToString(ModelSourceType.Azure),
			icon: { light: this.asAbsolutePath('images/aml.svg'), dark: this.asAbsolutePath('images/aml.svg') }
		};

		this._registeredModels = {
			descriptions: [{
				textValue: constants.registeredModelsSource,
				textStyles: {
					'font-size': '14px'
				}
			}],
			id: this.convertSourceIdToString(ModelSourceType.RegisteredModels),
			icon: { light: this.asAbsolutePath('images/imported.svg'), dark: this.asAbsolutePath('images/imported.svg') }
		};

		let components: azdata.RadioCard[] = [];

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
		let radioCardGroup = modelBuilder.radioCardGroup()
			.withProperties({
				cards: components,
				iconHeight: '100px',
				iconWidth: '100px',
				cardWidth: '170px',
				cardHeight: '170px',
				ariaLabel: 'test',
				selectedCardId: selectedCardId
			}).component();
		this._flexContainer = modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withItems([radioCardGroup]).component();
		this._selectedSourceLabel = modelBuilder.text().withProperties({
			value: this.getSourceTypeDescription(this._sourceType),
			CSSStyles: {
				'font-size': '14px',
				'margin': '0',
				'width': '438px'
			}
		}).component();

		this._toDispose.push(radioCardGroup.onSelectionChanged(({ cardId }) => {
			this._sourceType = this.convertSourceIdToEnum(cardId);
			if (this._selectedSourceLabel) {
				this._selectedSourceLabel.value = this.getSourceTypeDescription(this._sourceType);
			}
			this.sendRequest(SourceModelSelectedEventName, this._sourceType);
		}));

		this._form = modelBuilder.formContainer().withFormItems([{
			title: '',
			component: this._flexContainer
		}, {
			title: '',
			component: this._selectedSourceLabel
		}]).component();

		return this._form;
	}

	private convertSourceIdToString(sourceId: ModelSourceType): string {
		return sourceId.toString();
	}

	private convertSourceIdToEnum(sourceId: string): ModelSourceType {
		switch (sourceId) {
			case ModelSourceType.Local.toString():
				return ModelSourceType.Local;
			case ModelSourceType.Azure.toString():
				return ModelSourceType.Azure;
			case ModelSourceType.RegisteredModels.toString():
				return ModelSourceType.RegisteredModels;
		}
		return this._defaultSourceType;
	}

	private getSourceTypeDescription(sourceId: ModelSourceType): string {
		if (this.modelActionType === ModelActionType.Import) {
			switch (sourceId) {
				case ModelSourceType.Local:
					return constants.localModelSourceDescriptionForImport;
				case ModelSourceType.Azure:
					return constants.azureModelSourceDescriptionForImport;
			}
		} else if (this.modelActionType === ModelActionType.Predict) {
			switch (sourceId) {
				case ModelSourceType.Local:
					return constants.localModelSourceDescriptionForPredict;
				case ModelSourceType.Azure:
					return constants.azureModelSourceDescriptionForPredict;
				case ModelSourceType.RegisteredModels:
					return constants.importedModelSourceDescriptionForPredict;
			}
		}
		return '';
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this._flexContainer && this._selectedSourceLabel) {
			formBuilder.addFormItem({ title: '', component: this._flexContainer });
			formBuilder.addFormItem({ title: '', component: this._selectedSourceLabel });
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._flexContainer && this._selectedSourceLabel) {
			formBuilder.removeFormItem({ title: '', component: this._flexContainer });
			formBuilder.removeFormItem({ title: '', component: this._selectedSourceLabel });
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
