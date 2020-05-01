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

export class PickPackagesPage extends BasePage {
	private kernelLabel: azdata.TextComponent | undefined;
	private kernelDropdown: azdata.DropDownComponent | undefined;
	private requiredPackagesTable: azdata.DeclarativeTableComponent;

	public async start(): Promise<boolean> {
		if (this.model.kernelName) {
			// Wizard was started for a specific kernel, so don't populate any other options
			this.kernelLabel = this.view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
				value: this.model.kernelName
			}).component();
		} else {
			let dropdownValues = [python3DisplayName, pysparkDisplayName, sparkScalaDisplayName, sparkRDisplayName, powershellDisplayName, allKernelsName];
			this.kernelDropdown = this.view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
				value: dropdownValues[0],
				values: dropdownValues
			}).component();
			this.kernelDropdown.onValueChanged(value => {
				this.updateRequiredPackages(value.selected);
			});
		}

		this.requiredPackagesTable = this.view.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			columns: [{
				displayName: localize('configurePython.pkgNameColumn', "Name"),
				valueType: azdata.DeclarativeDataType.string,
				isReadOnly: true,
				width: '200px'
			}, {
				displayName: localize('configurePython.pkgVersionColumn', "Version"),
				valueType: azdata.DeclarativeDataType.string,
				isReadOnly: true,
				width: '200px'
			}],
			data: [[]]
		}).component();

		let formModel = this.view.modelBuilder.formContainer()
			.withFormItems([{
				component: this.kernelDropdown ?? this.kernelLabel,
				title: localize('configurePython.kernelLabel', "Kernel")
			}, {
				component: this.requiredPackagesTable,
				title: localize('configurePython.requiredDependencies', "Required kernel dependencies")
			}]).component();
		await this.view.initializeModel(formModel);
		return true;
	}

	public async onPageEnter(): Promise<boolean> {
		if (this.kernelDropdown) {
			if (this.model.kernelName) {
				this.kernelDropdown.value = this.model.kernelName;
			} else {
				this.model.kernelName = getDropdownValue(this.kernelDropdown);
			}
		}
		this.updateRequiredPackages(this.model.kernelName);
		return true;
	}

	public async onPageLeave(): Promise<boolean> {
		return true;
	}

	private updateRequiredPackages(kernelName: string): void {
		let requiredPackages = JupyterServerInstallation.getRequiredPackagesForKernel(kernelName);
		if (requiredPackages) {
			let packageData = requiredPackages.map(pkg => [pkg.name, pkg.version]);
			this.requiredPackagesTable.data = packageData;
			this.model.packagesToInstall = requiredPackages;
		} else {
			this.instance.showErrorMessage(localize('msgUnsupportedKernel', "Could not retrieve packages for unsupported kernel {0}", kernelName));
			this.requiredPackagesTable.data = [['-', '-']];
			this.model.packagesToInstall = undefined;
		}
	}
}
