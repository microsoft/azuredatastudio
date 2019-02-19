/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { DacFxDataModel } from '../api/models';
import { DataTierApplicationWizard, Operation } from '../dataTierApplicationWizard';
import { DacFxConfigPage } from '../api/dacFxConfigPage';

const localize = nls.loadMessageBundle();

export class DeployActionPage extends DacFxConfigPage {

	protected readonly wizardPage: sqlops.window.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: sqlops.ModelView;
	private deployRadioButton: sqlops.RadioButtonComponent;
	private deployScriptRadioButton: sqlops.RadioButtonComponent;
	private scriptRadioButton: sqlops.RadioButtonComponent;
	private form: sqlops.FormContainer;

	public constructor(instance: DataTierApplicationWizard, wizardPage: sqlops.window.WizardPage, model: DacFxDataModel, view: sqlops.ModelView) {
		super(instance, wizardPage, model, view);
	}

	async start(): Promise<boolean> {
		let deployComponent = await this.createDeployRadioButton();
		let deployScriptComponent = await this.createDeployScriptRadioButton();
		let scriptComponent = await this.createScriptRadioButton();
		let fileBrowserComponent = await this.createFileBrowser();

		this.form = this.view.modelBuilder.formContainer()
			.withFormItems(
				[
					deployComponent,
					scriptComponent,
					deployScriptComponent,
					fileBrowserComponent
				]).component();
		await this.view.initializeModel(this.form);

		//default have the first radio button checked
		this.deployRadioButton.checked = true;
		this.toggleFileBrowser(false);

		return true;
	}

	async onPageEnter(): Promise<boolean> {
		// generate script file path in case the database changed since last time the page was entered
		this.setDefaultScriptFilePath();
		return true;
	}

	private async createDeployRadioButton(): Promise<sqlops.FormComponent> {
		this.deployRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'selectedDeployAction',
				label: localize('dacFx.deployRadioButtonLabel', 'Deploy'),
			}).component();

		this.deployRadioButton.onDidClick(() => {
			this.model.generateScriptAndDeploy = false;
			this.instance.setDoneButton(Operation.deploy);
			this.toggleFileBrowser(false);
		});

		return {
			component: this.deployRadioButton,
			title: ''
		};
	}

	private async createDeployScriptRadioButton(): Promise<sqlops.FormComponent> {
		this.deployScriptRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'selectedDeployAction',
				label: localize('dacFx.deployScriptRadioButtonLabel', 'Generate Deployment Script and Deploy'),
			}).component();

		this.deployScriptRadioButton.onDidClick(() => {
			this.model.generateScriptAndDeploy = true;
			this.instance.setDoneButton(Operation.deploy);
			this.toggleFileBrowser(true);
		});

		return {
			component: this.deployScriptRadioButton,
			title: ''
		};
	}

	private async createScriptRadioButton(): Promise<sqlops.FormComponent> {
		this.scriptRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'selectedDeployAction',
				label: localize('dacFx.scriptRadioButtonLabel', 'Generate Deployment Script'),
			}).component();

		this.scriptRadioButton.onDidClick(() => {
			this.model.generateScriptAndDeploy = false;
			this.toggleFileBrowser(true);

			//change button text and operation
			this.instance.setDoneButton(Operation.generateDeployScript);
		});

		return {
			component: this.scriptRadioButton,
			title: ''
		};
	}

	private async createFileBrowser(): Promise<sqlops.FormComponentGroup> {
		this.createFileBrowserParts();

		//default filepath
		this.setDefaultScriptFilePath();
		this.fileButton.onDidClick(async (click) => {
			let fileUri = await vscode.window.showSaveDialog(
				{
					defaultUri: vscode.Uri.file(this.fileTextBox.value),
					saveLabel: localize('dacfxDeployScript.saveFile', 'Save'),
					filters: {
						'SQL Files': ['sql'],
					}
				}
			);

			if (!fileUri) {
				return;
			}

			this.fileTextBox.value = fileUri.fsPath;
			this.model.scriptFilePath = fileUri.fsPath;
		});

		this.fileTextBox.onTextChanged(async () => {
			this.model.scriptFilePath = this.fileTextBox.value;
		});

		return {
			title: '',
			components: [
				{
					title: localize('dacfx.generatedScriptLocation', 'Deployment Script Location'),
					component: this.fileTextBox,
					layout: {
						horizontal: true,
						componentWidth: 400
					},
					actions: [this.fileButton]
				},],
		};
	}

	private toggleFileBrowser(enable: boolean): void {
		this.fileTextBox.enabled = enable;
		this.fileButton.enabled = enable;
	}

	private setDefaultScriptFilePath(): void {
		let now = new Date();
		let datetime = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + '-' + now.getHours() + '-' + now.getMinutes();
		this.fileTextBox.value = path.join(os.homedir(), this.model.database + '_UpgradeDACScript_' + datetime + '.sql');
		this.model.scriptFilePath = this.fileTextBox.value;
	}

	public setupNavigationValidator() {
		this.instance.registerNavigationValidator(() => {
			return true;
		});
	}
}
