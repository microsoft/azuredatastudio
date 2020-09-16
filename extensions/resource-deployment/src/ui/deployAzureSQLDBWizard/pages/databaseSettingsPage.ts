/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { EOL } from 'os';
import { DeployAzureSQLDBWizard } from '../deployAzureSQLDBWizard';
import * as constants from '../constants';
import { BasePage } from './basePage';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class DatabaseSettingsPage extends BasePage {

	private _startIpAddressTextRow!: azdata.FlexContainer;
	private _startIpAddressTextbox!: azdata.InputBoxComponent;
	private _endIpAddressTextRow!: azdata.FlexContainer;
	private _endIpAddressTextbox!: azdata.InputBoxComponent;
	private _firewallRuleNameTextbox!: azdata.InputBoxComponent;
	private _firewallRuleNameTextRow!: azdata.FlexContainer;
	private _databaseNameTextbox!: azdata.InputBoxComponent;
	private _databaseNameTextRow!: azdata.FlexContainer;
	private _collationTextbox!: azdata.InputBoxComponent;
	private _collationTextRow!: azdata.FlexContainer;
	private _IpInfoText!: azdata.TextComponent;

	private _form!: azdata.FormContainer;

	constructor(wizard: DeployAzureSQLDBWizard) {
		super(
			constants.DatabaseSettingsPageTitle,
			'',
			wizard
		);
	}

	public async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {
			await Promise.all([
				this.createIpAddressText(view),
				this.createFirewallNameText(view),
				this.createDatabaseNameText(view),
				this.createCollationText(view)
			]);
			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{
							component: this._databaseNameTextRow
						},
						{
							component: this._collationTextRow
						},
						{
							component: this._firewallRuleNameTextRow
						},
						{
							component: this._startIpAddressTextRow
						},
						{
							component: this._endIpAddressTextRow
						},
						{
							component: this._IpInfoText
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
		this.liveValidation = false;
		this.wizard.wizardObject.registerNavigationValidator(async (pcInfo) => {
			if (pcInfo.newPage < pcInfo.lastPage) {
				return true;
			}
			this.liveValidation = true;
			let errorMessage = await this.validatePage();

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

	private createIpAddressText(view: azdata.ModelView) {

		this._IpInfoText = view.modelBuilder.text()
			.withProperties({
				value: constants.IpAddressInfoLabel
			}).component();

		//Start IP Address Section:

		this._startIpAddressTextbox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			inputType: 'text'
		}).component();

		this._startIpAddressTextbox.onTextChanged((value) => {
			this.wizard.model.startIpAddress = value;
			this.activateRealTimeFormValidation();
		});

		this._startIpAddressTextRow = this.wizard.createFormRowComponent(view, constants.StartIpAddressLabel, '', this._startIpAddressTextbox, true);

		//End IP Address Section:

		this._endIpAddressTextbox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			inputType: 'text'
		}).component();

		this._endIpAddressTextbox.onTextChanged((value) => {
			this.wizard.model.endIpAddress = value;
			this.activateRealTimeFormValidation();
		});

		this._endIpAddressTextRow = this.wizard.createFormRowComponent(view, constants.EndIpAddressLabel, '', this._endIpAddressTextbox, true);
	}

	private createFirewallNameText(view: azdata.ModelView) {

		this._firewallRuleNameTextbox = view.modelBuilder.inputBox().component();

		this._firewallRuleNameTextRow = this.wizard.createFormRowComponent(view, constants.FirewallRuleNameLabel, '', this._firewallRuleNameTextbox, true);

		this._firewallRuleNameTextbox.onTextChanged((value) => {
			this.wizard.model.firewallRuleName = value;
			this.activateRealTimeFormValidation();
		});
	}

	private createDatabaseNameText(view: azdata.ModelView) {

		this._databaseNameTextbox = view.modelBuilder.inputBox().component();

		this._databaseNameTextRow = this.wizard.createFormRowComponent(view, constants.DatabaseNameLabel, '', this._databaseNameTextbox, true);

		this._databaseNameTextbox.onTextChanged((value) => {
			this.wizard.model.databaseName = value;
			this.activateRealTimeFormValidation();
		});
	}

	private createCollationText(view: azdata.ModelView) {
		this._collationTextbox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			inputType: 'text',
			value: 'SQL_Latin1_General_CP1_CI_AS'
		}).component();

		this._collationTextbox.onTextChanged((value) => {
			this.wizard.model.databaseCollation = value;
			this.activateRealTimeFormValidation();
		});

		this._collationTextRow = this.wizard.createFormRowComponent(view, constants.CollationNameLabel, '', this._collationTextbox, true);
	}

	protected async validatePage(): Promise<string> {
		let errorMessages = [];
		let ipRegex = /(^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$)/;
		let startipvalue = this._startIpAddressTextbox.value!;
		let endipvalue = this._endIpAddressTextbox.value!;
		let firewallname = this._firewallRuleNameTextbox.value!;
		let databasename = this._databaseNameTextbox.value!;
		let collationname = this._collationTextbox.value!;

		if (!(ipRegex.test(startipvalue))) {
			errorMessages.push(localize('deployAzureSQLDB.DBMinIpInvalidError', "Min Ip address is invalid"));
		}

		if (!(ipRegex.test(endipvalue))) {
			errorMessages.push(localize('deployAzureSQLDB.DBMaxIpInvalidError', "Max Ip address is invalid"));
		}

		if (/^\d+$/.test(firewallname)) {
			errorMessages.push(localize('deployAzureSQLDB.DBFirewallOnlyNumericNameError', "Firewall name cannot contain only numbers."));
		}
		if (firewallname.length < 1 || firewallname.length > 15) {
			errorMessages.push(localize('deployAzureSQLDB.DBFirewallLengthError', "Firewall name must be between 1 and 15 characters long."));
		}
		if (/[\\\/"\'\[\]:\|<>\+=;,\?\*@\&,]/g.test(firewallname)) {
			errorMessages.push(localize('deployAzureSQLDB.DBFirewallSpecialCharError', "Firewall name cannot contain special characters \/\"\"[]:|<>+=;,?*@&, ."));
		}

		if (/^\d+$/.test(databasename)) {
			errorMessages.push(localize('deployAzureSQLDB.DBNameOnlyNumericNameError', "Database name cannot contain only numbers."));
		}
		if (databasename.length < 1 || databasename.length > 15) {
			errorMessages.push(localize('deployAzureSQLDB.DBNameLengthError', "Database name must be between 1 and 15 characters long."));
		}
		if (/[\\\/"\'\[\]:\|<>\+=;,\?\*@\&,]/g.test(databasename)) {
			errorMessages.push(localize('deployAzureSQLDB.DBNameSpecialCharError', "Database name cannot contain special characters \/\"\"[]:|<>+=;,?*@&, ."));
		}
		if (await this.databaseNameExists(databasename)) {
			errorMessages.push(localize('deployAzureSQLDB.DBNameExistsError', "Database name must be unique in the current server."));
		}

		if (/^\d+$/.test(collationname)) {
			errorMessages.push(localize('deployAzureSQLDB.DBCollationOnlyNumericNameError', "Collation name cannot contain only numbers."));
		}
		if (collationname.length < 1 || collationname.length > 15) {
			errorMessages.push(localize('deployAzureSQLDB.DBCollationLengthError', "Collation name must be between 1 and 15 characters long."));
		}
		if (/[\\\/"\'\[\]:\|<>\+=;,\?\*@\&,]/g.test(collationname)) {
			errorMessages.push(localize('deployAzureSQLDB.DBCollationSpecialCharError', "Collation name cannot contain special characters \/\"\"[]:|<>+=;,?*@&, ."));
		}

		this.wizard.showErrorMessage(errorMessages.join(EOL));
		return errorMessages.join(EOL);
	}

	protected async databaseNameExists(dbName: string): Promise<boolean> {
		const url = `https://management.azure.com` +
			`/subscriptions/${this.wizard.model.azureSubscription}` +
			`/resourceGroups/${this.wizard.model.azureResouceGroup}` +
			`/providers/Microsoft.Sql` +
			`/servers/${this.wizard.model.azureServerName}` +
			`/databases?api-version=2017-10-01-preview`;

		let response = await this.wizard.getRequest(url, true);

		let nameArray = response.data.value.map((v: any) => { return v.name; });
		return (nameArray.includes(dbName));
	}
}
