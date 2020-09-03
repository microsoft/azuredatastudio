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

	// subnet network components
	private _existingsubnetCheckbox!: azdata.CheckBoxComponent;
	private _subnetDropdown!: azdata.DropDownComponent;


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
			await this.createSubnetDropdown(view);
			await this.createPublicIPDropdown(view);
			await this.createVmRDPAllowCheckbox(view);


			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{
							component: this._existingVirtualNetworkCheckbox,
						},
						{
							component: this.wizard.createFormRowComponent(view, constants.VirtualNetworkDropdownLabel, '', this._virtualNetworkFlexContainer, true)
						},
						{
							component: this._existingsubnetCheckbox
						},
						{
							component: this.wizard.createFormRowComponent(view, constants.SubnetDropdownLabel, '', this._subnetDropdown, true)
						},
						{
							component: this._existingPublicIpCheckbox,
						},
						{
							component: this.wizard.createFormRowComponent(view, constants.PublicIPDropdownLabel, '', this._publicIpFlexContainer, true)
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
			let errorMessage = '';
			if (this.wizard.model.existingVirtualNetwork === 'False') {
				if (this.wizard.model.virtualNetworkName.length < 2 || this.wizard.model.virtualNetworkName.length > 64) {
					errorMessage += 'Virtual Network name must be between 2 and 64 characters long\n';
				}
			}

			if (this.wizard.model.existingSubnet === 'False') {
				if (this.wizard.model.subnetName.length < 1 || this.wizard.model.virtualNetworkName.length > 80) {
					errorMessage += 'Virtual Network name must be between 1 and 80 characters long\n';
				}
			}

			if (this.wizard.model.existingPublicIp === 'False') {
				if (this.wizard.model.publicIpName.length < 1 || this.wizard.model.publicIpName.length > 80) {
					errorMessage += 'Virtual Network name must be between 1 and 80 characters long\n';
				}
			}

			if (errorMessage !== '') {
				this.wizard.showErrorMessage(errorMessage);
				return false;
			}
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
			label: constants.NetworkSettingsUseExistingVirtualNetwork,
			checked: true
		}).component();

		this._existingVirtualNetworkCheckbox.onChanged((event) => {
			this.wizard.model.existingVirtualNetwork = event ? 'True' : 'False';
			this._existingsubnetCheckbox.updateProperties({
				enabled: event,
				checked: event
			});
			this._subnetDropdown.updateProperties({
				enabled: event
			});
			if (event) {
				this.wizard.changeComponentDisplay(this._virtualNetworkDropdown, 'block');
				this.wizard.changeComponentDisplay(this._newVirtualNetworkText, 'none');
				this.populateSubnetDropdown();
			} else {
				this.wizard.changeComponentDisplay(this._virtualNetworkDropdown, 'none');
				this.wizard.changeComponentDisplay(this._newVirtualNetworkText, 'block');
				this.wizard.model.existingSubnet = 'False';
				this.wizard.model.subnetName = this.wizard.model.vmName + 'subnet';
				this._subnetDropdown.updateProperties({
					enabled: false,
					values: [{
						name: `(new) ` + this.wizard.model.subnetName,
						displayName: `(new) ` + this.wizard.model.subnetName
					}]
				});
				this.wizard.model.subnetName = 'default';
			}
		});

		this.wizard.model.existingVirtualNetwork = this._existingVirtualNetworkCheckbox.checked ? 'True' : 'False';

		this._virtualNetworkDropdown = view.modelBuilder.dropDown().withProperties({
			width: constants.standardWidth,
			required: true
		}).component();

		this._virtualNetworkDropdown.onValueChanged((value) => {
			this.wizard.model.virtualNetworkName = (this._virtualNetworkDropdown.value as azdata.CategoryValue).name;
			this.populateSubnetDropdown();
		});

		this._virtualNetworkDropdownLoader = view.modelBuilder.loadingComponent().withItem(this._virtualNetworkDropdown).component();

		this._newVirtualNetworkText = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			width: constants.standardWidth,
			required: true,
			placeHolder: 'Enter name for new virtual network'
		}).component();

		this._newVirtualNetworkText.onTextChanged((e) => {
			this.wizard.model.virtualNetworkName = e;
		});

		this.wizard.changeComponentDisplay(this._newVirtualNetworkText, 'none');

		this._virtualNetworkFlexContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).withItems(
			[this._virtualNetworkDropdown, this._newVirtualNetworkText]
		).component();


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

	private async createSubnetDropdown(view: azdata.ModelView) {

		this._existingsubnetCheckbox = view.modelBuilder.checkBox().withProperties<azdata.CheckBoxProperties>({
			label: 'Use existing subnet',
			checked: true
		}).component();
		this._subnetDropdown = view.modelBuilder.dropDown().withProperties(<azdata.DropDownProperties>{
		}).component();

		this._existingsubnetCheckbox.onChanged((value) => {
			if (value) {
				this.wizard.model.existingSubnet = 'True';
				this._subnetDropdown.updateProperties({
					enabled: true
				});
				this.populateSubnetDropdown();
			} else {
				this.wizard.model.existingSubnet = 'False';
				this.wizard.model.subnetName = this.wizard.model.vmName + 'subnet';
				this._subnetDropdown.updateProperties({
					enabled: false,
					values: [{
						name: `(new) ` + this.wizard.model.subnetName,
						displayName: `(new) ` + this.wizard.model.subnetName
					}]
				});
			}
		});
	}


	private async populateSubnetDropdown() {
		let url = `https://management.azure.com` +
			`${this.wizard.model.virtualNetworkName}` +
			`/subnets?api-version=2020-05-01`;
		let response = await this.wizard.getRequest(url);

		let dropdownValues = response.data.value.map((value: any) => {
			return {
				name: value.id,
				displayName: `${value.name}`
			};
		});

		this._subnetDropdown.updateProperties({
			value: dropdownValues[0],
			values: dropdownValues
		});
		this.wizard.model.subnetName = (this._subnetDropdown.value as azdata.CategoryValue).name;
	}

	private async createPublicIPDropdown(view: azdata.ModelView) {

		this._existingPublicIpCheckbox = view.modelBuilder.checkBox().withProperties(<azdata.CheckBoxProperties>{
			label: constants.NetworkSettingsUseExistingPublicIp,
			checked: true
		}).component();

		this._existingPublicIpCheckbox.onChanged((event) => {
			this.wizard.model.existingPublicIp = event ? 'True' : 'False';
			if (event) {
				this.wizard.changeComponentDisplay(this._publicIpDropdownLoader, 'block');
				this.wizard.changeComponentDisplay(this._publicIpNetworkText, 'none');
			} else {
				this.wizard.changeComponentDisplay(this._publicIpDropdownLoader, 'none');
				this.wizard.changeComponentDisplay(this._publicIpNetworkText, 'block');
			}
		});

		this.wizard.model.existingPublicIp = this._existingPublicIpCheckbox.checked ? 'True' : 'False';


		this._publicIpDropdown = view.modelBuilder.dropDown().withProperties({
			required: true,
			width: constants.standardWidth,
		}).component();

		this._publicIpDropdown.onValueChanged((value) => {
			this.wizard.model.publicIpName = value.name;
			//this.wizard.model.vmImageSKU = (this._virtualNetworkDropdown.value as azdata.CategoryValue).name;
		});

		this._publicIpDropdownLoader = view.modelBuilder.loadingComponent().withItem(this._publicIpDropdown).component();

		this._publicIpNetworkText = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			placeHolder: 'Enter name for new public IP',
			width: constants.standardWidth
		}).component();

		this._publicIpNetworkText.onTextChanged((e) => {
			this.wizard.model.publicIpName = e;
		});

		this.wizard.changeComponentDisplay(this._publicIpNetworkText, 'none');

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
		this.wizard.model.publicIpName = (this._publicIpDropdown.value as azdata.CategoryValue).name;
		this._publicIpDropdownLoader.loading = false;
	}



	private async createVmRDPAllowCheckbox(view: azdata.ModelView) {
		this._vmRDPAllowCheckbox = view.modelBuilder.checkBox().withProperties({
			label: constants.RDPAllowCheckboxLabel,
		}).component();
		this._vmRDPAllowCheckbox.onChanged((value) => {
			this.wizard.model.allowRDP = (value) ? 'True' : 'False';
		});
		this.wizard.model.allowRDP = 'False';
	}
}
