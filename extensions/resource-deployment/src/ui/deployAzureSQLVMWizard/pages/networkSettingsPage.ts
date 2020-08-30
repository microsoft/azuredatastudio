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
	private _existingVirtualNetworkCheckbox!: azdata.CheckBoxComponent;
	private _virtualNetworkFlexContainer !: azdata.FlexContainer;
	private _virtualNetworkDropdown!: azdata.DropDownComponent;
	private _virtualNetworkDropdownLoader!: azdata.LoadingComponent;
	private _newVirtualNetworkText!: azdata.InputBoxComponent;

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
							component: this._existingVirtualNetworkCheckbox,
						},
						{
							title: constants.VirtualNetworkDropdownLabel,
							component: this._virtualNetworkFlexContainer
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
			this.wizard.model.virtualNetworkName = value.name;
			//this.wizard.model.vmImageSKU = (this._virtualNetworkDropdown.value as azdata.CategoryValue).name;
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
				displayName: `(${resourceGroupName})\t${value.name}`
			};
		});

		this._virtualNetworkDropdown.updateProperties({
			value: dropdownValues[0],
			values: dropdownValues
		});
		this.wizard.model.virtualNetworkName = (this._virtualNetworkDropdown.value as azdata.CategoryValue).name;
		this._virtualNetworkDropdownLoader.loading = false;
	}

	private async createPublicIPDropdown(view: azdata.ModelView) {
		this._publicIPDropdown = view.modelBuilder.dropDown().withProperties({
			//required: true,
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
