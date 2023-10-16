/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EOL } from 'os';
import * as azdata from 'azdata';
import { ResourceTypeWizard } from '../resourceTypeWizard';
import { AzureSQLVMDeploymentProvider } from '../../interfaces';
import * as constants from './constants';
import { IToolsService } from '../../services/toolsService';
import { INotebookService } from '../../services/notebookService';
import axios, { AxiosRequestConfig } from 'axios';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { AzureSettingsPage } from './pages/azureSettingsPage';
import { VmSettingsPage } from './pages/vmSettingsPage';
import { NetworkSettingsPage } from './pages/networkSettingsPage';
import { SqlServerSettingsPage } from './pages/sqlServerSettingsPage';
import { AzureSQLVMSummaryPage } from './pages/summaryPage';
import { ResourceTypeModel } from '../resourceTypeModel';
import { ResourceTypePage } from '../resourceTypePage';
const localize = nls.loadMessageBundle();


export class DeployAzureSQLVMWizardModel extends ResourceTypeModel {
	private cache: Map<string, any> = new Map();

	public azureAccount!: azdata.Account;
	public securityToken!: any;
	public azureSubscription!: string;
	public azureSubscriptionDisplayName!: string;
	public azureResouceGroup!: string;
	public azureRegion!: string;

	public vmName!: string;
	public vmUsername!: string;
	public vmPassword!: string;
	public vmImage!: string;
	public vmImageSKU!: string;
	public vmImageVersion!: string;
	public vmSize!: string;

	public virtualNetworkName!: string;
	public newVirtualNetwork!: 'True' | 'False';
	public subnetName!: string;
	public newSubnet!: 'True' | 'False';
	public publicIpName!: string;
	public newPublicIp!: 'True' | 'False';
	public allowRDP!: 'True' | 'False';

	public sqlConnectivityType!: string;
	public port!: number;
	public enableSqlAuthentication!: string;
	public sqlAuthenticationUsername!: string;
	public sqlAuthenticationPassword!: string;
	public sqlOptimizationDropdown!: string;

	public get notebookService(): INotebookService {
		return this.wizard.notebookService;
	}

	public get toolService(): IToolsService {
		return this.wizard.toolsService;
	}


	constructor(public sqlvmProvider: AzureSQLVMDeploymentProvider, wizard: ResourceTypeWizard) {
		super(sqlvmProvider, wizard);
		this.wizard.wizardObject.title = constants.WizardTitle;
	}

	initialize(): void {
		this.wizard.setPages(this.getPages());
		this.wizard.wizardObject.generateScriptButton.hidden = true;
		this.wizard.wizardObject.doneButton.label = constants.WizardDoneButtonLabel;
	}

	async onOk(): Promise<void> {
		await this.scriptToNotebook();
	}

	private getPages(): ResourceTypePage[] {
		const pages: ResourceTypePage[] = [];
		pages.push(new AzureSettingsPage(this));
		pages.push(new VmSettingsPage(this));
		pages.push(new NetworkSettingsPage(this));
		pages.push(new SqlServerSettingsPage(this));
		pages.push(new AzureSQLVMSummaryPage(this));
		return pages;
	}


	private async scriptToNotebook(): Promise<void> {
		this.setNotebookEnvironmentVariables(process.env);
		const variableValueStatements = this.getCodeCellContentForNotebook();
		const insertionPosition = 2; // Cell number 5 is the position where the python variable setting statements need to be inserted in this.wizardInfo.notebook.
		try {
			await this.notebookService.openNotebookWithEdits(this.sqlvmProvider.azureSQLVMWizard.notebook, variableValueStatements, insertionPosition);
		} catch (error) {
			vscode.window.showErrorMessage(error);
		}
	}

	private setNotebookEnvironmentVariables(env: NodeJS.ProcessEnv): void {
		env['AZDATA_NB_VAR_AZURE_SQLVM_PASSWORD'] = this.vmPassword;
		env['AZDATA_NB_VAR_AZURE_SQLVM_SQL_PASSWORD'] = this.sqlAuthenticationPassword;
	}


	public async getRequest(url: string, useCache = false): Promise<any> {
		if (useCache) {
			if (this.cache.has(url)) {
				return this.cache.get(url);
			}
		}
		let token = this.securityToken.token;
		const config: AxiosRequestConfig = {
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			validateStatus: () => true // Never throw
		};
		const response = await axios.get(url, config);
		if (response.status !== 200) {
			let errorMessage: string[] = [];
			errorMessage.push(response.status.toString());
			errorMessage.push(response.statusText);
			if (response.data && response.data.error) {
				errorMessage.push(`${response.data.error.code} : ${response.data.error.message}`);
			}
			vscode.window.showErrorMessage(errorMessage.join(EOL));
		}
		if (useCache) {
			this.cache.set(url, response);
		}
		return response;
	}

	public createFormRowComponent(view: azdata.ModelView, title: string, description: string, component: azdata.Component, required: boolean): azdata.FlexContainer {

		component.updateProperties({
			required: required,
			width: '480px'
		});

		const labelText = view.modelBuilder.text()
			.withProps(
				{
					value: title,
					width: '250px',
					description: description,
					requiredIndicator: required,
				})
			.component();

		labelText.updateCssStyles({
			'font-weight': '400',
			'font-size': '13px',
		});

		const flexContainer = view.modelBuilder.flexContainer()
			.withLayout(
				{
					flexFlow: 'row',
					alignItems: 'center',
				})
			.withItems(
				[labelText, component],
				{
					CSSStyles: { 'margin-right': '5px' }
				})
			.component();
		return flexContainer;
	}

	public changeComponentDisplay(component: azdata.Component, display: ('none' | 'block')) {
		component.updateProperties({
			required: display === 'block'
		});
		component.updateCssStyles({
			display: display
		});
	}

	public changeRowDisplay(container: azdata.FlexContainer, display: ('none' | 'block')) {
		container.items.map((component) => {
			component.updateProperties({
				required: (display === 'block'),
			});
			component.updateCssStyles({
				display: display,
			});
		});
	}

	public addDropdownValues(component: azdata.DropDownComponent, values: azdata.CategoryValue[], width?: number) {
		component.updateProperties({
			values: values,
			width: '480px'
		});
	}

	public validatePassword(password: string): string[] {
		/**
		 * 1. Password length should be between 12 and 123.
		 * 2. Password must have 3 of the following: 1 lower case character, 1 upper case character, 1 number, and 1 special character.
		 */

		let errorMessages = [];

		if (password.length < 12 || password.length > 123) {
			errorMessages.push(localize('sqlVMDeploymentWizard.PasswordLengthError', "Password must be between 12 and 123 characters long."));
		}

		let charTypeCounter = 0;

		if (new RegExp('.*[a-z].*').test(password)) {
			charTypeCounter++;
		}

		if (new RegExp('.*[A-Z].*').test(password)) {
			charTypeCounter++;
		}

		if (new RegExp('.*[0-9].*').test(password)) {
			charTypeCounter++;
		}

		if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password)) {
			charTypeCounter++;
		}

		if (charTypeCounter < 3) {
			errorMessages.push(localize('sqlVMDeploymentWizard.PasswordSpecialCharRequirementError', "Password must have 3 of the following: 1 lower case character, 1 upper case character, 1 number, and 1 special character."));
		}

		return errorMessages;
	}


	public override getCodeCellContentForNotebook(): string[] {

		const statements: string[] = [];
		statements.push('import os');
		statements.push(`azure_sqlvm_nb_var_subscription = '${this.azureSubscription}'`);
		statements.push(`azure_sqlvm_nb_var_resource_group_name = '${this.azureResouceGroup}'`);
		statements.push(`azure_sqlvm_location = '${this.azureRegion}'`);
		statements.push(`azure_sqlvm_vmname = '${this.vmName}'`);
		statements.push(`azure_sqlvm_username = '${this.vmUsername}'`);
		statements.push(`azure_sqlvm_image = '${this.vmImage}'`);
		statements.push(`azure_sqlvm_image_sku = '${this.vmImageSKU}'`);
		statements.push(`azure_sqlvm_image_version = '${this.vmImageVersion}'`);
		statements.push(`azure_sqlvm_vmsize = '${this.vmSize}'`);
		statements.push(`azure_sqlvm_newVirtualNetwork = ${this.newVirtualNetwork}`);
		statements.push(`azure_sqlvm_virtnet = '${this.virtualNetworkName}'`);
		statements.push(`azure_sqlvm_newSubnet = ${this.newSubnet}`);
		statements.push(`azure_sqlvm_subnet = '${this.subnetName}'`);
		statements.push(`azure_sqlvm_newPublicIp = ${this.newPublicIp}`);
		statements.push(`azure_sqlvm_publicip = '${this.publicIpName}'`);
		statements.push(`azure_sqlvm_allow_rdp = ${this.allowRDP}`);
		statements.push(`azure_sqlvm_sqlConnectivityType = '${this.sqlConnectivityType}'`);
		statements.push(`azure_sqlvm_port = '${this.port}'`);
		statements.push(`azure_sqlvm_enableSqlAuthentication = ${this.enableSqlAuthentication}`);
		statements.push(`azure_sqlvm_sqlAuthenticationUsername = '${this.sqlAuthenticationUsername}'`);

		return statements.map(line => line + EOL);
	}
}
