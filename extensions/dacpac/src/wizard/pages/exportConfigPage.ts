/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import { DacFxDataModel } from '../api/models';
import { DataTierApplicationWizard } from '../dataTierApplicationWizard';
import { DacFxConfigPage } from '../api/dacFxConfigPage';

const localize = nls.loadMessageBundle();

export class ExportConfigPage extends DacFxConfigPage {

	protected readonly wizardPage: azdata.window.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: azdata.ModelView;

	private form: azdata.FormContainer;

	public constructor(instance: DataTierApplicationWizard, wizardPage: azdata.window.WizardPage, model: DacFxDataModel, view: azdata.ModelView) {
		super(instance, wizardPage, model, view);
		this.fileExtension = '.bacpac';
	}

	async start(): Promise<boolean> {
		let databaseComponent = await this.createDatabaseDropdown();
		let serverComponent = await this.createServerDropdown(false);
		let fileBrowserComponent = await this.createFileBrowser();

		this.form = this.view.modelBuilder.formContainer()
			.withFormItems(
				[
					serverComponent,
					databaseComponent,
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


	async onPageLeave(): Promise<boolean> {
		this.appendFileExtensionIfNeeded();
		return true;
	}

	public setupNavigationValidator() {
		this.instance.registerNavigationValidator(() => {
			if (this.databaseLoader.loading) {
				return false;
			}
			return true;
		});
	}

	private async createFileBrowser(): Promise<azdata.FormComponent> {
		this.createFileBrowserParts();

		// default filepath
		this.fileTextBox.value = this.generateFilePathFromDatabaseAndTimestamp();
		this.model.filePath = this.fileTextBox.value;

		this.fileButton.onDidClick(async (click) => {
			let fileUri = await vscode.window.showSaveDialog(
				{
					defaultUri: vscode.Uri.file(this.fileTextBox.value),
					saveLabel: localize('dacfxExport.saveFile', 'Save'),
					filters: {
						'bacpac Files': ['bacpac'],
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
			title: localize('dacFxExport.fileTextboxTitle', 'File Location'),
			actions: [this.fileButton]
		};
	}
}
