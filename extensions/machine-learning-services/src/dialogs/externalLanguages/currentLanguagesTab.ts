/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import * as constants from '../../common/constants';
import { LanguageDialogBase } from './languageDialogBase';
import { LanguagesTable } from './languagesTable';
import { LanguagesDialogModel } from './languagesDialogModel';

export class CurrentLanguagesTab extends LanguageDialogBase {

	private _installedLangsTab: azdata.window.DialogTab;

	private _locationComponent: azdata.TextComponent | undefined;
	private _installLanguagesTable: azdata.DeclarativeTableComponent | undefined;
	private _languageTable: LanguagesTable | undefined;
	private _loader: azdata.LoadingComponent | undefined;

	constructor(parent: LanguageDialogBase, model: LanguagesDialogModel) {
		super(model, parent);
		this._installedLangsTab = azdata.window.createTab(constants.extLangInstallTabTitle);

		this._installedLangsTab.registerContent(async view => {

			// TODO: only supporting single location for now. We should add a drop down for multi locations mode
			//
			let locationTitle = await this._model.getLocationTitle();
			this._locationComponent = view.modelBuilder.text().withProperties({
				value: locationTitle
			}).component();

			this._languageTable = new LanguagesTable(view.modelBuilder, this, model);
			this._installLanguagesTable = this._languageTable.table;

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this._locationComponent,
					title: constants.extLangTarget
				}, {
					component: this._installLanguagesTable,
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
			await this._languageTable?.reset();
		} catch (err) {
			this.showErrorMessage(constants.getErrorMessage(err));
		} finally {
			await this.onLoaded();
		}
	}
}
