/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../../localizedConstants';
import { DacFxDataModel } from '../api/models';
import { DataTierApplicationWizard } from '../dataTierApplicationWizard';
import { DacFxConfigPage } from '../api/dacFxConfigPage';
import { generateDatabaseName } from '../api/utils';

export class ImportConfigPage extends DacFxConfigPage {
	private form: azdata.FormContainer;
	public selectionPromise: Promise<void>;

	public constructor(instance: DataTierApplicationWizard, wizardPage: azdata.window.WizardPage, model: DacFxDataModel, view: azdata.ModelView) {
		super(instance, wizardPage, model, view);
		this.fileExtension = '.bacpac';
	}

	async start(): Promise<boolean> {
		let databaseComponent = await this.createDatabaseTextBox(loc.targetDatabase);
		let serverComponent = await this.createServerDropdown(true);
		let fileBrowserComponent = await this.createFileBrowser();

		this.form = this.view.modelBuilder.formContainer()
			.withFormItems(
				[
					fileBrowserComponent,
					serverComponent,
					databaseComponent,
				], {
				horizontal: true,
				componentWidth: 400
			}).component();
		await this.view.initializeModel(this.form);
		return true;
	}

	async onPageEnter(): Promise<boolean> {
		let r1 = await this.populateServerDropdown();
		// get existing database values to verify if new database name is valid
		await this.getDatabaseValues();
		return r1;
	}

	private async createFileBrowser(): Promise<azdata.FormComponent> {
		this.createFileBrowserParts();

		this.fileButton.onDidClick(async (click) => { this.selectionPromise = this.handleFileSelection(); });

		this.fileTextBox.onTextChanged(async () => {
			this.model.filePath = this.fileTextBox.value;
			this.model.database = generateDatabaseName(this.model.filePath);
			this.databaseTextBox.value = this.model.database;
		});

		return {
			component: this.fileTextBox,
			title: loc.fileLocation,
			actions: [this.fileButton]
		};
	}

	private async handleFileSelection(): Promise<void> {
		let fileUris = await vscode.window.showOpenDialog(
			{
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				defaultUri: vscode.Uri.file(this.getRootPath()),
				openLabel: loc.open,
				filters: {
					'bacpac Files': ['bacpac'],
				}
			}
		);

		if (!fileUris || fileUris.length === 0) {
			return;
		}

		let fileUri = fileUris[0];
		this.fileTextBox.value = fileUri.fsPath;
		this.model.filePath = fileUri.fsPath;
		this.model.database = generateDatabaseName(this.model.filePath);
		this.databaseTextBox.value = this.model.database;
	}
}
