/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as path from 'path';
import { DacFxDataModel } from '../api/models';
import { DataTierApplicationWizard } from '../dataTierApplicationWizard';
import { DacFxPage } from '../api/dacFxPage';

const localize = nls.loadMessageBundle();

export class DeployConfigPage extends DacFxPage {

	protected readonly wizardPage: sqlops.window.modelviewdialog.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: sqlops.ModelView;

	private serverDropdown: sqlops.DropDownComponent;
	private databaseTextBox: sqlops.InputBoxComponent;
	private form: sqlops.FormContainer;
	private fileTextBox: sqlops.InputBoxComponent;
	private fileButton: sqlops.ButtonComponent;

	public constructor(instance: DataTierApplicationWizard, wizardPage: sqlops.window.modelviewdialog.WizardPage, model: DacFxDataModel, view: sqlops.ModelView) {
		super(instance, wizardPage, model, view);
	}

	async start(): Promise<boolean> {
		let databaseComponent = await this.createDatabaseTextBox();
		let serverComponent = await this.createServerDropdown();
		let fileBrowserComponent = await this.createFileBrowser();

		this.form = this.view.modelBuilder.formContainer()
			.withFormItems(
				[
					fileBrowserComponent,
					serverComponent,
					databaseComponent,
				], {
					horizontal: true
				}).component();
		await this.view.initializeModel(this.form);
		return true;
	}

	async onPageEnter(): Promise<boolean> {
		let r1 = await this.populateServerDropdown();
		return r1;
	}

	private async createServerDropdown(): Promise<sqlops.FormComponent> {
		this.serverDropdown = this.view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();

		// Handle server changes
		this.serverDropdown.onValueChanged(async () => {
			this.model.serverConnection = (this.serverDropdown.value as ConnectionDropdownValue).connection;
			this.model.serverName = (this.serverDropdown.value as ConnectionDropdownValue).displayName;
		});

		return {
			component: this.serverDropdown,
			title: localize('dacFxDeploy.serverDropdownTitle', 'Server')
		};
	}

	private async populateServerDropdown(): Promise<boolean> {
		let cons = await sqlops.connection.getActiveConnections();
		// This user has no active connections ABORT MISSION
		if (!cons || cons.length === 0) {
			return true;
		}

		let count = -1;
		let idx = -1;

		let values = cons.map(c => {
			// Handle the code to remember what the user's choice was from before
			count++;
			if (idx === -1) {
				if (this.model.serverConnection && c.connectionId === this.model.serverConnection.connectionId) {
					idx = count;
				} else if (this.model.serverId && c.connectionId === this.model.serverId) {
					idx = count;
				}
			}

			let db = c.options.databaseDisplayName;
			let usr = c.options.user;
			let srv = c.options.server;

			if (!db) {
				db = '<default>';
			}

			if (!usr) {
				usr = 'default';
			}

			let finalName = `${srv}, ${db} (${usr})`;
			return {
				connection: c,
				displayName: finalName,
				name: c.connectionId
			};
		});

		if (idx >= 0) {
			let tmp = values[0];
			values[0] = values[idx];
			values[idx] = tmp;
		} else {
			delete this.model.serverConnection;
			delete this.model.serverId;
			delete this.model.databaseName;
		}

		this.model.serverConnection = values[0].connection;
		this.model.serverName = values[0].displayName;
		this.serverDropdown.updateProperties({
			values: values
		});
		return true;
	}

	private async createDatabaseTextBox(): Promise<sqlops.FormComponent> {
		this.databaseTextBox = this.view.modelBuilder.inputBox().withProperties({
			required: true
		}).component();

		this.databaseTextBox.onTextChanged(async () => {
			this.model.databaseName = this.databaseTextBox.value;
		});

		return {
			component: this.databaseTextBox,
			title: localize('dacFxDeploy.databaseNameTextBox', 'New database name')
		};
	}

	private async createFileBrowser(): Promise<sqlops.FormComponent> {
		this.fileTextBox = this.view.modelBuilder.inputBox().withProperties({
			required: true
		}).component();

		this.fileButton = this.view.modelBuilder.button().withProperties({
			label: localize('dacFxDeploy.browseFiles', '...'),
		}).component();

		this.fileButton.onDidClick(async (click) => {
			let fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					openLabel: localize('dacFxDeploy.openFile', 'Open'),
					filters: {
						'bacpac Files': ['dacpac'],
						'All Files': ['*']
					}
				}
			);

			if (!fileUris || fileUris.length === 0) {
				return;
			}

			let fileUri = fileUris[0];
			this.fileTextBox.value = fileUri.fsPath;
			this.model.filePath = fileUri.fsPath;
			this.model.databaseName = this.generateDatabaseName(this.model.filePath);
			this.databaseTextBox.value = this.model.databaseName;
		});

		this.fileTextBox.onTextChanged(async () => {
			this.model.filePath = this.fileTextBox.value;
			this.model.databaseName = this.generateDatabaseName(this.model.filePath);
			this.databaseTextBox.value = this.model.databaseName;
		});

		return {
			component: this.fileTextBox,
			title: localize('dacFxDeploy.fileTextboxTitle', 'Dacpac to deploy'),
			actions: [this.fileButton]
		};
	}

	private generateDatabaseName(filePath: string): string {
		let result = path.parse(filePath);
		return result.name;
	}
}

interface ConnectionDropdownValue extends sqlops.CategoryValue {
	connection: sqlops.connection.Connection;
}
