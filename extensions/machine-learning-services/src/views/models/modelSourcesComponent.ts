/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase, SourceModelSelectedEventName } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';
import { IPageView, IDataComponent } from '../interfaces';

export enum ModelSourceType {
	Local,
	Azure
}
/**
 * View tp pick model source
 */
export class ModelSourcesComponent extends ModelViewBase implements IPageView, IDataComponent<ModelSourceType> {

	private _form: azdata.FormContainer | undefined;
	private _amlModel: azdata.RadioButtonComponent | undefined;
	private _localModel: azdata.RadioButtonComponent | undefined;
	private _isLocalModel: boolean = true;

	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase) {
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
				checked: true
			}).component();


		this._amlModel = modelBuilder.radioButton()
			.withProperties({
				value: 'aml',
				name: 'modelLocation',
				label: constants.azureModelSource,
			}).component();

		this._localModel.onDidClick(() => {
			this._isLocalModel = true;
			this.sendRequest(SourceModelSelectedEventName);

		});
		this._amlModel.onDidClick(() => {
			this._isLocalModel = false;
			this.sendRequest(SourceModelSelectedEventName);
		});

		let flex = modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column',
				justifyContent: 'space-between'
			}).withItems([
				this._localModel, this._amlModel]
			).component();

		this._form = modelBuilder.formContainer().withFormItems([{
			title: constants.modelSourcesTitle,
			component: flex
		}]).component();
		return this._form;
	}

	/**
	 * Returns selected data
	 */
	public get data(): ModelSourceType {
		return this._isLocalModel ? ModelSourceType.Local : ModelSourceType.Azure;
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
		return constants.modelSourcesTitle;
	}
}
