/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { IWizardPageWrapper } from '../wizardPageWrapper';
import { VirtualizeDataModel } from './virtualizeDataModel';
import { VirtualizeDataInput } from '../../services/contracts';
import { getDropdownValue } from '../../utils';
import { AppContext } from '../../appContext';
import { VDIManager } from './virtualizeDataInputManager';
import { dataSourcePrefixMapping, connectionPageInfoMapping } from '../../constants';

export class ConnectionDetailsPage implements IWizardPageWrapper {

	private _page: azdata.window.WizardPage;
	private _modelBuilder: azdata.ModelBuilder;
	private _mainContainer: azdata.FlexContainer;

	private _dataSourceNameForm: azdata.FormComponent;
	private _sourceServerInfoComponentsFormGroup: azdata.FormComponentGroup;
	private _credentialComponentsFormGroup: azdata.FormComponentGroup;

	private _dataSourceNameDropDown: azdata.DropDownComponent;
	private _serverNameInput: azdata.InputBoxComponent;
	private _databaseNameInput: azdata.InputBoxComponent;
	private _existingCredDropdown: azdata.DropDownComponent;
	private _credentialNameInput: azdata.InputBoxComponent;
	private _usernameInput: azdata.InputBoxComponent;
	private _passwordInput: azdata.InputBoxComponent;

	private readonly _createCredLabel = localize('newCredOption', '-- Create New Credential --');
	private readonly _parentLayout: azdata.FormItemLayout = { horizontal: true, componentWidth: '600px' };
	private readonly _dataSourceNameInputBoxLayout: azdata.FormItemLayout =
		Object.assign({ info: localize('dataSourceHelpText', 'The name for your External Data Source.') }, this._parentLayout);
	private readonly _existingCredDropdownLayout: azdata.FormItemLayout =
		Object.assign({
			info: localize('credNameHelpText',
				'The name of the Database Scoped Credential used to securely store the login information for the External Data Source you are creating.')
		}, this._parentLayout);

	private _currentDataSourceType: string;
	private _currentDestDbName: string;

	constructor(private _dataModel: VirtualizeDataModel, private _vdiManager: VDIManager, private _appContext: AppContext) {
		this._page = this._appContext.apiWrapper.createWizardPage(localize('connectionDetailsTitle', 'Create a connection to your Data Source'));
		this._page.registerContent(async (modelView) => {
			this._modelBuilder = modelView.modelBuilder;
			this._mainContainer = this._modelBuilder.flexContainer().component();
			await modelView.initializeModel(this._mainContainer);
		});
	}

	public async buildMainContainer(): Promise<void> {
		// Create data source fields first, since it preloads the database metadata
		await this.buildDataSourceNameForm();
		await this.buildSourceServerInfoComponentsFormGroup();
		await this.buildCredentialComponentsFormGroup();
		const serverAndCredentialComponents: (azdata.FormComponent | azdata.FormComponentGroup)[] = [];
		serverAndCredentialComponents.push(this._sourceServerInfoComponentsFormGroup);
		serverAndCredentialComponents.push(this._credentialComponentsFormGroup);

		const mainFormBuilder: azdata.FormBuilder = this._modelBuilder.formContainer();
		mainFormBuilder.addFormItem(this._dataSourceNameForm, this._dataSourceNameInputBoxLayout);
		mainFormBuilder.addFormItems(serverAndCredentialComponents, this._parentLayout);
		this._mainContainer.clearItems();
		this._mainContainer.addItem(mainFormBuilder.component());
	}

	public async buildDataSourceNameForm(): Promise<void> {
		let destinationDB = this._vdiManager.destinationDatabaseName;
		let dbInfo = await this._dataModel.loadDatabaseInfo(destinationDB);
		let existingDataSources = dbInfo ? dbInfo.externalDataSources : [];
		const locationPrefix = dataSourcePrefixMapping.get(this._currentDataSourceType) ?? '';
		existingDataSources = existingDataSources.filter(ds => ds.location.startsWith(locationPrefix));

		let dataSourceInfo = existingDataSources.map(e => {
			return { name: e.name, location: e.location, credName: e.credentialName };
		});

		this._dataSourceNameDropDown = this._modelBuilder.dropDown().component();
		await this._dataSourceNameDropDown.updateProperties({
			values: [''].concat(dataSourceInfo.map(e => `${e.name} (${e.location}, ${e.credName})`)),
			value: undefined,
			editable: true,
			height: undefined,
			enabled: true,
			fireOnTextChange: true
		});

		this._dataSourceNameDropDown.onValueChanged(async () => {
			let dataSourceName = getDropdownValue(this._dataSourceNameDropDown.value);
			let dsInfo = dataSourceInfo.find(e => dataSourceName === `${e.name} (${e.location}, ${e.credName})`);
			if (dsInfo) {
				await this._dataSourceNameDropDown.updateProperties({ value: dsInfo.name });
				return;
			}
			if (dataSourceName === '') {
				await this._dataSourceNameDropDown.updateProperties({ value: undefined });
				await this.toggleServerCredInputs(true, '', this._createCredLabel, '', '', '');
				return;
			}
			let selectedDataSource = existingDataSources.find(ds => ds.name === this._dataSourceNameDropDown.value);
			if (selectedDataSource) {
				let serverName: string = selectedDataSource.location.substring(locationPrefix.length);
				await this.toggleServerCredInputs(false, serverName, selectedDataSource.credentialName,
					selectedDataSource.credentialName, selectedDataSource.username, '');
				return;
			}
			if (!this._serverNameInput.enabled) {
				await this.toggleServerCredInputs(true, '', this._createCredLabel, '', '', '');
				return;
			}
		});

		this._dataSourceNameForm = <azdata.FormComponent>{
			component: this._dataSourceNameDropDown,
			title: localize('sourceNameInput', 'External Data Source Name'),
			required: true
		};
	}

	public async toggleServerCredInputs(
		enable: boolean,
		serverNameValue: string,
		credDropDownValue: string,
		credNameValue: string,
		usernameValue: string,
		passwordValue: string
	): Promise<void> {
		// There is a bug in recognizing required field.
		// As workaround, it intentionally updates 'enabled' property first and then update 'value'
		await this._serverNameInput.updateProperties({ enabled: enable });
		await this._existingCredDropdown.updateProperties({ enabled: enable });
		await this._credentialNameInput.updateProperties({ enabled: enable });
		await this._usernameInput.updateProperties({ enabled: enable });
		await this._passwordInput.updateProperties({ enabled: enable });

		await this._serverNameInput.updateProperties({ value: serverNameValue });
		await this._existingCredDropdown.updateProperties({ value: credDropDownValue });
		await this._credentialNameInput.updateProperties({ value: credNameValue });
		await this._usernameInput.updateProperties({ value: usernameValue });
		await this._passwordInput.updateProperties({ value: passwordValue });
	}

	// Server-specific fields
	public async buildSourceServerInfoComponentsFormGroup(): Promise<void> {
		let serverNameValue: string = '';
		let dbNameValue: string = '';

		const connectionPageInfo = connectionPageInfoMapping.get(this._currentDataSourceType);

		let sourceServerInfoComponents: azdata.FormComponent[] = [];

		this._serverNameInput = this._modelBuilder.inputBox().withProps({
			value: serverNameValue
		}).component();
		sourceServerInfoComponents.push({
			component: this._serverNameInput,
			title: connectionPageInfo.serverNameTitle,
			required: true
		});

		this._databaseNameInput = this._modelBuilder.inputBox().withProps({
			value: dbNameValue
		}).component();
		sourceServerInfoComponents.push({
			component: this._databaseNameInput,
			title: connectionPageInfo.databaseNameTitle,
			required: connectionPageInfo.isDbRequired
		});

		this._sourceServerInfoComponentsFormGroup = {
			components: sourceServerInfoComponents,
			title: localize('serverFields', 'Server Connection')
		};
	}

	// Credential fields
	public async buildCredentialComponentsFormGroup(): Promise<void> {
		let credentialNames = this._dataModel.existingCredentials ?
			this._dataModel.existingCredentials.map(cred => cred.credentialName) : [];
		credentialNames.unshift(this._createCredLabel);

		let credDropDownValues: string[] = credentialNames;
		let credDropDownValue: string = this._createCredLabel;
		let credDropDownRequired: boolean = true;
		let credNameValue: string = '';
		let credNameRequired: boolean = true;
		let usernameValue: string = '';
		let usernameRequired: boolean = true;
		let passwordValue: string = '';
		let passwordRequired: boolean = true;

		let credentialComponents: (azdata.FormComponent & { layout?: azdata.FormItemLayout })[] = [];

		this._existingCredDropdown = this._modelBuilder.dropDown().withProps({
			values: credDropDownValues,
			value: credDropDownValue,
		}).component();
		this._existingCredDropdown.onValueChanged(async (selection) => {
			if (selection.selected === this._createCredLabel) {
				await this.toggleCredentialInputs(true);
			} else {
				await this.toggleCredentialInputs(false);
				await this._credentialNameInput.updateProperties({ value: '' });
				let credential = this._dataModel.existingCredentials.find(cred => cred.credentialName === selection.selected);
				await this._usernameInput.updateProperties({ value: credential ? credential.username : '' });
				await this._passwordInput.updateProperties({ value: '' });
			}
		});

		credentialComponents.push({
			component: this._existingCredDropdown,
			title: localize('credentialNameDropdown', 'Choose Credential'),
			required: credDropDownRequired,
			layout: this._existingCredDropdownLayout
		});

		this._credentialNameInput = this._modelBuilder.inputBox().withProps({
			value: credNameValue,
		}).component();

		credentialComponents.push({
			component: this._credentialNameInput,
			title: localize('credentialNameInput', 'New Credential Name'),
			required: credNameRequired
		});

		this._usernameInput = this._modelBuilder.inputBox().withProps({
			value: usernameValue,
		}).component();

		credentialComponents.push({
			component: this._usernameInput,
			title: localize('usernameInput', 'Username'),
			required: usernameRequired
		});

		this._passwordInput = this._modelBuilder.inputBox().withProps({
			value: passwordValue,
			inputType: 'password'
		}).component();

		credentialComponents.push({
			component: this._passwordInput,
			title: localize('passwordInput', 'Password'),
			required: passwordRequired
		});

		this._credentialComponentsFormGroup = {
			components: credentialComponents,
			title: localize('credentialFields', 'Configure Credential')
		};
	}

	public async validate(): Promise<boolean> {
		let inputValues = this._vdiManager.getVirtualizeDataInput(this);
		return this._dataModel.validateInput(inputValues);
	}

	public getPage(): azdata.window.WizardPage {
		return this._page;
	}

	public async updatePage(): Promise<void> {
		let newDataSourceType = this._vdiManager.sourceServerType;
		let newDestDbName = this._vdiManager.destinationDatabaseName;
		if ((newDataSourceType && this._currentDataSourceType !== newDataSourceType)
			|| (newDestDbName && this._currentDestDbName !== newDestDbName)) {
			this._currentDataSourceType = newDataSourceType;
			this._currentDestDbName = newDestDbName;
			await this.buildMainContainer();
		}
	}

	private async toggleCredentialInputs(enable: boolean): Promise<void> {
		await this._credentialNameInput.updateProperties({ enabled: enable });
		await this._usernameInput.updateProperties({ enabled: enable });
		await this._passwordInput.updateProperties({ enabled: enable });
	}

	public getInputValues(existingInput: VirtualizeDataInput): void {
		if (!this._dataSourceNameDropDown) { return; }

		let isNewDataSource: boolean = this._serverNameInput ? this._serverNameInput.enabled : undefined;
		let dataSourceName: string = this._dataSourceNameDropDown ? getDropdownValue(this._dataSourceNameDropDown.value) : undefined;
		if (isNewDataSource) {
			existingInput.newDataSourceName = dataSourceName;
			let isNewCredential: boolean = this._existingCredDropdown ?
				this._existingCredDropdown.value === this._createCredLabel : undefined;
			if (isNewCredential) {
				existingInput.newCredentialName = this._credentialNameInput ? this._credentialNameInput.value : undefined;
				existingInput.sourceUsername = this._usernameInput ? this._usernameInput.value : undefined;
				existingInput.sourcePassword = this._passwordInput ? this._passwordInput.value : undefined;
			} else {
				existingInput.existingCredentialName = this._existingCredDropdown ?
					getDropdownValue(this._existingCredDropdown.value) : undefined;
			}
		} else {
			existingInput.existingDataSourceName = dataSourceName;
			existingInput.existingCredentialName = this._existingCredDropdown ?
				getDropdownValue(this._existingCredDropdown.value) : undefined;
		}
		existingInput.sourceServerName = this._serverNameInput ? this._serverNameInput.value : undefined;
		existingInput.sourceDatabaseName = this._databaseNameInput ? this._databaseNameInput.value : undefined;
	}
}
