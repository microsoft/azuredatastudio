/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { DacFxDataModel } from '../api/models';
import { DacFxWizard } from '../dacFxWizard';
import { DacFxPage } from '../api/dacFxPage';

const localize = nls.loadMessageBundle();

export class ExtractConfigPage extends DacFxPage {

	protected readonly wizardPage: sqlops.window.modelviewdialog.WizardPage;
	protected readonly instance: DacFxWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: sqlops.ModelView;

	private serverDropdown: sqlops.DropDownComponent;
	private databaseDropdown: sqlops.DropDownComponent;
	private form: sqlops.FormContainer;
	private fileTextBox: sqlops.InputBoxComponent;
	private fileButton: sqlops.ButtonComponent;
	private versionTextBox: sqlops.InputBoxComponent;

	private databaseLoader: sqlops.LoadingComponent;

	public constructor(instance: DacFxWizard, wizardPage: sqlops.window.modelviewdialog.WizardPage, model: DacFxDataModel, view: sqlops.ModelView) {
		super(instance, wizardPage, model, view);
	}

	async start(): Promise<boolean> {
		let databaseComponent = await this.createDatabaseDropdown();
		let serverComponent = await this.createServerDropdown();
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
					horizontal: true
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
		return true;
	}

	public async cleanup(): Promise<boolean> {
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

	private async createServerDropdown(): Promise<sqlops.FormComponent> {
		this.serverDropdown = this.view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();

		// Handle server changes
		this.serverDropdown.onValueChanged(async () => {
			this.model.serverConnection = (this.serverDropdown.value as ConnectionDropdownValue).connection;
			this.model.serverName = (this.serverDropdown.value as ConnectionDropdownValue).displayName;
			await this.populateDatabaseDropdown();
		});

		return {
			component: this.serverDropdown,
			title: localize('dacFxExtract.serverDropdownTitle', 'Server the database is in')
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

	private async createDatabaseDropdown(): Promise<sqlops.FormComponent> {
		this.databaseDropdown = this.view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();

		// Handle database changes
		this.databaseDropdown.onValueChanged(async () => {
			this.model.databaseName = (<sqlops.CategoryValue>this.databaseDropdown.value).name;
			this.fileTextBox.value = this.generateFilePath();
			this.model.filePath = this.fileTextBox.value;
		});

		this.databaseLoader = this.view.modelBuilder.loadingComponent().withItem(this.databaseDropdown).component();

		return {
			component: this.databaseLoader,
			title: localize('dacFxExtract.databaseDropdownTitle', 'Database to extract')
		};
	}

	private async populateDatabaseDropdown(): Promise<boolean> {
		this.databaseLoader.loading = true;
		this.databaseDropdown.updateProperties({ values: [] });

		if (!this.model.serverConnection) {
			this.databaseLoader.loading = false;
			return false;
		}

		let idx = -1;
		let count = -1;
		let values = (await sqlops.connection.listDatabases(this.model.serverConnection.connectionId)).map(db => {
			count++;
			if (this.model.databaseName && db === this.model.databaseName) {
				idx = count;
			}

			return {
				displayName: db,
				name: db
			};
		});

		if (idx >= 0) {
			let tmp = values[0];
			values[0] = values[idx];
			values[idx] = tmp;
		} else {
			delete this.model.databaseName;
		}

		this.model.databaseName = values[0].name;
		this.model.filePath = this.generateFilePath();
		this.fileTextBox.value = this.model.filePath;

		this.databaseDropdown.updateProperties({
			values: values
		});
		this.databaseLoader.loading = false;

		return true;
	}

	private async createFileBrowser(): Promise<sqlops.FormComponent> {
		this.fileTextBox = this.view.modelBuilder.inputBox().withProperties({
			required: true
		}).component();

		// default filepath
		this.fileTextBox.value = this.generateFilePath();
		this.model.filePath = this.fileTextBox.value;
		this.fileButton = this.view.modelBuilder.button().withProperties({
			label: localize('dacFxExtract.browseFiles', '...'),
		}).component();

		this.fileButton.onDidClick(async (click) => {
			let fileUri = await vscode.window.showSaveDialog(
				{
					defaultUri: vscode.Uri.file(this.fileTextBox.value),
					saveLabel: localize('dacfxExtract.saveFile', 'Save'),
					filters: {
						'bacpac Files': ['dacpac'],
						'All Files': ['*']
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
			title: localize('dacFxExtract.fileTextboxTitle', 'Location to save dacpac'),
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

	private generateFilePath(): string {
		let now = new Date();
		let datetime = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + '-' + now.getHours() + '-' + now.getMinutes();
		return path.join(os.homedir(), this.model.databaseName + '-' + datetime + '.dacpac');
	}
}

interface ConnectionDropdownValue extends sqlops.CategoryValue {
	connection: sqlops.connection.Connection;
}
