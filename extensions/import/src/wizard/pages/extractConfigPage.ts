/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import { DacFxDataModel } from '../api/models';
import { DataTierApplicationWizard } from '../dataTierApplicationWizard';
import { DacFxConfigPage } from '../api/dacFxConfigPage';

const localize = nls.loadMessageBundle();

export class ExtractConfigPage extends DacFxConfigPage {

	protected readonly wizardPage: sqlops.window.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: sqlops.ModelView;

	private form: sqlops.FormContainer;
	private versionTextBox: sqlops.InputBoxComponent;

	public constructor(instance: DataTierApplicationWizard, wizardPage: sqlops.window.WizardPage, model: DacFxDataModel, view: sqlops.ModelView) {
		super(instance, wizardPage, model, view);
		this.fileExtension = '.dacpac';
	}

	async start(): Promise<boolean> {
		let databaseComponent = await this.createDatabaseDropdown();
		let serverComponent = await this.createServerDropdown(false);
		let fileBrowserComponent = await this.createFileBrowser();
		let versionComponent = await this.createVersionTextBox();

		this.form = this.view.modelBuilder.formContainer()
			.withFormItems(
				[
					serverComponent,
					databaseComponent,
					versionComponent,
					fileBrowserComponent,
				], {
					horizontal: true,
					componentWidth: 400
				}).component();
		await this.view.initializeModel(this.form);
		return true;
	}

	async onPageEnter(): Promise<boolean> {
		let r1 = await this.populateServerDropdown();
		let r2 = await this.populateDatabaseDropdown();
		return r1 && r2;
	}

	public setupNavigationValidator() {
		this.instance.registerNavigationValidator(() => {
			if (this.databaseLoader.loading) {
				return false;
			}
			return true;
		});
	}

	private async createFileBrowser(): Promise<sqlops.FormComponent> {
		this.createFileBrowserParts();

		// default filepath
		this.fileTextBox.value = this.generateFilePath();
		this.model.filePath = this.fileTextBox.value;

		this.fileButton.onDidClick(async (click) => {
			let fileUri = await vscode.window.showSaveDialog(
				{
					defaultUri: vscode.Uri.file(this.fileTextBox.value),
					saveLabel: localize('dacfxExtract.saveFile', 'Save'),
					filters: {
						'dacpac Files': ['dacpac'],
					}
				}
			);

			if (!fileUri) {
				return;
			}

			this.fileTextBox.value = fileUri.fsPath;
			this.model.filePath = fileUri.fsPath;
		});

		this.fileTextBox.onTextChanged(async () => {
			this.model.filePath = this.fileTextBox.value;
		});

		return {
			component: this.fileTextBox,
			title: localize('dacFxExtract.fileTextboxTitle', 'File Location'),
			actions: [this.fileButton]
		};
	}

	private async createVersionTextBox(): Promise<sqlops.FormComponent> {
		this.versionTextBox = this.view.modelBuilder.inputBox().withProperties({
			required: true
		}).component();

		// default filepath
		this.versionTextBox.value = '1.0.0.0';
		this.model.version = this.versionTextBox.value;

		this.versionTextBox.onTextChanged(async () => {
			this.model.version = this.versionTextBox.value;
		});

		return {
			component: this.versionTextBox,
			title: localize('dacFxExtract.versionTextboxTitle', 'Version (use x.x.x.x where x is a number)'),
		};
	}
}
