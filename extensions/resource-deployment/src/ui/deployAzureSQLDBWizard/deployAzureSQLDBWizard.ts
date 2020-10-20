/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from './constants';
import { INotebookService } from '../../services/notebookService';
import { IToolsService } from '../../services/toolsService';
import { WizardBase } from '../wizardBase';
import { WizardPageBase } from '../wizardPageBase';
import { DeployAzureSQLDBWizardModel } from './deployAzureSQLDBWizardModel';
import { AzureSQLDBWizardInfo, instanceOfAzureSQLDBDeploymentProvider, ResourceType } from '../../interfaces';
import { AzureSettingsPage } from './pages/azureSettingsPage';
import { DatabaseSettingsPage } from './pages/databaseSettingsPage';
import axios, { AxiosRequestConfig } from 'axios';
import { AzureSQLDBSummaryPage } from './pages/summaryPage';
import { EOL } from 'os';
import { IResourceTypeService } from '../../services/resourceTypeService';
import { ToolsAndEulaPage } from '../ToolsAndEulaPage';

export class DeployAzureSQLDBWizard extends WizardBase<WizardPageBase<DeployAzureSQLDBWizard, DeployAzureSQLDBWizardModel>, DeployAzureSQLDBWizardModel> {
	private _wizardInfo!: AzureSQLDBWizardInfo;

	constructor(private _notebookService: INotebookService, private _toolsService: IToolsService, resourceType: ResourceType, resourceTypeService?: IResourceTypeService) {
		super(
			constants.WizardTitle,
			'DeployAzureSqlDBWizard',
			new DeployAzureSQLDBWizardModel(),
			_toolsService,
			false,
			resourceType,
			resourceTypeService
		);
	}

	private cache: Map<string, any> = new Map();

	protected initialize(): void {
		this.setPages(this.getPages());
		this.wizardObject.generateScriptButton.hidden = true;
		this.wizardObject.doneButton.label = constants.WizardDoneButtonLabel;
	}


	public get notebookService(): INotebookService {
		return this._notebookService;
	}

	public get toolService(): IToolsService {
		return this._toolsService;
	}

	protected async onOk(): Promise<void> {
		if (instanceOfAzureSQLDBDeploymentProvider(this.resourceProvider)) {
			await this.scriptToNotebook();
		} else {
			super.onOk();
		}
	}

	public refreshWizard() {
		if (instanceOfAzureSQLDBDeploymentProvider(this.resourceProvider)) {
			this._wizardInfo = this.resourceProvider.azureSQLDBWizard;
		}
	}

	protected onCancel(): void {
	}

	private getPages(): WizardPageBase<DeployAzureSQLDBWizard, DeployAzureSQLDBWizardModel>[] {
		const pages: WizardPageBase<DeployAzureSQLDBWizard, DeployAzureSQLDBWizardModel>[] =
			[
				new ToolsAndEulaPage<DeployAzureSQLDBWizard, DeployAzureSQLDBWizardModel>(this, this._resourceType!),
				new AzureSettingsPage(this),
				new DatabaseSettingsPage(this),
				new AzureSQLDBSummaryPage(this)
			];
		return pages;
	}

	private async scriptToNotebook(): Promise<void> {
		const variableValueStatements = this.model.getCodeCellContentForNotebook();
		const insertionPosition = 2; // Cell number 2 is the position where the python variable setting statements need to be inserted in this.wizardInfo.notebook.
		try {
			await this.notebookService.openNotebookWithEdits(this._wizardInfo.notebook, variableValueStatements, insertionPosition);
		} catch (error) {
			vscode.window.showErrorMessage(error);
		}
	}


	public async getRequest(url: string, useCache = false): Promise<any> {
		if (useCache) {
			if (this.cache.has(url)) {
				return this.cache.get(url);
			}
		}
		let token = this.model.securityToken.token;
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

	public showErrorMessage(message: string) {
		this.wizardObject.message = {
			text: message,
			level: azdata.window.MessageLevel.Error
		};
	}

	public async refreshPages() {

		const pageCount = this.wizardObject.pages.length;
		// Removing all pages except the tools and Eula one (first page)
		for (let i = 1; i < pageCount; i++) {
			this.wizardObject.removePage(this.wizardObject.pages.length - 1);
			this.wizardObject.pages.pop();
		}
		if (instanceOfAzureSQLDBDeploymentProvider(this.resourceProvider)) {
			this._wizardInfo = this.resourceProvider.azureSQLDBWizard!;
		} else {
			return;
		}

		const newPages = this.getPages();

		newPages[0] = this.pages[0];

		this.pages = newPages;

		for (let i = 1; i < newPages.length; i++) {
			newPages[i].pageObject.onValidityChanged((isValid: boolean) => {
				// generateScriptButton is enabled only when the page is valid.
				this.wizardObject.generateScriptButton.enabled = isValid;
			});
			newPages[i].initialize();
			this.wizardObject.addPage(newPages[i].pageObject);
		}
	}
}
