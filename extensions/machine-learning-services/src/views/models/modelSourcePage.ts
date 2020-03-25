/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';
import { IPageView, IDataComponent } from '../interfaces';
import { ModelSourcesComponent, ModelSourceType } from './modelSourcesComponent';
import { LocalModelsComponent } from './localModelsComponent';
import { AzureModelsComponent } from './azureModelsComponent';
import { CurrentModelsTable } from './registerModels/currentModelsTable';

/**
 * View to pick model source
 */
export class ModelSourcePage extends ModelViewBase implements IPageView, IDataComponent<ModelSourceType> {

	private _form: azdata.FormContainer | undefined;
	private _formBuilder: azdata.FormBuilder | undefined;
	public modelResources: ModelSourcesComponent | undefined;
	public localModelsComponent: LocalModelsComponent | undefined;
	public azureModelsComponent: AzureModelsComponent | undefined;
	public registeredModelsComponent: CurrentModelsTable | undefined;

	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase, private _options: ModelSourceType[] = [ModelSourceType.Local, ModelSourceType.Azure]) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder Register components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {

		this._formBuilder = modelBuilder.formContainer();
		this.modelResources = new ModelSourcesComponent(this._apiWrapper, this, this._options);
		this.modelResources.registerComponent(modelBuilder);
		this.localModelsComponent = new LocalModelsComponent(this._apiWrapper, this);
		this.localModelsComponent.registerComponent(modelBuilder);
		this.azureModelsComponent = new AzureModelsComponent(this._apiWrapper, this);
		this.azureModelsComponent.registerComponent(modelBuilder);
		this.modelResources.addComponents(this._formBuilder);
		this.registeredModelsComponent = new CurrentModelsTable(this._apiWrapper, this);
		this.registeredModelsComponent.registerComponent(modelBuilder);
		this.refresh();
		this._form = this._formBuilder.component();
		return this._form;
	}

	/**
	 * Returns selected data
	 */
	public get data(): ModelSourceType {
		return this.modelResources?.data || ModelSourceType.Local;
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
			if (this.modelResources && this.modelResources.data === ModelSourceType.Local) {
				if (this.localModelsComponent && this.azureModelsComponent && this.registeredModelsComponent) {
					this.azureModelsComponent.removeComponents(this._formBuilder);
					this.registeredModelsComponent.removeComponents(this._formBuilder);
					this.localModelsComponent.addComponents(this._formBuilder);
					await this.localModelsComponent.refresh();
				}

			} else if (this.modelResources && this.modelResources.data === ModelSourceType.Azure) {
				if (this.localModelsComponent && this.azureModelsComponent && this.registeredModelsComponent) {
					this.localModelsComponent.removeComponents(this._formBuilder);
					this.azureModelsComponent.addComponents(this._formBuilder);
					this.registeredModelsComponent.removeComponents(this._formBuilder);
					await this.azureModelsComponent.refresh();
				}

			} else if (this.modelResources && this.modelResources.data === ModelSourceType.RegisteredModels) {
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
		if (this.modelResources && this.modelResources.data === ModelSourceType.Local && this.localModelsComponent) {
			validated = this.localModelsComponent.data !== undefined && this.localModelsComponent.data.length > 0;

		} else if (this.modelResources && this.modelResources.data === ModelSourceType.Azure && this.azureModelsComponent) {
			validated = this.azureModelsComponent.data !== undefined && this.azureModelsComponent.data.model !== undefined;

		} else if (this.modelResources && this.modelResources.data === ModelSourceType.RegisteredModels && this.registeredModelsComponent) {
			validated = this.registeredModelsComponent.data !== undefined;
		}
		if (!validated) {
			this.showErrorMessage(constants.invalidModelToSelectError);
		}
		return Promise.resolve(validated);
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
