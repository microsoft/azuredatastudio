/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import * as constants from '../../common/constants';
import { ModelViewBase } from './modelViewBase';
import { CurrentModelsTable } from './currentModelsTable';
import { ApiWrapper } from '../../common/apiWrapper';

export class CurrentModelsTab extends ModelViewBase {

	private _installedLangsTab: azdata.window.DialogTab;

	private _locationComponent: azdata.TextComponent | undefined;
	private _tableComponent: azdata.DeclarativeTableComponent | undefined;
	private _dataTable: CurrentModelsTable | undefined;
	private _loader: azdata.LoadingComponent | undefined;

	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
		this._installedLangsTab = this._apiWrapper.createTab(constants.extLangInstallTabTitle);

		this._installedLangsTab.registerContent(async view => {

			// TODO: only supporting single location for now. We should add a drop down for multi locations mode
			//
			let locationTitle = await this.getLocationTitle();
			this._locationComponent = view.modelBuilder.text().withProperties({
				value: locationTitle
			}).component();

			this._dataTable = new CurrentModelsTable(apiWrapper, view.modelBuilder, this);
			this._tableComponent = this._dataTable.table;

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this._locationComponent,
					title: constants.extLangTarget
				}, {
					component: this._tableComponent,
					title: ''
				}]).component();

			this._loader = view.modelBuilder.loadingComponent()
				.withItem(formModel)
				.withProperties({
					loading: true
				}).component();

			await view.initializeModel(this._loader);
			await this.reset();
		});
	}

	public get tab(): azdata.window.DialogTab {
		return this._installedLangsTab;
	}

	private async onLoading(): Promise<void> {
		if (this._loader) {
			await this._loader.updateProperties({ loading: true });
		}
	}

	private async onLoaded(): Promise<void> {
		if (this._loader) {
			await this._loader.updateProperties({ loading: false });
		}
	}

	public async reset(): Promise<void> {
		await this.onLoading();

		try {
			await this._dataTable?.reset();
		} catch (err) {
			this.showErrorMessage(constants.getErrorMessage(err));
		} finally {
			await this.onLoaded();
		}
	}
}
