/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from './constants';
import { INotebookService } from '../../services/notebookService';
import { IToolsService } from '../../services/toolsService';
import { WizardBase } from '../wizardBase';
import { WizardPageBase } from '../wizardPageBase';
import { DeployAzureSQLVMWizardModel } from './deployAzureSQLVMWizardModel';
import { AzureSQLVMWizardInfo } from '../../interfaces';
import { AzureSettingsPage } from './pages/azureSettingsPage';

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
			new DeployAzureSQLVMWizardModel()
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
		throw new Error('Method not implemented.');
	}

	private getPages(): WizardPageBase<DeployAzureSQLVMWizard>[] {
		const pages: WizardPageBase<DeployAzureSQLVMWizard>[] = [];
		pages.push(new AzureSettingsPage(this));
		return pages;
	}

	private async scriptToNotebook(): Promise<void> {
		this.setEnvironmentVariables(process.env);
		const variableValueStatements = this.model.getCodeCellContentForNotebook(this._toolsService.toolsForCurrentProvider);
		const insertionPosition = 5; // Cell number 5 is the position where the python variable setting statements need to be inserted in this.wizardInfo.notebook.
		try {
			await this.notebookService.launchNotebookWithEdits(this.wizardInfo.notebook, variableValueStatements, insertionPosition);
		} catch (error) {
			// vscode.window.showErrorMessage(getErrorMessage(error));
		}
	}

	private setEnvironmentVariables(env: NodeJS.ProcessEnv): void {
		// env[VariableNames.AdminPassword_VariableName] = this.model.getStringValue(VariableNames.AdminPassword_VariableName);
		// env[VariableNames.DockerPassword_VariableName] = this.model.getStringValue(VariableNames.DockerPassword_VariableName);
		// if (this.model.authenticationMode === AuthenticationMode.ActiveDirectory) {
		// 	env[VariableNames.DomainServiceAccountPassword_VariableName] = this.model.getStringValue(VariableNames.DomainServiceAccountPassword_VariableName);
		// }
	}
}
