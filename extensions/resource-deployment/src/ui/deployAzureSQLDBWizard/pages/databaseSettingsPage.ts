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
		this.wizard.wizardObject.registerNavigationValidator(async (pcInfo) => {
			if (pcInfo.newPage < pcInfo.lastPage) {
				return true;
			}
			let errorMessage = await this.validate();

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

	private createIpAddressText(view: azdata.ModelView) {

		this._IpInfoText = view.modelBuilder.text()
			.withProperties({
				value: constants.IpAddressInfoLabel
			}).component();

		// regex for validation (check to see if IP address is in IPv4 format)
		// sql db create requires IPv4 addresses as documented here: https://docs.microsoft.com/cli/azure/sql/server/firewall-rule?view=azure-cli-latest#az_sql_server_firewall_rule_create
		let ipRegex = /(^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$)/;

		//Start IP Address Section:

		this._startIpAddressTextbox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			inputType: 'text',
			required: true,
			validationErrorMessage: constants.DBIpInvalidError
		}).withValidation(component => {
			if (component.value) {
				return ipRegex.test(component.value);
			}
			else {
				return false;
			}
		}).component();

		this._startIpAddressTextbox.onTextChanged((value) => {
			this.wizard.model.startIpAddress = value;
		});

		this._startIpAddressTextRow = this.wizard.createFormRowComponent(view, constants.StartIpAddressLabel, '', this._startIpAddressTextbox, true);

		//End IP Address Section:

		this._endIpAddressTextbox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			inputType: 'text',
			required: true,
			validationErrorMessage: constants.DBIpInvalidError
		}).withValidation(component => {
			if (component.value) {
				return ipRegex.test(component.value);
			}
			else {
				return false;
			}
		}).component();

		this._endIpAddressTextbox.onTextChanged((value) => {
			this.wizard.model.endIpAddress = value;
		});

		this._endIpAddressTextRow = this.wizard.createFormRowComponent(view, constants.EndIpAddressLabel, '', this._endIpAddressTextbox, true);
	}

	/**
	 * Firewall rule names shown below are based on the Name field (under "Policy Details") when entering erroneous input here: https://ms.portal.azure.com/#create/Microsoft.FirewallPolicy
	*/
	private validateFirewallNameText(firewallname: string | undefined): boolean {
		if (firewallname) {
			// Check for firewall rule name that is only spaces (not allowed).
			if (/^[ ]+$/.test(firewallname)) {
				return false;
			}
			// Check for valid firewall rule name length between 1 and 80.
			if (firewallname.length < 1 || firewallname.length > 80) {
				return false;
			}
			// Check if Firewall name matches rules:
			// 1. Start with an letter or number.
			// 2. contain only numbers, underline, hyphens and periods.
			// 3. End with a letter, number, or underline.
			else if (/^((?=[^_])(?=[A-z0-9]))[A-z0-9_.-]*[A-z0-9_]$/.test(firewallname)) {
				return true;
			}
			else {
				return false;
			}
		} else {
			return false;
		}
	}

	private createFirewallNameText(view: azdata.ModelView) {
		this._firewallRuleNameTextbox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			required: true,
			validationErrorMessage: localize('deployAzureSQLDB.DBFirewallNameError', "Firewall name must start with letter or number, have only letter, number, period, hyphen, or underline characters, end with letter, number, or underline and must be between 1 and 80 characters")
		}).withValidation(component => this.validateFirewallNameText(component.value)).component();

		this._firewallRuleNameTextRow = this.wizard.createFormRowComponent(view, constants.FirewallRuleNameLabel, '', this._firewallRuleNameTextbox, true);

		this._firewallRuleNameTextbox.onTextChanged((value) => {
			this.wizard.model.firewallRuleName = value;
		});
	}
	/**
	 * database name rules shown below are based on the name rules found on the "database name" field in "database details" when entering erroneous input: https://ms.portal.azure.com/#create/Microsoft.SQLDatabase
	 * reserved names and substrings listed here: https://docs.microsoft.com/azure/azure-resource-manager/templates/error-reserved-resource-name
	 */
	private validateDatabaseNameText(databasename: string | undefined): boolean {
		if (databasename) {
			// Check for database name that is only spaces (not allowed).
			if (/^[ ]+$/.test(databasename)) {
				return false;
			}
			// Check for valid database name length between 1 and 128.
			if (databasename.length < 1 || databasename.length > 128) {

				return false;
			}
			// Check if database name matches any forbidden reserved names.
			if (/(^ACCESS$|^AZURE$|^BING$|^BIZSPARK$|^BIZTALK$|^CORTANA$|^DIRECTX$|^DOTNET$|^DYNAMICS$|^EXCEL$|^EXCHANGE$|^FOREFRONT$|^GROOVE$|^HOLOLENS$|^HYPERV$|^KINECT$|^LYNC$|^MSDN$|^O365$|^OFFICE$|^OFFICE365$|^ONEDRIVE$|^ONENOTE$|^OUTLOOK$|^POWERPOINT$|^SHAREPOINT$|^SKYPE$|^VISIO$|^VISUALSTUDIO$)/i.test(databasename)) {
				return false;
			}
			//Check if database name contains forbidden words.
			if (/(LOGIN|MICROSOFT|WINDOWS|XBOX)/i.test(databasename)) {
				return false;
			}
			//Check if database name doesn't contain invalid characters, and also check if the name doesn't end with a space or period.
			if (/^[^<>*%&:\\\/?]*[^. <>*%&:\\\/?]$/.test(databasename)) {
				return true;
			}
			else {
				return false;
			}
		} else {
			return false;
		}
	}

	private createDatabaseNameText(view: azdata.ModelView) {

		this._databaseNameTextbox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			required: true,
			validationErrorMessage: localize('deployAzureSQLDB.DBDatabaseNameError', "Database name must less than 128 characters, can't end with '.' or ' ', can't contain '<,>,*,%,&,:,\,/,?' or control characters, or be a reserved name found here: https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/error-reserved-resource-name")
		}).withValidation(component => this.validateDatabaseNameText(component.value)).component();

		this._databaseNameTextRow = this.wizard.createFormRowComponent(view, constants.DatabaseNameLabel, '', this._databaseNameTextbox, true);

		this._databaseNameTextbox.onTextChanged((value) => {
			this.wizard.model.databaseName = value;
		});
	}

	//Collation name has no rules, aside from it not being all spaces (No REST APIs exist for finding the list).
	private validateCollationNameText(collationName: string | undefined): boolean {
		if (collationName) {
			//Check for collation name that is only spaces.
			if (/^[ ]+$/.test(collationName)) {
				return false;
			}
			else {
				return true;
			}
		} else {
			return false;
		}
	}

	private createCollationText(view: azdata.ModelView) {
		this._collationTextbox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			inputType: 'text',
			required: true,
			validationErrorMessage: localize('deployAzureSQLDB.DBCollationNameError', "Collation name must not be all spaces."),
			value: 'SQL_Latin1_General_CP1_CI_AS'
		}).withValidation(component => this.validateCollationNameText(component.value)).component();

		this._collationTextbox.onTextChanged((value) => {
			this.wizard.model.databaseCollation = value;
		});

		this._collationTextRow = this.wizard.createFormRowComponent(view, constants.CollationNameLabel, '', this._collationTextbox, true);
	}


	protected async validate(): Promise<string> {
		let errorMessages = [];
		let databasename = this._databaseNameTextbox.value!;

		if (await this.databaseNameExists(databasename)) {
			errorMessages.push(localize('deployAzureSQLDB.DBNameExistsError', "Database name must be unique in the current server."));
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
