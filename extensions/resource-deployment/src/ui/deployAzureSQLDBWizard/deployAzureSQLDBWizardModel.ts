/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EOL } from 'os';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from './constants';
import axios, { AxiosRequestConfig } from 'axios';
import { ResourceTypeModel } from '../resourceTypeModel';
import { INotebookService } from '../../services/notebookService';
import { IToolsService } from '../../services/toolsService';
import { AzureSQLDBDeploymentProvider } from '../../interfaces';
import { ResourceTypeWizard } from '../resourceTypeWizard';
import { ResourceTypePage } from '../resourceTypePage';
import { DatabaseSettingsPage } from './pages/databaseSettingsPage';
import { AzureSQLDBSummaryPage } from './pages/summaryPage';
import { AzureSettingsPage } from './pages/azureSettingsPage';

export class DeployAzureSQLDBWizardModel extends ResourceTypeModel {
	private cache: Map<string, any> = new Map();

	public azureAccount!: azdata.Account;
	public securityToken!: any;
	public azureSubscription!: string;
	public azureSubscriptionDisplayName!: string;
	public azureResouceGroup!: string;
	public azureServerName!: string;
	public azureRegion!: string;

	// public databaseEdition!: string; //@todo alma1 10/7/2020 used for upcoming database hardware creation feature
	// public databaseFamily!: string;
	// public vCoreNumber!: number;
	// public storageInGB!: string;

	public databaseName!: string;
	//public newServer!: 'True' | 'False'; //@todo alma1 9/8/2020 used for upcoming server creation feature.
	public startIpAddress!: string;
	public endIpAddress!: string;
	public firewallRuleName!: string;
	public databaseCollation!: string;
	public newFirewallRule!: boolean;

	public get notebookService(): INotebookService {
		return this.wizard.notebookService;
	}

	public get toolService(): IToolsService {
		return this.wizard.toolsService;
	}

	constructor(public sqldbProvider: AzureSQLDBDeploymentProvider, wizard: ResourceTypeWizard) {
		super(sqldbProvider, wizard);
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
		pages.push(new DatabaseSettingsPage(this));
		pages.push(new AzureSQLDBSummaryPage(this));
		return pages;
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
			.withProperties<azdata.TextComponentProperties>(
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

	private async scriptToNotebook(): Promise<void> {
		const variableValueStatements = this.getCodeCellContentForNotebook();
		const insertionPosition = 2; // Cell number 2 is the position where the python variable setting statements need to be inserted in this.wizardInfo.notebook.
		try {
			await this.notebookService.openNotebookWithEdits(this.sqldbProvider.azureSQLDBWizard.notebook, variableValueStatements, insertionPosition);
		} catch (error) {
			vscode.window.showErrorMessage(error);
		}
	}

	public getCodeCellContentForNotebook(): string[] {
		const statements: string[] = [];

		statements.push(`azure_sqldb_subscription = '${this.azureSubscription}'`);
		statements.push(`azure_sqldb_resource_group_name = '${this.azureResouceGroup}'`);
		statements.push(`azure_sqldb_server_name = '${this.azureServerName}'`);
		//statements.push(`azure_sqldb_database_edition = '${this.databaseEdition}'`); //@todo alma1 10/7/2020 used for upcoming datbase hardware creation feature.
		statements.push(`azure_sqldb_database_name = '${this.databaseName}'`);
		statements.push(`azure_sqldb_collation = '${this.databaseCollation}'`);
		//statements.push(`azure_sqldb_location = '${this.azureRegion}'`);  //@todo alma1 9/10/2020 used for upcoming server creation feature.
		statements.push(`azure_sqldb_enable_firewall_rule = ${(this.newFirewallRule) ? 'True' : 'False'}`);
		if (this.newFirewallRule) {
			statements.push(`azure_sqldb_ip_start = '${this.startIpAddress}'`);
			statements.push(`azure_sqldb_ip_end = '${this.endIpAddress}'`);
			statements.push(`azure_sqldb_firewall_name = '${this.firewallRuleName}'`);
		}
		// statements.push(`azure_sqldb_family = '${this.databaseFamily}'`); //@todo alma1 10/7/2020 used for upcoming datbase hardware creation feature.
		// statements.push(`azure_sqldb_vcore = '${this.vCoreNumber}'`);
		// statements.push(`azure_sqldb_maxmemory = '${this.storageInGB}'`);
		//statements.push(`azure_sqldb_new_server = '${this.newServer}'`); //@todo alma1 9/8/2020 used for upcoming server creation feature.

		return statements.map(line => line.concat(EOL));
	}
}
