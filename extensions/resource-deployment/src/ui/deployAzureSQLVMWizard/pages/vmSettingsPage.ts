/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { EOL } from 'os';
import * as constants from '../constants';
import * as nls from 'vscode-nls';
import { BasePage } from './basePage';
import { DeployAzureSQLVMWizardModel } from '../deployAzureSQLVMWizardModel';
const localize = nls.loadMessageBundle();

export class VmSettingsPage extends BasePage {

	private _vmSize: string[] = [];

	// textbox for vm name
	private _vmNameTextBox!: azdata.InputBoxComponent;

	// textbox for vm admin username
	private _adminUsernameTextBox!: azdata.InputBoxComponent;

	// textbox for vm admin password
	private _adminPasswordTextBox!: azdata.InputBoxComponent;

	// textbox for vm admin confirm password
	private _adminComfirmPasswordTextBox!: azdata.InputBoxComponent;

	// dropdown for sql vm image
	private _vmImageDropdown!: azdata.DropDownComponent;

	// dropdown for sql vm image sku <- sql vm image
	private _vmImageSkuDropdown!: azdata.DropDownComponent;

	// dropdown for sql vm image version <- sql vm image sku
	private _vmImageVersionDropdown!: azdata.DropDownComponent;

	// dropdown for sql vm size
	private _vmSizeDropdown!: azdata.DropDownComponent;
	private _vmSizeLearnMoreLink!: azdata.HyperlinkComponent;

	private _form!: azdata.FormContainer;

	constructor(private _model: DeployAzureSQLVMWizardModel) {
		super(
			constants.VmSettingsPageTitle,
			'',
			_model.wizard
		);
	}

	public async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {

			await Promise.all([
				this.createVmNameTextBox(view),
				this.createAdminUsernameTextBox(view),
				this.createAdminPasswordTextBox(view),
				this.createAdminPasswordConfirmTextBox(view),
				this.createVmImageDropdown(view),
				this.createVMImageSkuDropdown(view),
				this.createVMImageVersionDropdown(view),
				this.createVmSizeDropdown(view),
			]);


			this.liveValidation = false;

			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{
							component: this._model.createFormRowComponent(view, constants.VmNameTextBoxLabel, '', this._vmNameTextBox, true)
						},
						{
							component: this._model.createFormRowComponent(view, constants.VmAdminUsernameTextBoxLabel, '', this._adminUsernameTextBox, true)
						},
						{
							component: this._model.createFormRowComponent(view, constants.VmAdminPasswordTextBoxLabel, '', this._adminPasswordTextBox, true)
						},
						{
							component: this._model.createFormRowComponent(view, constants.VmAdminConfirmPasswordTextBoxLabel, '', this._adminComfirmPasswordTextBox, true)
						},
						{
							component: this._model.createFormRowComponent(view, constants.VmImageDropdownLabel, '', this._vmImageDropdown, true)
						},
						{
							component: this._model.createFormRowComponent(view, constants.VmSkuDropdownLabel, '', this._vmImageSkuDropdown, true)
						},
						{
							component: this._model.createFormRowComponent(view, constants.VmVersionDropdownLabel, '', this._vmImageVersionDropdown, true)
						},
						{
							component: this._model.createFormRowComponent(view, constants.VmSizeDropdownLabel, '', this._vmSizeDropdown, true)
						},
						{
							component: this._vmSizeLearnMoreLink
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
		this.populateVmImageDropdown();
		this.populateVmSizeDropdown();

		this.liveValidation = false;

		this.wizard.wizardObject.registerNavigationValidator(async (pcInfo) => {
			this.liveValidation = true;

			if (pcInfo.newPage < pcInfo.lastPage) {
				return true;
			}

			let errorMessage = await this.validatePage();

			if (errorMessage !== '') {
				return false;
			}
			return true;
		});
	}

	public async onLeave(): Promise<void> {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}


	private async createVmNameTextBox(view: azdata.ModelView) {
		this._vmNameTextBox = view.modelBuilder.inputBox().withProperties({
		}).component();

		this._vmNameTextBox.onTextChanged((value) => {
			this._model.vmName = value;
			this.activateRealTimeFormValidation();
		});
	}

	private async createAdminUsernameTextBox(view: azdata.ModelView) {
		this._adminUsernameTextBox = view.modelBuilder.inputBox().withProperties({
		}).component();

		this._adminUsernameTextBox.onTextChanged((value) => {
			this._model.vmUsername = value;
			this.activateRealTimeFormValidation();
		});
	}

	private async createAdminPasswordTextBox(view: azdata.ModelView) {
		this._adminPasswordTextBox = view.modelBuilder.inputBox().withProperties({
			inputType: 'password',
		}).component();

		this._adminPasswordTextBox.onTextChanged((value) => {
			this._model.vmPassword = value;
			this.activateRealTimeFormValidation();
		});
	}

	private async createAdminPasswordConfirmTextBox(view: azdata.ModelView) {
		this._adminComfirmPasswordTextBox = view.modelBuilder.inputBox().withProperties({
			inputType: 'password',
		}).component();

		this._adminComfirmPasswordTextBox.onTextChanged((value) => {
			this.activateRealTimeFormValidation();
		});
	}

	private async createVmImageDropdown(view: azdata.ModelView) {
		this._vmImageDropdown = view.modelBuilder.dropDown().withProperties({
		}).component();

		this._vmImageDropdown.onValueChanged(value => {
			if (!this._vmImageDropdown.value) {
				return;
			}
			this._model.vmImage = (this._vmImageDropdown.value as azdata.CategoryValue).name;
			this._vmImageSkuDropdown.loading = true;
			this._vmImageVersionDropdown.loading = true;
			this.populateVmImageSkuDropdown();
		});

	}

	private async populateVmImageDropdown() {
		this._vmImageDropdown.loading = true;
		this._vmImageSkuDropdown.loading = true;
		this._vmImageVersionDropdown.loading = true;

		let url = `https://management.azure.com` +
			`/subscriptions/${this._model.azureSubscription}` +
			`/providers/Microsoft.Compute` +
			`/locations/${this._model.azureRegion}` +
			`/publishers/MicrosoftSQLServer` +
			`/artifacttypes/vmimage/offers` +
			`?api-version=2019-12-01`;

		let response = await this._model.getRequest(url, true);
		response.data = response.data.reverse();
		this._model.addDropdownValues(
			this._vmImageDropdown,
			response.data.filter((value: any) => {
				return !new RegExp('-byol').test(value.name.toLowerCase());
			})
				.map((value: any) => {
					let sqlServerVersion = value.name.toLowerCase().match(new RegExp('sql(.*?)-'))[1];
					let osVersion = value.name.toLowerCase().replace(new RegExp('sql(.*?)-'), '');
					osVersion = osVersion.replace(new RegExp('ws'), 'Windows Server ');
					osVersion = osVersion.replace(new RegExp('ubuntu'), 'Ubuntu Server ');
					osVersion = osVersion.replace(new RegExp('sles'), 'SUSE Linux Enterprise Server (SLES) ');
					osVersion = osVersion.replace(new RegExp('rhel'), 'Red Hat Enterprise Linux ');
					return {
						displayName: `SQL Server ${sqlServerVersion.toUpperCase()} on ${osVersion}`,
						name: value.name
					};
				})
		);

		this._model.vmImage = (this._vmImageDropdown.value as azdata.CategoryValue).name;
		this._vmImageDropdown.loading = false;
		this.populateVmImageSkuDropdown();
	}

	private async createVMImageSkuDropdown(view: azdata.ModelView) {
		this._vmImageSkuDropdown = view.modelBuilder.dropDown().withProperties({
		}).component();

		this._vmImageSkuDropdown.onValueChanged(value => {
			if (!this._vmImageSkuDropdown.value) {
				return;
			}
			this._model.vmImageSKU = (this._vmImageSkuDropdown.value as azdata.CategoryValue).name;
			this.populateVmImageVersionDropdown();
		});

	}

	private async populateVmImageSkuDropdown() {
		this._vmImageSkuDropdown.loading = true;
		let url = `https://management.azure.com` +
			`/subscriptions/${this._model.azureSubscription}` +
			`/providers/Microsoft.Compute` +
			`/locations/${this._model.azureRegion}` +
			`/publishers/MicrosoftSQLServer` +
			`/artifacttypes/vmimage/offers/${this._model.vmImage}` +
			`/skus?api-version=2019-12-01`;

		let response = await this._model.getRequest(url, true);

		this._model.addDropdownValues(
			this._vmImageSkuDropdown,
			response.data.map((value: any) => {
				return {
					name: value.name,
					displayName: value.name
				};
			})
		);

		this._model.vmImageSKU = (this._vmImageSkuDropdown.value as azdata.CategoryValue).name;
		this._vmImageSkuDropdown.loading = false;
		this.populateVmImageVersionDropdown();
	}

	private async createVMImageVersionDropdown(view: azdata.ModelView) {
		this._vmImageVersionDropdown = view.modelBuilder.dropDown().withProperties({
		}).component();

		this._vmImageVersionDropdown.onValueChanged(value => {
			if (!this._vmImageVersionDropdown.value) {
				return;
			}
			this._model.vmImageVersion = (this._vmImageVersionDropdown.value as azdata.CategoryValue).name;
		});
	}

	private async populateVmImageVersionDropdown() {
		this._vmImageVersionDropdown.loading = true;
		let url = `https://management.azure.com` +
			`/subscriptions/${this._model.azureSubscription}` +
			`/providers/Microsoft.Compute` +
			`/locations/${this._model.azureRegion}` +
			`/publishers/MicrosoftSQLServer` +
			`/artifacttypes/vmimage/offers/${this._model.vmImage}` +
			`/skus/${this._model.vmImageSKU}` +
			`/versions?api-version=2019-12-01`;

		let response = await this._model.getRequest(url, true);

		this._model.addDropdownValues(
			this._vmImageVersionDropdown,
			response.data.map((value: any) => {
				return {
					name: value.name,
					displayName: value.name
				};
			})
		);

		this._model.vmImageVersion = (this._vmImageVersionDropdown.value as azdata.CategoryValue).name;
		this._vmImageVersionDropdown.loading = false;
	}


	private async createVmSizeDropdown(view: azdata.ModelView) {
		this._vmSizeDropdown = view.modelBuilder.dropDown().withProperties({
			editable: true
		}).component();

		this._vmSizeDropdown.onValueChanged((value) => {
			this._model.vmSize = (this._vmSizeDropdown.value as azdata.CategoryValue).name;
		});

		this._vmSizeLearnMoreLink = view.modelBuilder.hyperlink().withProperties(<azdata.HyperlinkComponent>{
			label: constants.VmSizeLearnMoreLabel,
			url: 'https://go.microsoft.com/fwlink/?linkid=2143101'

		}).component();
	}

	private async populateVmSizeDropdown() {
		this._vmSizeDropdown.loading = true;
		let url = `https://management.azure.com` +
			`/subscriptions/${this._model.azureSubscription}` +
			`/providers/Microsoft.Compute` +
			`/skus?api-version=2019-04-01` +
			`&$filter=location eq '${this._model.azureRegion}'`;

		let response = await this._model.getRequest(url, true);

		let vmResouces: any[] = [];
		response.data.value.map((res: any) => {
			if (res.resourceType === 'virtualMachines') {
				vmResouces.push(res);
			}
		});

		let dropDownValues = vmResouces.filter((value: any) => {
			const discSize = Number(value.capabilities.filter((c: any) => { return c.name === 'MaxResourceVolumeMB'; })[0].value) / 1024;
			if (discSize >= 40) {
				return value;
			}
		}).map((value: any) => {
			if (value.capabilities) {
				let cores;
				if (value.capabilities.filter((c: any) => { return c.name === 'vCPUsAvailable'; }).length !== 0) {
					cores = value.capabilities.filter((c: any) => { return c.name === 'vCPUsAvailable'; })[0].value;
				} else {
					cores = value.capabilities.filter((c: any) => { return c.name === 'vCPUs'; })[0].value;
				}
				const memory = value.capabilities.filter((c: any) => { return c.name === 'MemoryGB'; })[0].value;
				const discSize = Number(value.capabilities.filter((c: any) => { return c.name === 'MaxResourceVolumeMB'; })[0].value) / 1024;
				const discCount = value.capabilities.filter((c: any) => { return c.name === 'MaxDataDiskCount'; })[0].value;
				const displayText = `${value.name}	Cores: ${cores}	Memory: ${memory}GB	discCount: ${discCount}	discSize: ${discSize}GB`;
				this._vmSize.push(displayText);
				return {
					name: value.name,
					displayName: displayText
				};
			}
			return;
		});

		dropDownValues.sort((a, b) => (a!.displayName > b!.displayName) ? 1 : -1);

		this._vmSize = [];

		this._vmSizeDropdown.updateProperties({
			values: dropDownValues,
			value: dropDownValues[0],
			width: '480px'
		});
		this._model.vmSize = (this._vmSizeDropdown.value as azdata.CategoryValue).name;
		this._vmSizeDropdown.loading = false;
	}

	protected async validatePage(): Promise<string> {

		const errorMessages = [];
		/**
		 * VM name rules:
		 * 	1. 1-15 characters
		 *  2. Cannot contain only numbers
		 *  3. Cannot start with underscore and end with period or hyphen
		 *  4. Virtual machine name cannot contain special characters \/""[]:|<>+=;,?*
		 */
		let vmname = this._model.vmName;
		if (vmname.length < 1 && vmname.length > 15) {
			errorMessages.push(localize('deployAzureSQLVM.VnameLengthError', "Virtual machine name must be between 1 and 15 characters long."));
		}
		if (/^\d+$/.test(vmname)) {
			errorMessages.push(localize('deployAzureSQLVM.VNameOnlyNumericNameError', "Virtual machine name cannot contain only numbers."));
		}
		if (vmname.charAt(0) === '_' || vmname.slice(-1) === '.' || vmname.slice(-1) === '-') {
			errorMessages.push(localize('deployAzureSQLVM.VNamePrefixSuffixError', "Virtual machine name Can\'t start with underscore. Can\'t end with period or hyphen"));
		}
		if (/[\\\/"\'\[\]:\|<>\+=;,\?\*@\&,]/g.test(vmname)) {
			errorMessages.push(localize('deployAzureSQLVM.VNameSpecialCharError', "Virtual machine name cannot contain special characters \/\"\"[]:|<>+=;,?*@&, ."));
		}
		if (await this.vmNameExists(vmname)) {
			errorMessages.push(localize('deployAzureSQLVM.VNameExistsError', "Virtual machine name must be unique in the current resource group."));
		}


		/**
		 * VM admin/root username rules:
		 *  1. 1-20 characters long
		 *  2. cannot contain special characters \/""[]:|<>+=;,?*
		 */
		const reservedVMUsernames: string[] = [
			'administrator', 'admin', 'user', 'user1', 'test', 'user2',
			'test1', 'user3', 'admin1', '1', '123', 'a', 'actuser', 'adm', 'admin2',
			'aspnet', 'backup', 'console', 'david', 'guest', 'john', 'owner', 'root', 'server', 'sql', 'support',
			'support_388945a0', 'sys', 'test2', 'test3', 'user4', 'user5'
		];
		let username = this._model.vmUsername;
		if (username.length < 1 || username.length > 20) {
			errorMessages.push(localize('deployAzureSQLVM.VMUsernameLengthError', "Username must be between 1 and 20 characters long."));
		}
		if (username.slice(-1) === '.') {
			errorMessages.push(localize('deployAzureSQLVM.VMUsernameSuffixError', 'Username cannot end with period'));
		}
		if (/[\\\/"\'\[\]:\|<>\+=;,\?\*@\&]/g.test(username)) {
			errorMessages.push(localize('deployAzureSQLVM.VMUsernameSpecialCharError', "Username cannot contain special characters \/\"\"[]:|<>+=;,?*@& ."));
		}

		if (reservedVMUsernames.includes(username)) {
			errorMessages.push(localize('deployAzureSQLVM.VMUsernameReservedWordsError', "Username must not include reserved words."));
		}

		errorMessages.push(this._model.validatePassword(this._model.vmPassword));

		if (this._model.vmPassword !== this._adminComfirmPasswordTextBox.value) {
			errorMessages.push(localize('deployAzureSQLVM.VMConfirmPasswordError', "Password and confirm password must match."));
		}

		if (this._vmSize.includes((this._vmSizeDropdown.value as azdata.CategoryValue).name)) {
			errorMessages.push(localize('deployAzureSQLVM.vmDropdownSizeError', "Select a valid virtual machine size."));
		}

		this._model.wizard.showErrorMessage(errorMessages.join(EOL));

		return errorMessages.join(EOL);
	}

	protected async vmNameExists(vmName: string): Promise<boolean> {
		const url = `https://management.azure.com` +
			`/subscriptions/${this._model.azureSubscription}` +
			`/resourceGroups/${this._model.azureResouceGroup}` +
			`/providers/Microsoft.Compute` +
			`/virtualMachines?api-version=2019-12-01`;

		let response = await this._model.getRequest(url, true);

		let nameArray = response.data.value.map((v: any) => { return v.name; });
		return (nameArray.includes(vmName));

	}



}
