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
import { AzureSQLDBWizardInfo } from '../../interfaces';
import { AzureSettingsPage } from './pages/azureSettingsPage';
import { DatabaseSettingsPage } from './pages/databaseSettingsPage';
import axios, { AxiosRequestConfig } from 'axios';
import { AzureSQLDBSummaryPage } from './pages/summaryPage';

export class DeployAzureSQLDBWizard extends WizardBase<DeployAzureSQLDBWizard, WizardPageBase<DeployAzureSQLDBWizard>, DeployAzureSQLDBWizardModel> {

	constructor(private wizardInfo: AzureSQLDBWizardInfo, private _notebookService: INotebookService, private _toolsService: IToolsService) {
		super(
			constants.WizardTitle,
			new DeployAzureSQLDBWizardModel(),
			_toolsService
		);
	}

	public get notebookService(): INotebookService {
		return this._notebookService;
	}

	public get toolService(): IToolsService {
		return this._toolsService;
	}

	protected initialize(): void {
		this.setPages(this.getPages());
		this.wizardObject.generateScriptButton.hidden = true;
		this.wizardObject.doneButton.label = constants.WizardDoneButtonLabel;
	}

	protected async onOk(): Promise<void> {
		await this.scriptToNotebook();
	}

	protected onCancel(): void {
	}

	private getPages(): WizardPageBase<DeployAzureSQLDBWizard>[] {
		const pages: WizardPageBase<DeployAzureSQLDBWizard>[] = [];
		pages.push(new AzureSettingsPage(this));
		pages.push(new DatabaseSettingsPage(this));
		pages.push(new AzureSQLDBSummaryPage(this));
		return pages;
	}

	private async scriptToNotebook(): Promise<void> {
		const variableValueStatements = this.model.getCodeCellContentForNotebook();
		const insertionPosition = 2; // Cell number 2 is the position where the python variable setting statements need to be inserted in this.wizardInfo.notebook.
		try {
			await this.notebookService.launchNotebookWithEdits(this.wizardInfo.notebook, variableValueStatements, insertionPosition);
		} catch (error) {
			vscode.window.showErrorMessage(error);
		}
	}


	public async getRequest(url: string): Promise<any> {
		let token = this.model.securityToken.token;
		const config: AxiosRequestConfig = {
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			validateStatus: () => true // Never throw
		};
		const response = await axios.get(url, config);
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
}
