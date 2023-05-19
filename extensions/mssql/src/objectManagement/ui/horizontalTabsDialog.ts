/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';

const localize = nls.loadMessageBundle();

export class HorizontalTabsDialog {
	private generalTab: azdata.window.DialogTab;
	private memoryTab: azdata.window.DialogTab;
	private processorsTab: azdata.window.DialogTab;
	private securityTab: azdata.window.DialogTab;
	private databaseSettingsTab: azdata.window.DialogTab;
	private advancedTab: azdata.window.DialogTab;

	private dialog: azdata.window.Dialog;
	private newPackagesSearchBar: azdata.InputBoxComponent;
	private packagesSearchButton: azdata.ButtonComponent;
	private newPackagesNameLoader: azdata.LoadingComponent;
	private newPackagesVersionsLoader: azdata.LoadingComponent;
	private newPackagesSummaryLoader: azdata.LoadingComponent;
	private packageInstallButton: azdata.ButtonComponent;
	private installProgressSpinner: azdata.LoadingComponent;
	private _view: azdata.ModelView;

	constructor() {
		this.generalTab = azdata.window.createTab('General');
		this.memoryTab = azdata.window.createTab('Memory');
		this.processorsTab = azdata.window.createTab('Processors');
		this.securityTab = azdata.window.createTab('Security');
		this.databaseSettingsTab = azdata.window.createTab('Database Settings');
		this.advancedTab = azdata.window.createTab('Advanced');
		this.dialog = azdata.window.createModelViewDialog('Server Properties');



		this.generalTab.registerContent(async view => {
			this._view = view;
			const generalSection = this.createGeneralSection();
			let container: azdata.Component = view.modelBuilder.groupContainer().withLayout({ header: 'Platform', collapsible: true }).withItems(generalSection).component();
			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).withItems([container]).component(),
						title: ''
					}
				],
				{
					horizontal: false
				}
			);
			await view.initializeModel(formBuilder.component());

		});
		//


		// });

		this.memoryTab.registerContent(async view => {
			this.newPackagesSearchBar = view.modelBuilder.inputBox().withProps({ width: '400px' }).component();
			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.newPackagesSearchBar,
					title: ''
				}, {
					component: this.packagesSearchButton,
					title: ''
				}, {
					component: this.newPackagesNameLoader,
					title: localize('managePackages.packageNameTitle', "Package Name")
				}, {
					component: this.newPackagesSummaryLoader,
					title: localize('managePackages.packageSummaryTitle', "Package Summary")
				}, {
					component: this.newPackagesVersionsLoader,
					title: localize('managePackages.packageVersionTitle', "Supported Package Versions for Python {0}", '2.0')
				}, {
					component: this.packageInstallButton,
					title: ''
				}, {
					component: this.installProgressSpinner,
					title: ''
				}]).component();

			await view.initializeModel(formModel);
		});

		this.processorsTab.registerContent(async view => {
			this.newPackagesSearchBar = view.modelBuilder.inputBox().withProps({ width: '400px' }).component();
			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.newPackagesSearchBar,
					title: ''
				}, {
					component: this.packagesSearchButton,
					title: ''
				}, {
					component: this.newPackagesNameLoader,
					title: localize('managePackages.packageNameTitle', "Package Name")
				}, {
					component: this.newPackagesSummaryLoader,
					title: localize('managePackages.packageSummaryTitle', "Package Summary")
				}, {
					component: this.newPackagesVersionsLoader,
					title: localize('managePackages.packageVersionTitle', "Supported Package Versions for Python {0}", '2.0')
				}, {
					component: this.packageInstallButton,
					title: ''
				}, {
					component: this.installProgressSpinner,
					title: ''
				}]).component();

			await view.initializeModel(formModel);
		});

		this.securityTab.registerContent(async view => {
			this.newPackagesSearchBar = view.modelBuilder.inputBox().withProps({ width: '400px' }).component();
			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.newPackagesSearchBar,
					title: ''
				}, {
					component: this.packagesSearchButton,
					title: ''
				}, {
					component: this.newPackagesNameLoader,
					title: localize('managePackages.packageNameTitle', "Package Name")
				}, {
					component: this.newPackagesSummaryLoader,
					title: localize('managePackages.packageSummaryTitle', "Package Summary")
				}, {
					component: this.newPackagesVersionsLoader,
					title: localize('managePackages.packageVersionTitle', "Supported Package Versions for Python {0}", '2.0')
				}, {
					component: this.packageInstallButton,
					title: ''
				}, {
					component: this.installProgressSpinner,
					title: ''
				}]).component();

			await view.initializeModel(formModel);
		});

		this.databaseSettingsTab.registerContent(async view => {
			this.newPackagesSearchBar = view.modelBuilder.inputBox().withProps({ width: '400px' }).component();
			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.newPackagesSearchBar,
					title: ''
				}, {
					component: this.packagesSearchButton,
					title: ''
				}, {
					component: this.newPackagesNameLoader,
					title: localize('managePackages.packageNameTitle', "Package Name")
				}, {
					component: this.newPackagesSummaryLoader,
					title: localize('managePackages.packageSummaryTitle', "Package Summary")
				}, {
					component: this.newPackagesVersionsLoader,
					title: localize('managePackages.packageVersionTitle', "Supported Package Versions for Python {0}", '2.0')
				}, {
					component: this.packageInstallButton,
					title: ''
				}, {
					component: this.installProgressSpinner,
					title: ''
				}]).component();

			await view.initializeModel(formModel);
		});

		this.advancedTab.registerContent(async view => {
			this.newPackagesSearchBar = view.modelBuilder.inputBox().withProps({ width: '400px' }).component();
			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.newPackagesSearchBar,
					title: ''
				}, {
					component: this.packagesSearchButton,
					title: ''
				}, {
					component: this.newPackagesNameLoader,
					title: localize('managePackages.packageNameTitle', "Package Name")
				}, {
					component: this.newPackagesSummaryLoader,
					title: localize('managePackages.packageSummaryTitle', "Package Summary")
				}, {
					component: this.newPackagesVersionsLoader,
					title: localize('managePackages.packageVersionTitle', "Supported Package Versions for Python {0}", '2.0')
				}, {
					component: this.packageInstallButton,
					title: ''
				}, {
					component: this.installProgressSpinner,
					title: ''
				}]).component();

			await view.initializeModel(formModel);
		});

		this.dialog.content = [this.generalTab, this.memoryTab, this.processorsTab, this.securityTab, this.databaseSettingsTab, this.advancedTab];
		azdata.window.openDialog(this.dialog);
	}

	private createGeneralSection(): azdata.Component[] {
		const language = this._view.modelBuilder.inputBox().withProps({ width: '400px' }).component();
		const labelLanguageComponent = this._view.modelBuilder.text().withProps({ value: 'Language', requiredIndicator: language.required }).component();
		const memory = this._view.modelBuilder.inputBox().withProps({ width: '400px' }).component();
		const labelMemoryComponent = this._view.modelBuilder.text().withProps({ value: 'Memory', requiredIndicator: memory.required }).component();
		const operatingSystem = this._view.modelBuilder.inputBox().withProps({ width: '400px' }).component();
		const labelOSComponent = this._view.modelBuilder.text().withProps({ value: 'OS', requiredIndicator: operatingSystem.required }).component();
		const platform = this._view.modelBuilder.inputBox().withProps({ width: '400px' }).component();
		const labelPlatformComponent = this._view.modelBuilder.text().withProps({ value: 'Platform', requiredIndicator: platform.required }).component();


		// return [
		// 	{title: 'Language', component: language},
		// 	{title: 'Memory', component: memory},
		// 	{title: 'Operating System', component: operatingSystem},
		// 	{title: 'Platform', component: platform}];
		return [labelLanguageComponent, language, labelMemoryComponent, memory, labelOSComponent, operatingSystem, labelPlatformComponent, platform];
	}

}
