/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { BasePage } from './configurePythonPage';
import { JupyterServerInstallation } from '../../jupyter/jupyterServerInstallation';

const localize = nls.loadMessageBundle();

export class PickPackagesPage extends BasePage {
	private kernelLabel: azdata.TextComponent;
	private requiredPackagesTable: azdata.TableComponent;
	private optionalDependencies: azdata.TextComponent;

	public async start(): Promise<boolean> {
		this.kernelLabel = this.view.modelBuilder.text().component();
		this.requiredPackagesTable = this.view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
			columns: [
				localize('configurePython.pkgNameColumn', "Name"),
				localize('configurePython.pkgVersionColumn', "Version")
			],
			data: [[]],
			width: '400px'
		}).component();
		this.optionalDependencies = this.view.modelBuilder.text().component();
		let formModel = this.view.modelBuilder.formContainer()
			.withFormItems([{
				component: this.kernelLabel,
				title: localize('configurePython.kernelLabel', "Kernel")
			}, {
				component: this.requiredPackagesTable,
				title: localize('configurePython.requiredDependencies', "Install required kernel dependencies")
			}, {
				component: this.optionalDependencies,
				title: localize('configurePython.optionalDependencies', "Install optional dependencies")
			}]).component();
		await this.view.initializeModel(formModel);
		return true;
	}

	public async onPageEnter(): Promise<boolean> {
		await this.kernelLabel.updateProperties({
			value: this.model.kernelName
		});

		let requiredPackages = JupyterServerInstallation.getRequiredPackagesForKernel(this.model.kernelName);
		if (!requiredPackages) {
			this.instance.showErrorMessage(localize('msgUnsupportedKernel', "Could not retrieve packages for unsupported kernel {0}", this.model.kernelName));
			await this.requiredPackagesTable.updateProperties({ data: [['-', '-']] });
			return false;
		}
		let packageData = requiredPackages.map(pkg => [pkg.name, pkg.version]);
		await this.requiredPackagesTable.updateProperties({
			data: packageData
		});

		await this.optionalDependencies.updateProperties({
			value: 'Test'
		});
		return true;
	}

	public async onPageLeave(): Promise<boolean> {
		return true;
	}
}
