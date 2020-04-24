/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { BasePage } from './basePage';
import { JupyterServerInstallation } from '../../jupyter/jupyterServerInstallation';

const localize = nls.loadMessageBundle();

export class PickPackagesPage extends BasePage {
	private kernelDropdown: azdata.DropDownComponent;
	private requiredPackagesTable: azdata.DeclarativeTableComponent;

	public async start(): Promise<boolean> {
		let dropdownValues = ['Python 3', 'PySpark', 'Spark | Scala', 'Spark | R', 'PowerShell'];
		this.kernelDropdown = this.view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
			value: dropdownValues[0],
			values: dropdownValues
		}).component();
		this.kernelDropdown.onValueChanged(value => {
			this.updateRequiredPackages(value.selected);
		});

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
				component: this.kernelDropdown,
				title: localize('configurePython.kernelLabel', "Kernel")
			}, {
				component: this.requiredPackagesTable,
				title: localize('configurePython.requiredDependencies', "Install required kernel dependencies")
			}]).component();
		await this.view.initializeModel(formModel);
		return true;
	}

	public async onPageEnter(): Promise<boolean> {
		this.kernelDropdown.value = this.model.kernelName;
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
		} else {
			this.instance.showErrorMessage(localize('msgUnsupportedKernel', "Could not retrieve packages for unsupported kernel {0}", kernelName));
			this.requiredPackagesTable.data = [['-', '-']];
		}
	}
}
