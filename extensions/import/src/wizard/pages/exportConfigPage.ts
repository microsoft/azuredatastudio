/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as os from 'os';
import { ImportDataModel } from '../api/models';
import { DacFxExportWizard } from '../dacFxExportWizard';

const localize = nls.loadMessageBundle();

export class ExportConfigPage {

	protected readonly wizardPage: sqlops.window.modelviewdialog.WizardPage;
	protected readonly instance: DacFxExportWizard;
	protected readonly model: ImportDataModel;
	protected readonly view: sqlops.ModelView;

	private serverDropdown: sqlops.DropDownComponent;
	private databaseDropdown: sqlops.DropDownComponent;
	private form: sqlops.FormContainer;
	private fileTextBox: sqlops.InputBoxComponent;
	private fileButton: sqlops.ButtonComponent;

	private databaseLoader: sqlops.LoadingComponent;

	public constructor(instance: DacFxExportWizard, wizardPage: sqlops.window.modelviewdialog.WizardPage, model: ImportDataModel, view: sqlops.ModelView) {
		this.instance = instance;
		this.wizardPage = wizardPage;
		this.model = model;
		this.view = view;
	}

	async start(): Promise<boolean> {
		let databaseComponent = await this.createDatabaseDropdown();
		let serverComponent = await this.createServerDropdown();
		let fileBrowserComponent = await this.createFileBrowser();

		this.form = this.view.modelBuilder.formContainer()
			.withFormItems(
				[
					serverComponent,
					databaseComponent,
					fileBrowserComponent,
				]).component();

		await this.view.initializeModel(this.form);
		return true;
	}

	async onPageEnter(): Promise<boolean> {
		let r1 = await this.populateServerDropdown();
		let r2 = await this.populateDatabaseDropdown();
		return r1 && r2;
	}

	async onPageLeave(): Promise<boolean> {
		delete this.model.serverId;
		return true;
	}

	public async cleanup(): Promise<boolean> {
		delete this.model.filePath;
		delete this.model.table;

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
			this.model.server = (this.serverDropdown.value as ConnectionDropdownValue).connection;

			await this.populateDatabaseDropdown();
		});

		return {
			component: this.serverDropdown,
			title: localize('dacFxExport.serverDropdownTitle', 'Server the database is in')
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
				if (this.model.server && c.connectionId === this.model.server.connectionId) {
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
			delete this.model.server;
			delete this.model.serverId;
			delete this.model.database;
			delete this.model.schema;
		}

		this.model.server = values[0].connection;

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
			this.model.database = (<sqlops.CategoryValue>this.databaseDropdown.value).name;
		});

		this.databaseLoader = this.view.modelBuilder.loadingComponent().withItem(this.databaseDropdown).component();

		return {
			component: this.databaseLoader,
			title: localize('dacFxExport.databaseDropdownTitle', 'Database to export')
		};
	}

	private async populateDatabaseDropdown(): Promise<boolean> {
		this.databaseLoader.loading = true;
		this.databaseDropdown.updateProperties({ values: [] });

		if (!this.model.server) {
			this.databaseLoader.loading = false;
			return false;
		}

		let idx = -1;
		let count = -1;
		let values = (await sqlops.connection.listDatabases(this.model.server.connectionId)).map(db => {
			count++;
			if (this.model.database && db === this.model.database) {
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
			delete this.model.database;
			delete this.model.schema;
		}

		this.model.database = values[0].name;

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
		let now = new Date();
		let datetime = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + '-' + now.getHours() + '-' + now.getMinutes();
		this.fileTextBox.value = os.tmpdir + '\\' + this.model.database + '-' + datetime + '.bacpac';

		this.fileButton = this.view.modelBuilder.button().withProperties({
			label: localize('dacFxExport.browseFiles', 'Browse'),
		}).component();

		this.fileButton.onDidClick(async (click) => {
			let fileUri = await vscode.window.showSaveDialog(
				{
					defaultUri: vscode.Uri.file(this.fileTextBox.value),
					filters: {
						'bacpac Files': ['bacpac'],
						'All Files': ['*']
					}
				}
			);

			if (!fileUri) {
				return;
			}

			this.fileTextBox.value = fileUri.fsPath;
		});

		return {
			component: this.fileTextBox,
			title: localize('dacFxExport.fileTextboxTitle', 'Location to save bacpac'),
			actions: [this.fileButton]
		};
	}

	public async getConnectionString(): Promise<string> {
		let connectionstring = await sqlops.connection.getConnectionString(this.model.server.connectionId, true);
		let splitted = connectionstring.split(';');

		// set datbase to appropriate value instead of master
		let temp = splitted.find(s => s.startsWith('Initial Catalog'));
		splitted[splitted.indexOf(temp)] = 'Initial Catalog=' + this.model.database;

		return splitted.join(';');
	}

	public getFilePath(): string {
		return this.fileTextBox.value;
	}
}

interface ConnectionDropdownValue extends sqlops.CategoryValue {
	connection: sqlops.connection.Connection;
}
