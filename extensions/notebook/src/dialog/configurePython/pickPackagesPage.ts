/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { BasePage } from './basePage';
import { JupyterServerInstallation } from '../../jupyter/jupyterServerInstallation';
import { python3DisplayName, pysparkDisplayName, sparkScalaDisplayName, sparkRDisplayName, powershellDisplayName, allKernelsName } from '../../common/constants';
import { getDropdownValue } from '../../common/utils';

const localize = nls.loadMessageBundle();

interface RequiredPackageInfo {
	name: string;
	existingVersion: string;
	requiredVersion: string;
}

namespace cssStyles {
	export const tableHeader = { 'text-align': 'left', 'font-weight': 'lighter', 'font-size': '10px', 'user-select': 'text', 'border': 'none' };
	export const tableRow = { 'border-top': 'solid 1px #ccc', 'border-bottom': 'solid 1px #ccc', 'border-left': 'none', 'border-right': 'none' };
}

export class PickPackagesPage extends BasePage {
	private kernelLabel: azdata.TextComponent | undefined;
	private kernelDropdown: azdata.DropDownComponent | undefined;
	private requiredPackagesTable: azdata.DeclarativeTableComponent;
	private packageTableSpinner: azdata.LoadingComponent;

	private packageVersionRetrieval: Promise<void>;
	private packageVersionMap = new Map<string, string>();

	public async initialize(): Promise<boolean> {
		if (this.model.kernelName) {
			// Wizard was started for a specific kernel, so don't populate any other options
			this.kernelLabel = this.view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
				value: this.model.kernelName
			}).component();
		} else {
			let dropdownValues = [python3DisplayName, pysparkDisplayName, sparkScalaDisplayName, sparkRDisplayName, powershellDisplayName, allKernelsName];
			this.kernelDropdown = this.view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
				value: dropdownValues[0],
				values: dropdownValues,
				width: '300px'
			}).component();
			this.kernelDropdown.onValueChanged(async value => {
				await this.updateRequiredPackages(value.selected);
			});
		}

		let nameColumn = localize('configurePython.pkgNameColumn', "Name");
		let existingVersionColumn = localize('configurePython.existingVersionColumn', "Existing Version");
		let requiredVersionColumn = localize('configurePython.requiredVersionColumn', "Required Version");
		this.requiredPackagesTable = this.view.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			columns: [{
				displayName: nameColumn,
				ariaLabel: nameColumn,
				valueType: azdata.DeclarativeDataType.string,
				isReadOnly: true,
				width: '200px',
				headerCssStyles: {
					...cssStyles.tableHeader
				},
				rowCssStyles: {
					...cssStyles.tableRow
				}
			}, {
				displayName: existingVersionColumn,
				ariaLabel: existingVersionColumn,
				valueType: azdata.DeclarativeDataType.string,
				isReadOnly: true,
				width: '200px',
				headerCssStyles: {
					...cssStyles.tableHeader
				},
				rowCssStyles: {
					...cssStyles.tableRow
				}
			}, {
				displayName: requiredVersionColumn,
				ariaLabel: requiredVersionColumn,
				valueType: azdata.DeclarativeDataType.string,
				isReadOnly: true,
				width: '200px',
				headerCssStyles: {
					...cssStyles.tableHeader
				},
				rowCssStyles: {
					...cssStyles.tableRow
				}
			}],
			data: [[]]
		}).component();

		this.packageTableSpinner = this.view.modelBuilder.loadingComponent().withItem(this.requiredPackagesTable).component();

		let formModel = this.view.modelBuilder.formContainer()
			.withFormItems([{
				component: this.kernelDropdown ?? this.kernelLabel,
				title: localize('configurePython.kernelLabel', "Kernel")
			}, {
				component: this.packageTableSpinner,
				title: localize('configurePython.requiredDependencies', "Install required kernel dependencies")
			}]).component();
		await this.view.initializeModel(formModel);
		return true;
	}

	public async onPageEnter(): Promise<void> {
		this.packageVersionMap.clear();
		let pythonExe = JupyterServerInstallation.getPythonExePath(this.model.pythonLocation, this.model.useExistingPython);
		this.packageVersionRetrieval = this.model.installation.getInstalledPipPackages(pythonExe)
			.then(installedPackages => {
				if (installedPackages) {
					installedPackages.forEach(pkg => {
						this.packageVersionMap.set(pkg.name, pkg.version);
					});
				}
			});

		if (this.kernelDropdown) {
			if (this.model.kernelName) {
				this.kernelDropdown.value = this.model.kernelName;
			} else {
				this.model.kernelName = getDropdownValue(this.kernelDropdown);
			}
		}
		await this.updateRequiredPackages(this.model.kernelName);
	}

	public async onPageLeave(): Promise<boolean> {
		return !this.packageTableSpinner.loading;
	}

	private async updateRequiredPackages(kernelName: string): Promise<void> {
		this.instance.wizard.doneButton.enabled = false;
		this.packageTableSpinner.loading = true;
		try {
			// Fetch list of required packages for the specified kernel
			let requiredPkgVersions: RequiredPackageInfo[] = [];
			let requiredPackages = this.model.installation.getRequiredPackagesForKernel(kernelName);
			requiredPackages.forEach(pkg => {
				requiredPkgVersions.push({ name: pkg.name, existingVersion: undefined, requiredVersion: pkg.version });
			});

			// For each required package, check if there is another version of that package already installed
			await this.packageVersionRetrieval;
			requiredPkgVersions.forEach(pkgVersion => {
				let installedPackageVersion = this.packageVersionMap.get(pkgVersion.name);
				if (installedPackageVersion) {
					pkgVersion.existingVersion = installedPackageVersion;
				}
			});

			if (requiredPkgVersions.length > 0) {
				this.requiredPackagesTable.data = requiredPkgVersions.map(pkg => [pkg.name, pkg.existingVersion ?? '-', pkg.requiredVersion]);
				this.model.packagesToInstall = requiredPackages;
			} else {
				this.instance.showErrorMessage(localize('msgUnsupportedKernel', "Could not retrieve packages for kernel {0}", kernelName));
				this.requiredPackagesTable.data = [['-', '-', '-']];
				this.model.packagesToInstall = undefined;
			}
		} finally {
			this.instance.wizard.doneButton.enabled = true;
			this.packageTableSpinner.loading = false;
		}
	}
}
