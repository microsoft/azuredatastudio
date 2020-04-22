/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { BasePage } from './configurePythonPage';

const localize = nls.loadMessageBundle();

export class PickPackagesPage extends BasePage {

	public async start(): Promise<boolean> {
		let kernelLabel = this.view.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: this.model.kernelName
			}).component();

		let requiredDependencies = this.view.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: 'Test'
			}).component();

		let optionalDependencies = this.view.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: 'Test'
			}).component();

		let formModel = this.view.modelBuilder.formContainer()
			.withFormItems([{
				component: kernelLabel,
				title: localize('configurePython.kernelLabel', "Kernel")
			}, {
				component: requiredDependencies,
				title: localize('configurePython.requiredDependencies', "Install required kernel dependencies")
			}, {
				component: optionalDependencies,
				title: localize('configurePython.optionalDependencies', "Install optional dependencies")
			}]).component();

		await this.view.initializeModel(formModel);

		return true;
	}

	public async onPageEnter(): Promise<boolean> {
		return true;
	}

	public async onPageLeave(): Promise<boolean> {
		return true;
	}
}
