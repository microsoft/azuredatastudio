/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { WizardPageBase } from '../../wizardPageBase';
import { DeployAzureSQLVMWizard } from '../deployAzureSQLVMWizard';
import * as constants from '../constants';

export class NetworkSettingsPage extends WizardPageBase<DeployAzureSQLVMWizard> {

	// dropdown for virtual network
	private _virtualNetworkDropdown!: azdata.DropDownComponent;
	private __virtualNetworkDropdownLoader!: azdata.LoadingComponent;

	// dropdown for public network
	private _publicIPDropdown!: azdata.DropDownComponent;
	private _publicIPDropdownLoader!: azdata.LoadingComponent;

	// checkbox for RDP
	private _vmRDPAllowCheckbox!: azdata.CheckBoxComponent;

	private _form!: azdata.FormContainer;

	constructor(wizard: DeployAzureSQLVMWizard) {
		super(
			constants.NetworkSettingsPageTitle,
			constants.NetworkSettingsPageDescription,
			wizard
		);
	}

	public async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {

			await this.createVirtualNetworkDropdown(view);
			await this.createPublicIPDropdown(view);
			await this.createVmRDPAllowCheckbox(view);


			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{
							title: constants.VirtualNetworkDropdownLabel,
							component: this.__virtualNetworkDropdownLoader
						},
						{
							title: constants.PublicIPDropdownLabel,
							component: this._publicIPDropdownLoader
						},
						{
							component: this._vmRDPAllowCheckbox
						}
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
		this.populateVirtualNetworkDropdown();
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	public onLeave(): void {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	private async createVirtualNetworkDropdown(view: azdata.ModelView) {
		this._virtualNetworkDropdown = view.modelBuilder.dropDown().withProperties({
			required: true,
			editable: true,

		}).component();

		this._virtualNetworkDropdown.fireOnTextChange = true;

		this._virtualNetworkDropdown.onValueChanged((value) => {
			console.log(value);
			//this.wizard.model.vmImageSKU = (this._virtualNetworkDropdown.value as azdata.CategoryValue).name;
		});

		this.__virtualNetworkDropdownLoader = view.modelBuilder.loadingComponent().withItem(this._virtualNetworkDropdown).component();
	}

	private async populateVirtualNetworkDropdown() {
		this.__virtualNetworkDropdownLoader.loading = true;
		let url = `https://management.azure.com` +
			`/subscriptions/${this.wizard.model.azureSubscription}` +
			`/providers/Microsoft.Network/virtualNetworks?api-version=2020-05-01`;

		let response = await this.wizard.getRequest(url);

		console.log(response);

		// this._vmImageVersionDropdown.updateProperties({
		// 	values: response.data.value.map((value: any) => {
		// 		return {
		// 			name: value.id,
		// 			displayName: value.id
		// 		};
		// 	})
		// });
		// this.wizard.model.vmImageVersion = (this._vmImageVersionDropdown.value as azdata.CategoryValue).name;
		this.__virtualNetworkDropdownLoader.loading = false;
	}

	private async createPublicIPDropdown(view: azdata.ModelView) {
		this._publicIPDropdown = view.modelBuilder.dropDown().withProperties({
			required: true,
			editable: true
		}).component();

		this._publicIPDropdown.onValueChanged((value) => {
			this.wizard.model.publicIPName = (this._virtualNetworkDropdown.value as azdata.CategoryValue).name;
		});

		this._publicIPDropdownLoader = view.modelBuilder.loadingComponent().withItem(this._publicIPDropdown).component();
	}


	private async createVmRDPAllowCheckbox(view: azdata.ModelView) {
		this._vmRDPAllowCheckbox = view.modelBuilder.checkBox().withProperties({
			label: constants.RDPAllowCheckboxLabel,
		}).component();
		this._vmRDPAllowCheckbox.onChanged((value) => {
			if (value) {
				this.wizard.model.allowRDP = 'True';
			} else {
				this.wizard.model.allowRDP = 'False';
			}
		});
		this.wizard.model.allowRDP = 'False';
	}
}
