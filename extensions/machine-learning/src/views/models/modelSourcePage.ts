/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase, ModelSourceType } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';
import { IPageView, IDataComponent } from '../interfaces';
import { ModelSourcesComponent } from './modelSourcesComponent';

/**
 * View to pick model source
 */
export class ModelSourcePage extends ModelViewBase implements IPageView, IDataComponent<ModelSourceType> {

	private _form: azdata.FormContainer | undefined;
	private _formBuilder: azdata.FormBuilder | undefined;
	public modelResources: ModelSourcesComponent | undefined;

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
		this.modelResources.addComponents(this._formBuilder);
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
	}

	/**
	 * Returns page title
	 */
	public get title(): string {
		return constants.modelSourcePageTitle;
	}

	public async disposePage(): Promise<void> {
	}
}
