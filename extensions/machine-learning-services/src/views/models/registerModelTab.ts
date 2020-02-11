/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../common/constants';
import { ApiWrapper } from '../../common/apiWrapper';
import { ModelViewBase } from './modelViewBase';
import { AzureModelsComponent } from './azureModelsComponent';

export class RegisterModelTab extends ModelViewBase {
	private _dialogTab: azdata.window.DialogTab;
	public azureModelsComponent: AzureModelsComponent | undefined;
	private _amlModel: azdata.RadioButtonComponent | undefined;
	private _localModel: azdata.RadioButtonComponent | undefined;
	private _localGroup: azdata.GroupContainer | undefined;
	private _amlGroup: azdata.GroupContainer | undefined;
	//private _isLocalModel: boolean = true;
	private _localPath: azdata.InputBoxComponent | undefined;
	private _localBrowse: azdata.ButtonComponent | undefined;

	constructor(
		apiWrapper: ApiWrapper,
		parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
		this._dialogTab = apiWrapper.createTab(constants.extLangNewLanguageTabTitle);
		this._dialogTab.registerContent(async view => {
			this._localModel = view.modelBuilder.radioButton()
				.withProperties({
					value: 'local',
					name: 'modelLocation',
					label: constants.extLangLocal,
					checked: true
				}).component();

			this._localPath = view.modelBuilder.inputBox().withProperties({
			}).component();
			this._localBrowse = view.modelBuilder.button().withProperties({

			}).component();
			this._localGroup = view.modelBuilder.groupContainer().withItems([
				this._localPath, this._localBrowse
			]).component();

			this._amlModel = view.modelBuilder.radioButton()
				.withProperties({
					value: 'aml',
					name: 'modelLocation',
					label: 'Azure Models',
				}).component();

			this._localModel.onDidClick(() => {
				//this._isLocalModel = true;
			});
			this._amlModel.onDidClick(() => {
				//this._isLocalModel = false;
			});
			this.azureModelsComponent = new AzureModelsComponent(this._apiWrapper, view.modelBuilder, this);
			//await this.azureModelsComponent.loadData();

			this._amlGroup = view.modelBuilder.groupContainer().withItems([
				this.azureModelsComponent.component
			]).component();

			let formBuilder = view.modelBuilder.formContainer().withFormItems([{
				title: '',
				component: this._localModel
			},
			{
				title: '',
				component: this._localGroup
			},
			{
				title: '',
				component: this._amlModel
			},
			{
				title: '',
				component: this._amlGroup
			}]);

			await view.initializeModel(formBuilder.component());
			await this.reset();
		});
	}

	public get tab(): azdata.window.DialogTab {
		return this._dialogTab;
	}

	public async reset(): Promise<void> {
		await this.azureModelsComponent?.reset();
	}
}
