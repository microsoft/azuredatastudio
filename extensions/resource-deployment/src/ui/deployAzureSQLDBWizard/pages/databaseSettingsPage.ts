/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DeployAzureSQLDBWizard } from '../deployAzureSQLDBWizard';
import * as constants from '../constants';
import { BasePage } from './basePage';

export class DatabaseSettingsPage extends BasePage {

	// ip address components
	// private _newPublicIpCheckbox!: azdata.CheckBoxComponent;
	// private _publicIpFlexContainer !: azdata.FlexContainer;
	// private _publicIpDropdown!: azdata.DropDownComponent;
	// private _publicIpDropdownLoader!: azdata.LoadingComponent;
	// private _publicIpNetworkText!: azdata.InputBoxComponent;
	private _startIpAddressTextRow!: azdata.FlexContainer;
	private _startIpAddressTextbox!: azdata.InputBoxComponent;
	private _endIpAddressTextRow!: azdata.FlexContainer;
	private _endIpAddressTextbox!: azdata.InputBoxComponent;
	private _firewallRuleNameTextbox!: azdata.InputBoxComponent;
	private _firewallRuleNameTextRow!: azdata.FlexContainer;
	private _databaseNameTextbox!: azdata.InputBoxComponent;
	private _databaseNameTextRow!: azdata.FlexContainer;

	private _form!: azdata.FormContainer;

	constructor(wizard: DeployAzureSQLDBWizard) {
		super(
			constants.DatabaseSettingsPageTitle,
			constants.DatabaseSettingsPageDescription,
			wizard
		);
	}

	public async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {
			await Promise.all([
				//this.createPublicIPDropdown(view),
				this.createIpAddressText(view),
				this.createFirewallNameText(view),
				this.createDatabaseNameText(view)
			]);
			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						// {
						// 	component: this.wizard.createFormRowComponent(view, constants.PublicIPDropdownLabel, '', this._publicIpFlexContainer, true)
						// },
						{
							component: this._startIpAddressTextRow
						},
						{
							component: this._endIpAddressTextRow
						},
						{
							component: this._firewallRuleNameTextRow
						},
						{
							component: this._databaseNameTextRow
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
		//this.populatePublicIpkDropdown();
		this.liveValidation = false;
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			if (pcInfo.newPage < pcInfo.lastPage) {
				return true;
			}
			this.liveValidation = true;
			let errorMessage = this.formValidation();

			if (errorMessage !== '') {
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

	// private async createPublicIPDropdown(view: azdata.ModelView) {

	// 	this._newPublicIpCheckbox = view.modelBuilder.checkBox().withProperties(<azdata.CheckBoxProperties>{
	// 		label: constants.DatabaseSettingsNewPublicIp,
	// 		checked: false
	// 	}).component();

	// 	this._newPublicIpCheckbox.onChanged((event) => {
	// 		this.toggleNewPublicIp();
	// 	});

	// 	this._publicIpDropdown = view.modelBuilder.dropDown().withProperties({
	// 		required: true,
	// 		width: constants.standardWidth,
	// 	}).component();

	// 	this._publicIpDropdown.onValueChanged((value) => {
	// 		this.wizard.model.startIpAddress = (this._publicIpDropdown.value as azdata.CategoryValue).name;
	// 		this.wizard.model.endIpAddress = this.wizard.model.startIpAddress;
	// 	});

	// 	this._publicIpDropdownLoader = view.modelBuilder.loadingComponent().withItem(this._publicIpDropdown).component();

	// 	this._publicIpNetworkText = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
	// 		placeHolder: 'Enter name for new public IP',
	// 		width: constants.standardWidth
	// 	}).component();

	// 	this._publicIpNetworkText.onTextChanged((e) => {
	// 		this.wizard.model.startIpAddress = e;
	// 		this.wizard.model.endIpAddress = this.wizard.model.startIpAddress;
	// 		this.liveFormValidation();
	// 	});

	// 	this.wizard.changeComponentDisplay(this._publicIpNetworkText, 'none');

	// 	this._publicIpFlexContainer = view.modelBuilder.flexContainer().withLayout({
	// 		flexFlow: 'column',
	// 	}).withItems(
	// 		[this._publicIpDropdownLoader, this._publicIpNetworkText, this._newPublicIpCheckbox]
	// 	).component();

	// }

	// private async populatePublicIpkDropdown() {
	// 	this._publicIpDropdownLoader.loading = true;

	// 	let publicIps = await this.getPips();

	// 	if (!publicIps || publicIps.length === 0) {
	// 		publicIps = [{
	// 			displayName: 'None',
	// 			name: 'None'
	// 		}];
	// 		this._publicIpDropdown.updateProperties({
	// 			values: publicIps
	// 		});
	// 		this._newPublicIpCheckbox.enabled = false;
	// 		this.toggleNewPublicIp();
	// 	} else {
	// 		this._publicIpDropdown.updateProperties({
	// 			values: publicIps
	// 		});
	// 		this._newPublicIpCheckbox.enabled = true;
	// 		this.toggleNewPublicIp();
	// 	}
	// 	this._publicIpDropdownLoader.loading = false;
	// }

	// private toggleNewPublicIp() {
	// 	let newPip = this._newPublicIpCheckbox.checked!;

	// 	this.wizard.model.newPublicIp = newPip ? 'True' : 'False';

	// 	if (newPip) {
	// 		this.wizard.changeComponentDisplay(this._publicIpDropdownLoader, 'none');
	// 		this.wizard.changeComponentDisplay(this._publicIpNetworkText, 'block');
	// 		this.wizard.model.startIpAddress = this._publicIpNetworkText.value!;
	// 		this.wizard.model.endIpAddress = this.wizard.model.startIpAddress;
	// 	} else {
	// 		this.wizard.changeComponentDisplay(this._publicIpDropdownLoader, 'block');
	// 		this.wizard.changeComponentDisplay(this._publicIpNetworkText, 'none');
	// 		this.wizard.model.startIpAddress = (this._publicIpDropdown.value as azdata.CategoryValue).name;
	// 		this.wizard.model.endIpAddress = this.wizard.model.startIpAddress;
	// 	}
	// }

	// public async getPips(): Promise<any> {
	// 	let url = `https://management.azure.com` +
	// 		`/subscriptions/${this.wizard.model.azureSubscription}` +
	// 		`/providers/Microsoft.Network/publicIPAddresses?api-version=2020-05-01`;
	// 	let response = await this.wizard.getRequest(url);
	// 	let dropdownValues = response.data.value.filter((value: any) => {
	// 		return value.location === this.wizard.model.azureRegion;
	// 	}).map((value: any) => {
	// 		console.log(value)
	// 		let resourceGroupName = value.id.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '');
	// 		return {
	// 			name: value.id,
	// 			displayName: `${value.name} \t\t resource group: (${resourceGroupName})`
	// 		};
	// 	});
	// 	return dropdownValues;
	// }

	private createIpAddressText(view: azdata.ModelView) {

		//Start IP Address Section:

		this._startIpAddressTextbox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			inputType: 'text',
			value: '0.0.0.0'
		}).component();

		this._startIpAddressTextbox.onTextChanged((value) => {
			this.wizard.model.startIpAddress = value;
			this.liveFormValidation();
		});

		this._startIpAddressTextRow = this.wizard.createFormRowComponent(view, constants.StartIpAddressLabel, '', this._startIpAddressTextbox, true);

		//End IP Address Section:

		this._endIpAddressTextbox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			inputType: 'text',
			value: '0.0.0.0'
		}).component();

		this._endIpAddressTextbox.onTextChanged((value) => {
			this.wizard.model.endIpAddress = value;
			this.liveFormValidation();
		});

		this._endIpAddressTextRow = this.wizard.createFormRowComponent(view, constants.EndIpAddressLabel, '', this._endIpAddressTextbox, true);
	}

	private createFirewallNameText(view: azdata.ModelView) {

		this._firewallRuleNameTextbox = view.modelBuilder.inputBox().component();

		this._firewallRuleNameTextRow = this.wizard.createFormRowComponent(view, constants.FirewallRuleNameLabel, '', this._firewallRuleNameTextbox, true);

		this._firewallRuleNameTextbox.onTextChanged((value) => {
			this.wizard.model.firewallRuleName = value;
			this.liveFormValidation();
		});
	}

	private createDatabaseNameText(view: azdata.ModelView) {

		this._databaseNameTextbox = view.modelBuilder.inputBox().component();

		this._databaseNameTextRow = this.wizard.createFormRowComponent(view, constants.DatabaseNameLabel, '', this._databaseNameTextbox, true);

		this._databaseNameTextbox.onTextChanged((value) => {
			this.wizard.model.databaseName = value;
			this.liveFormValidation();
		});
	}

	protected formValidation(): string {
		let errorMessage = [];
		let ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
		let startipvalue = this._startIpAddressTextbox.value!;
		let endipvalue = this._endIpAddressTextbox.value!;
		let firewallname = this._firewallRuleNameTextbox.value!;
		let databasename = this._databaseNameTextbox.value!;

		// if (this.wizard.model.newPublicIp === 'True') {
		// 	if (this.wizard.model.startIpAddress.length < 1 || this.wizard.model.startIpAddress.length > 80
		// 		|| this.wizard.model.endIpAddress.length < 1 || this.wizard.model.endIpAddress.length > 80) {
		// 		errorMessage.push('Public IP name must be between 1 and 80 characters long');
		// 	}
		// } else {
		// 	if (this.wizard.model.startIpAddress === 'None' || this.wizard.model.endIpAddress === 'None') {
		// 		errorMessage.push('Create a new new public Ip');
		// 	}
		// }

		if (!(ipRegex.test(startipvalue))) {
			errorMessage.push('Min IP address is invalid');
		}

		if (!(ipRegex.test(endipvalue))) {
			errorMessage.push('Max IP address is invalid');
		}

		if (firewallname.length < 2 || firewallname.length > 128) {
			errorMessage.push('Firewall name must be between 2 and 128 characters long.');
		}

		if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(firewallname)) {
			errorMessage.push('Firewall name cannot contain special characters \/""[]:|<>+=;,?* .');
		}

		if (databasename.length < 2 || databasename.length > 128) {
			errorMessage.push('Database name must be between 2 and 128 characters long.');
		}

		if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(databasename)) {
			errorMessage.push('Database name cannot contain special characters \/""[]:|<>+=;,?* .');
		}

		this.wizard.showErrorMessage(errorMessage.join('\n'));
		return errorMessage.join('\n');

	}
}
