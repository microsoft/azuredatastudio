/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { WizardPageBase } from '../../wizardPageBase';
import { DeployAzureSQLVMWizard } from '../deployAzureSQLVMWizard';

export class AzureSQLVMSummaryPage extends WizardPageBase<DeployAzureSQLVMWizard> {

	private _form!: azdata.FormContainer;

	constructor(wizard: DeployAzureSQLVMWizard) {
		super(
			'Summary Page',
			'',
			wizard
		);

	}

	public async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {



			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
					],
					{
						horizontal: false,
						componentWidth: '100%'
					})
				.withLayout({ width: '100%' })
				.component();

			return view.initializeModel(this._form);
		});
	}

	public async onEnter(): Promise<void> {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	public onLeave(): void {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}
}
