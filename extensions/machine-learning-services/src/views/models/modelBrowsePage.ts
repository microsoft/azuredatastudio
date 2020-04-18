/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase, ModelSourceType, ModelViewData } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';
import { IPageView, IDataComponent } from '../interfaces';
import { LocalModelsComponent } from './localModelsComponent';
import { AzureModelsComponent } from './azureModelsComponent';
import { CurrentModelsTable } from './registerModels/currentModelsTable';
import * as utils from '../../common/utils';

/**
 * View to pick model source
 */
export class ModelBrowsePage extends ModelViewBase implements IPageView, IDataComponent<ModelViewData[]> {

	private _form: azdata.FormContainer | undefined;
	private _formBuilder: azdata.FormBuilder | undefined;
	public localModelsComponent: LocalModelsComponent | undefined;
	public azureModelsComponent: AzureModelsComponent | undefined;
	public registeredModelsComponent: CurrentModelsTable | undefined;

	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase, private _multiSelect: boolean = true) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder Register components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {

		this._formBuilder = modelBuilder.formContainer();
		this.localModelsComponent = new LocalModelsComponent(this._apiWrapper, this, this._multiSelect);
		this.localModelsComponent.registerComponent(modelBuilder);
		this.azureModelsComponent = new AzureModelsComponent(this._apiWrapper, this, this._multiSelect);
		this.azureModelsComponent.registerComponent(modelBuilder);
		this.registeredModelsComponent = new CurrentModelsTable(this._apiWrapper, this, this._multiSelect);
		this.registeredModelsComponent.registerComponent(modelBuilder);
		this.refresh();
		this._form = this._formBuilder.component();
		return this._form;
	}

	/**
	 * Returns selected data
	 */
	public get data(): ModelViewData[] {
		return this.modelsViewData;
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
			if (this.modelSourceType === ModelSourceType.Local) {
				if (this.localModelsComponent && this.azureModelsComponent && this.registeredModelsComponent) {
					this.azureModelsComponent.removeComponents(this._formBuilder);
					this.registeredModelsComponent.removeComponents(this._formBuilder);
					this.localModelsComponent.addComponents(this._formBuilder);
					await this.localModelsComponent.refresh();
				}

			} else if (this.modelSourceType === ModelSourceType.Azure) {
				if (this.localModelsComponent && this.azureModelsComponent && this.registeredModelsComponent) {
					this.localModelsComponent.removeComponents(this._formBuilder);
					this.azureModelsComponent.addComponents(this._formBuilder);
					this.registeredModelsComponent.removeComponents(this._formBuilder);
					await this.azureModelsComponent.refresh();
				}

			} else if (this.modelSourceType === ModelSourceType.RegisteredModels) {
				if (this.localModelsComponent && this.azureModelsComponent && this.registeredModelsComponent) {
					this.localModelsComponent.removeComponents(this._formBuilder);
					this.azureModelsComponent.removeComponents(this._formBuilder);
					this.registeredModelsComponent.addComponents(this._formBuilder);
					await this.registeredModelsComponent.refresh();
				}

			}
		}
	}

	/**
	 * Returns page title
	 */
	public get title(): string {
		return constants.modelSourcePageTitle;
	}

	public validate(): Promise<boolean> {
		let validated = false;
		if (this.modelSourceType === ModelSourceType.Local && this.localModelsComponent) {
			validated = this.localModelsComponent.data !== undefined && this.localModelsComponent.data.length > 0;

		} else if (this.modelSourceType === ModelSourceType.Azure && this.azureModelsComponent) {
			validated = this.azureModelsComponent.data !== undefined && this.azureModelsComponent.data.length > 0;

		} else if (this.modelSourceType === ModelSourceType.RegisteredModels && this.registeredModelsComponent) {
			validated = this.registeredModelsComponent.data !== undefined && this.registeredModelsComponent.data.length > 0;
		}
		if (!validated) {
			this.showErrorMessage(constants.invalidModelToSelectError);
		}
		return Promise.resolve(validated);
	}

	public async onLeave(): Promise<void> {
		this.modelsViewData = [];
		if (this.modelSourceType === ModelSourceType.Local && this.localModelsComponent) {
			if (this.localModelsComponent.data !== undefined && this.localModelsComponent.data.length > 0) {
				this.modelsViewData = this.localModelsComponent.data.map(x => {
					const fileName = utils.getFileName(x);
					return {
						modelData: x,
						modelDetails: {
							title: fileName,
							fileName: fileName
						}
					};
				});
			}

		} else if (this.modelSourceType === ModelSourceType.Azure && this.azureModelsComponent) {
			if (this.azureModelsComponent.data !== undefined && this.azureModelsComponent.data.length > 0) {
				this.modelsViewData = this.azureModelsComponent.data.map(x => {
					return {
						modelData: {
							account: x.account,
							subscription: x.subscription,
							group: x.group,
							workspace: x.workspace,
							model: x.model
						},
						modelDetails: {
							title: x.model?.name || '',
							fileName: x.model?.name
						}
					};
				});
			}

		} else if (this.modelSourceType === ModelSourceType.RegisteredModels && this.registeredModelsComponent) {
			if (this.registeredModelsComponent.data !== undefined) {
				this.modelsViewData = this.registeredModelsComponent.data.map(x => {
					return {
						modelData: x,
						modelDetails: {
							title: ''
						}
					};
				});
			}
		}
	}

	public async disposePage(): Promise<void> {
		if (this.azureModelsComponent) {
			await this.azureModelsComponent.disposeComponent();

		}
		if (this.registeredModelsComponent) {
			await this.registeredModelsComponent.disposeComponent();
		}
	}
}
