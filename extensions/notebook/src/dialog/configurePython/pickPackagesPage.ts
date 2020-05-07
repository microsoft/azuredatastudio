/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { BasePage } from './basePage';
import { JupyterServerInstallation, PythonPkgDetails } from '../../jupyter/jupyterServerInstallation';
import { python3DisplayName, pysparkDisplayName, sparkScalaDisplayName, sparkRDisplayName, powershellDisplayName, allKernelsName } from '../../common/constants';
import { getDropdownValue } from '../../common/utils';

const localize = nls.loadMessageBundle();

export class PickPackagesPage extends BasePage {
	private kernelLabel: azdata.TextComponent | undefined;
	private kernelDropdown: azdata.DropDownComponent | undefined;
	private requiredPackagesTable: azdata.DeclarativeTableComponent;
	private packageTableSpinner: azdata.LoadingComponent;

	private installedPackagesPromise: Promise<PythonPkgDetails[]>;
	private installedPackages: PythonPkgDetails[];

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

		this.requiredPackagesTable = this.view.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			columns: [{
				displayName: localize('configurePython.pkgNameColumn', "Name"),
				valueType: azdata.DeclarativeDataType.string,
				isReadOnly: true,
				width: '200px'
			}, {
				displayName: localize('configurePython.existingVersionColumn', "Existing Version"),
				valueType: azdata.DeclarativeDataType.string,
				isReadOnly: true,
				width: '200px'
			}, {
				displayName: localize('configurePython.requiredVersionColumn', "Required Version"),
				valueType: azdata.DeclarativeDataType.string,
				isReadOnly: true,
				width: '200px'
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
		let pythonExe = JupyterServerInstallation.getPythonExePath(this.model.pythonLocation, this.model.useExistingPython);
		this.installedPackagesPromise = this.model.installation.getInstalledPipPackages(pythonExe);
		this.installedPackages = undefined;

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
		return true;
	}

	private async updateRequiredPackages(kernelName: string): Promise<void> {
		this.packageTableSpinner.loading = true;
		try {
			let pkgVersionMap = new Map<string, { currentVersion: string, newVersion: string }>();

			// Fetch list of required packages for the specified kernel
			let requiredPackages = JupyterServerInstallation.getRequiredPackagesForKernel(kernelName);
			requiredPackages.forEach(pkg => {
				pkgVersionMap.set(pkg.name, { currentVersion: undefined, newVersion: pkg.version });
			});

			// For each required package, check if there is another version of that package already installed
			if (!this.installedPackages) {
				this.installedPackages = await this.installedPackagesPromise;
			}
			this.installedPackages.forEach(pkg => {
				let info = pkgVersionMap.get(pkg.name);
				if (info) {
					info.currentVersion = pkg.version;
					pkgVersionMap.set(pkg.name, info);
				}
			});

			if (pkgVersionMap.size > 0) {
				let packageData = [];
				for (let [key, value] of pkgVersionMap.entries()) {
					packageData.push([key, value.currentVersion ?? '-', value.newVersion]);
				}
				this.requiredPackagesTable.data = packageData;
				this.model.packagesToInstall = requiredPackages;
			} else {
				this.instance.showErrorMessage(localize('msgUnsupportedKernel', "Could not retrieve packages for unsupported kernel {0}", kernelName));
				this.requiredPackagesTable.data = [['-', '-', '-']];
				this.model.packagesToInstall = undefined;
			}
		} finally {
			this.packageTableSpinner.loading = false;
		}
	}
}
