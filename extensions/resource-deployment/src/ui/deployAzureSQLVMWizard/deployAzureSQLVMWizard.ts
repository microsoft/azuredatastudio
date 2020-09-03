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
import { DeployAzureSQLVMWizardModel } from './deployAzureSQLVMWizardModel';
import { AzureSQLVMWizardInfo } from '../../interfaces';
import { AzureSettingsPage } from './pages/azureSettingsPage';
import { VmSettingsPage } from './pages/vmSettingsPage';
import axios, { AxiosRequestConfig } from 'axios';
import { NetworkSettingsPage } from './pages/networkSettingsPage';
import { SqlServerSettingsPage } from './pages/sqlServerSettingsPage';
import { AzureSQLVMSummaryPage } from './pages/summaryPage';

export class DeployAzureSQLVMWizard extends WizardBase<DeployAzureSQLVMWizard, WizardPageBase<DeployAzureSQLVMWizard>, DeployAzureSQLVMWizardModel> {

	public get notebookService(): INotebookService {
		return this._notebookService;
	}

	public get toolService(): IToolsService {
		return this._toolsService;
	}

	constructor(private wizardInfo: AzureSQLVMWizardInfo, private _notebookService: INotebookService, private _toolsService: IToolsService) {
		super(
			constants.WizardTitle,
			new DeployAzureSQLVMWizardModel(),
			_toolsService
		);
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

	private getPages(): WizardPageBase<DeployAzureSQLVMWizard>[] {
		const pages: WizardPageBase<DeployAzureSQLVMWizard>[] = [];
		pages.push(new AzureSettingsPage(this));
		pages.push(new VmSettingsPage(this));
		pages.push(new NetworkSettingsPage(this));
		pages.push(new SqlServerSettingsPage(this));
		pages.push(new AzureSQLVMSummaryPage(this));
		return pages;
	}

	private async scriptToNotebook(): Promise<void> {
		this.setEnvironmentVariables(process.env);
		const variableValueStatements = this.model.getCodeCellContentForNotebook();
		const insertionPosition = 3; // Cell number 5 is the position where the python variable setting statements need to be inserted in this.wizardInfo.notebook.
		try {
			await this.notebookService.launchNotebookWithEdits(this.wizardInfo.notebook, variableValueStatements, insertionPosition);
		} catch (error) {
			vscode.window.showErrorMessage(error);
		}
	}

	private setEnvironmentVariables(env: NodeJS.ProcessEnv): void {
		env['AZDATA_NB_VAR_AZURE_SQLVM_PASSWORD'] = this.model.vmPassword;
		env['AZDATA_NB_VAR_AZURE_SQLVM_SQL_PASSWORD'] = this.model.sqlAuthenticationPassword;
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

	public validatePassword(password: string): string {
		/**
		 * 1. Password length should be between 12 and 123.
		 * 2. Password must have 3 of the following: 1 lower case character, 1 upper case character, 1 number, and 1 special character.
		 */

		let errorMessage = '';

		if (password.length < 12 || password.length > 123) {
			errorMessage += 'Password must be between 12 and 123 characters long.\n';
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
			errorMessage += 'Password must have 3 of the following: 1 lower case character, 1 upper case character, 1 number, and 1 special character.\n';
		}

		return errorMessage;
	}
}
