/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { WizardPageBase } from '../../wizardPageBase';
import { DeployAzureSQLVMWizard } from '../deployAzureSQLVMWizard';
import * as constants from '../constants';

export class NetworkSettingsPage extends WizardPageBase<DeployAzureSQLVMWizard> {

	// virtual network components
	private _existingVirtualNetworkCheckbox!: azdata.CheckBoxComponent;
	private _virtualNetworkFlexContainer !: azdata.FlexContainer;
	private _virtualNetworkDropdown!: azdata.DropDownComponent;
	private _virtualNetworkDropdownLoader!: azdata.LoadingComponent;
	private _newVirtualNetworkText!: azdata.InputBoxComponent;
	private _subnetDropdown!: azdata.DropDownComponent;

	// subnet network components

	// public ip components
	private _existingPublicIpCheckbox!: azdata.CheckBoxComponent;
	private _publicIpFlexContainer !: azdata.FlexContainer;
	private _publicIpDropdown!: azdata.DropDownComponent;
	private _publicIpDropdownLoader!: azdata.LoadingComponent;
	private _publicIpNetworkText!: azdata.InputBoxComponent;

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
							component: this._existingVirtualNetworkCheckbox,
						},
						{
							title: constants.VirtualNetworkDropdownLabel,
							component: this._virtualNetworkFlexContainer
						},
						{
							title: 'Subnet',
							component: this._subnetDropdown
						},
						{
							component: this._existingPublicIpCheckbox,
						},
						{
							title: constants.PublicIPDropdownLabel,
							component: this._publicIpFlexContainer
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
		this.populatePublicIpkDropdown();
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

		this._existingVirtualNetworkCheckbox = view.modelBuilder.checkBox().withProperties(<azdata.CheckBoxProperties>{
			label: 'Use Existing Virtual Network',
			checked: true
		}).component();

		this._existingVirtualNetworkCheckbox.onChanged((event) => {
			if (event) {
				this._virtualNetworkDropdown.updateCssStyles({
					display: 'block',
				});
				this._newVirtualNetworkText.updateCssStyles({
					display: 'none',
				});
				this.wizard.model.newVirtualNetwork = false;
			} else {
				this._virtualNetworkDropdown.updateCssStyles({
					display: 'none',
				});
				this._newVirtualNetworkText.updateCssStyles({
					display: 'block',
				});
				this.wizard.model.newVirtualNetwork = true;
			}
		});

		this._virtualNetworkDropdown = view.modelBuilder.dropDown().withProperties({
			//required: true,
		}).component();

		this._virtualNetworkDropdown.onValueChanged((value) => {
			this.wizard.model.virtualNetworkName = (this._virtualNetworkDropdown.value as azdata.CategoryValue).name;
			this.populateSubnetDropdown();
		});

		this._virtualNetworkDropdownLoader = view.modelBuilder.loadingComponent().withItem(this._virtualNetworkDropdown).component();

		this._newVirtualNetworkText = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
		}).component();

		this._newVirtualNetworkText.onTextChanged((e) => {
			this.wizard.model.virtualNetworkName = e;
			this.wizard.model.newVirtualNetwork = true;
		});

		this._newVirtualNetworkText.updateCssStyles({
			display: 'none',
		});

		this._virtualNetworkFlexContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).withItems(
			[this._virtualNetworkDropdown, this._newVirtualNetworkText]
		).component();

		this._subnetDropdown = view.modelBuilder.dropDown().withProperties(<azdata.DropDownProperties>{
		}).component();
	}

	private async populateVirtualNetworkDropdown() {
		this._virtualNetworkDropdownLoader.loading = true;
		let url = `https://management.azure.com` +
			`/subscriptions/${this.wizard.model.azureSubscription}` +
			`/providers/Microsoft.Network/virtualNetworks?api-version=2020-05-01`;

		let response = await this.wizard.getRequest(url);

		let dropdownValues = response.data.value.map((value: any) => {
			let resourceGroupName = value.id.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '');
			return {
				name: value.id,
				displayName: `${value.name} \t\t resource group: (${resourceGroupName})`
			};
		});

		this._virtualNetworkDropdown.updateProperties({
			value: dropdownValues[0],
			values: dropdownValues
		});
		this.wizard.model.virtualNetworkName = (this._virtualNetworkDropdown.value as azdata.CategoryValue).name;
		this._virtualNetworkDropdownLoader.loading = false;
		await this.populateSubnetDropdown();
	}


	private async populateSubnetDropdown() {
		let url = `https://management.azure.com` +
			`/subscriptions/${this.wizard.model.azureSubscription}` +
			`/providers/Microsoft.Network` +
			`/virtualNetworks/${this.wizard.model.virtualNetworkName}` +
			`/subnets?api-version=2020-05-01`;
		console.log(url);
		let response = await this.wizard.getRequest(url);
		console.log(response.data);

		// let dropdownValues = response.data.value.map((value: any) => {
		// 	let resourceGroupName = value.id.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '');
		// 	return {
		// 		name: value.id,
		// 		displayName: `${value.name} \t\t resource group: (${resourceGroupName})`
		// 	};
		// });

		// this._subnetDropdown.updateProperties({
		// 	value: dropdownValues[0],
		// 	values: dropdownValues
		// });
		this.wizard.model.subnetName = (this._subnetDropdown.value as azdata.CategoryValue).name;
	}

	private async createPublicIPDropdown(view: azdata.ModelView) {

		this._existingPublicIpCheckbox = view.modelBuilder.checkBox().withProperties(<azdata.CheckBoxProperties>{
			label: 'Use Existing Public IP',
			checked: true
		}).component();

		this._existingPublicIpCheckbox.onChanged((event) => {
			if (event) {
				this._publicIpDropdownLoader.updateCssStyles({
					display: 'block',
				});
				this._publicIpNetworkText.updateCssStyles({
					display: 'none',
				});
				this.wizard.model.newPublicIPName = false;
			} else {
				this._publicIpDropdownLoader.updateCssStyles({
					display: 'none',
				});
				this._publicIpNetworkText.updateCssStyles({
					display: 'block',
				});
				this.wizard.model.newPublicIPName = true;
			}
		});

		this._publicIpDropdown = view.modelBuilder.dropDown().withProperties({
			//required: true,
		}).component();

		this._publicIpDropdown.onValueChanged((value) => {
			this.wizard.model.publicIPName = value.name;
			//this.wizard.model.vmImageSKU = (this._virtualNetworkDropdown.value as azdata.CategoryValue).name;
		});

		this._publicIpDropdownLoader = view.modelBuilder.loadingComponent().withItem(this._publicIpDropdown).component();

		this._publicIpNetworkText = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
		}).component();

		this._publicIpNetworkText.onTextChanged((e) => {
			this.wizard.model.publicIPName = e;
			this.wizard.model.newPublicIPName = true;
		});

		this._publicIpNetworkText.updateCssStyles({
			display: 'none',
		});

		this._publicIpFlexContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).withItems(
			[this._publicIpDropdownLoader, this._publicIpNetworkText]
		).component();
	}

	private async populatePublicIpkDropdown() {
		this._publicIpDropdownLoader.loading = true;
		let url = `https://management.azure.com` +
			`/subscriptions/${this.wizard.model.azureSubscription}` +
			`/providers/Microsoft.Network/publicIPAddresses?api-version=2020-05-01`;

		let response = await this.wizard.getRequest(url);

		let dropdownValues = response.data.value.map((value: any) => {
			let resourceGroupName = value.id.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '');
			return {
				name: value.id,
				displayName: `${value.name} \t\t resource group: (${resourceGroupName})`
			};
		});

		this._publicIpDropdown.updateProperties({
			value: dropdownValues[0],
			values: dropdownValues
		});
		this.wizard.model.publicIPName = (this._publicIpDropdown.value as azdata.CategoryValue).name;
		this._publicIpDropdownLoader.loading = false;
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
