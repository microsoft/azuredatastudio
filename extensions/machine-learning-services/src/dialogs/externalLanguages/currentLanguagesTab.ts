/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';

import * as constants from '../../common/constants';
import { ExternalLanguageDialogBase } from './externalLanguageDialogBase';
import { ExternalLanguagesTable } from './externalLanguagesTable';

const localize = nls.loadMessageBundle();

export class CurrentLanguagesTab {

	private installedPkgTab: azdata.window.DialogTab;

	private locationComponent: azdata.TextComponent | undefined;
	private installedPackagesTable: azdata.DeclarativeTableComponent | undefined;
	private installedPackagesLoader: azdata.LoadingComponent | undefined;

	constructor(private dialog: ExternalLanguageDialogBase) {
		this.installedPkgTab = azdata.window.createTab(constants.extLangInstallTabTitle);

		this.installedPkgTab.registerContent(async view => {

			// TODO: only supporting single location for now. We should add a drop down for multi locations mode
			//
			let locationTitle = await this.dialog.model.getLocationTitle();
			this.locationComponent = view.modelBuilder.text().withProperties({
				value: locationTitle
			}).component();

			let table = new ExternalLanguagesTable(view.modelBuilder, this.dialog.model);
			this.installedPackagesTable = table.table;

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.locationComponent,
					title: localize('managePackages.location', "Location")
				}, {
					component: this.installedPackagesTable,
					title: ''
				}]).component();

			this.installedPackagesLoader = view.modelBuilder.loadingComponent()
				.withItem(formModel)
				.withProperties({
					loading: true
				}).component();

			await view.initializeModel(this.installedPackagesLoader);

			await this.loadInstalledPackagesInfo(table);
		});
	}

	public get tab(): azdata.window.DialogTab {
		return this.installedPkgTab;
	}

	private async onLoading(): Promise<void> {
		if (this.installedPackagesLoader) {
			await this.installedPackagesLoader.updateProperties({ loading: true });
		}
	}

	private async onLoaded(): Promise<void> {
		if (this.installedPackagesLoader) {
			await this.installedPackagesLoader.updateProperties({ loading: false });
		}
	}

	public async loadInstalledPackagesInfo(table: ExternalLanguagesTable): Promise<void> {
		await this.onLoading();

		try {
			await table.loadData();
		} catch (err) {
			this.dialog.showErrorMessage(constants.getErrorMessage(err));
		} finally {
			await this.onLoaded();
		}
	}
}
