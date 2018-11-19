/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import { DataTierApplicationWizard } from '../dataTierApplicationWizard';
import { DacFxDataModel } from './models';
import * as os from 'os';
import * as path from 'path';

const localize = nls.loadMessageBundle();

export abstract class DacFxPage {

	protected readonly wizardPage: sqlops.window.modelviewdialog.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: sqlops.ModelView;
	protected serverDropdown: sqlops.DropDownComponent;
	protected databaseTextBox: sqlops.InputBoxComponent;
	protected databaseDropdown: sqlops.DropDownComponent;
	protected databaseLoader: sqlops.LoadingComponent;
	protected fileTextBox: sqlops.InputBoxComponent;
	protected fileButton: sqlops.ButtonComponent;
	protected fileExtension: string;

	protected constructor(instance: DataTierApplicationWizard, wizardPage: sqlops.window.modelviewdialog.WizardPage, model: DacFxDataModel, view: sqlops.ModelView) {
		this.instance = instance;
		this.wizardPage = wizardPage;
		this.model = model;
		this.view = view;
	}

	/**
	 * This method constructs all the elements of the page.
	 * @returns {Promise<boolean>}
	 */
	public async abstract start(): Promise<boolean>;

	/**
	 * This method is called when the user is leaving the page.
	 * @returns {Promise<boolean>}
	 */
	async onPageLeave(): Promise<boolean> {
		return true;
	}

	/**
	 * Override this method to cleanup what you don't need cached in the page.
	 * @returns {Promise<boolean>}
	 */
	public async cleanup(): Promise<boolean> {
		return true;
	}

	/**
	 * Sets up a navigation validator.
	 * This will be called right before onPageEnter().
	 */
	public setupNavigationValidator() {
		this.instance.registerNavigationValidator(() => {
			return true;
		});
	}

	protected async createServerDropdown(isTargetServer: boolean): Promise<sqlops.FormComponent> {
		this.serverDropdown = this.view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();

		// Handle server changes
		this.serverDropdown.onValueChanged(async () => {
			this.model.serverConnection = (this.serverDropdown.value as ConnectionDropdownValue).connection;
			this.model.serverName = (this.serverDropdown.value as ConnectionDropdownValue).displayName;
		});

		let targetServerTitle = localize('dacFx.targetServerDropdownTitle', 'Target Server');
		let sourceServerTitle = localize('dacFx.sourceServerDropdownTitle', 'Source Server');

		return {
			component: this.serverDropdown,
			title: isTargetServer ? targetServerTitle : sourceServerTitle
		};
	}

	protected async populateServerDropdown(): Promise<boolean> {
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

	protected async createDatabaseTextBox(): Promise<sqlops.FormComponent> {
		this.databaseTextBox = this.view.modelBuilder.inputBox().withProperties({
			required: true
		}).component();

		this.databaseTextBox.onTextChanged(async () => {
			this.model.databaseName = this.databaseTextBox.value;
		});

		return {
			component: this.databaseTextBox,
			title: localize('dacFx.databaseNameTextBox', 'Target Database')
		};
	}

	protected async createDatabaseDropdown(): Promise<sqlops.FormComponent> {
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
			title: localize('dacFx.sourceDatabaseDropdownTitle', 'Source Database')
		};
	}

	protected async populateDatabaseDropdown(): Promise<boolean> {
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

	protected async createFileBrowserParts() {
		this.fileTextBox = this.view.modelBuilder.inputBox().withProperties({
			required: true
		}).component();

		this.fileButton = this.view.modelBuilder.button().withProperties({
			label: localize('dacFx.browseFiles', '...'),
		}).component();
	}

	protected generateFilePath(): string {
		let now = new Date();
		let datetime = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + '-' + now.getHours() + '-' + now.getMinutes();
		return path.join(os.homedir(), this.model.databaseName + '-' + datetime + this.fileExtension);
	}
}

interface ConnectionDropdownValue extends sqlops.CategoryValue {
	connection: sqlops.connection.Connection;
}

