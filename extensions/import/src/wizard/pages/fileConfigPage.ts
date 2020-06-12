/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ImportPage } from '../api/importPage';
import * as constants from '../../common/constants';

export class FileConfigPage extends ImportPage {

	private serverDropdown: azdata.DropDownComponent;
	private databaseDropdown: azdata.DropDownComponent;
	private fileTextBox: azdata.InputBoxComponent;
	private fileButton: azdata.ButtonComponent;
	private tableNameTextBox: azdata.InputBoxComponent;
	private schemaDropdown: azdata.DropDownComponent;
	private form: azdata.FormContainer;

	private databaseLoader: azdata.LoadingComponent;
	private schemaLoader: azdata.LoadingComponent;

	private tableNames: string[] = [];

	async start(): Promise<boolean> {
		let schemaComponent = await this.createSchemaDropdown();
		let tableNameComponent = await this.createTableNameBox();
		let fileBrowserComponent = await this.createFileBrowser();
		let databaseComponent = await this.createDatabaseDropdown();
		let serverComponent = await this.createServerDropdown();

		this.form = this.view.modelBuilder.formContainer()
			.withFormItems(
				[
					serverComponent,
					databaseComponent,
					fileBrowserComponent,
					tableNameComponent,
					schemaComponent
				]).component();

		await this.view.initializeModel(this.form);
		return true;
	}

	async onPageEnter(): Promise<boolean> {
		let r1 = await this.populateServerDropdown();
		let r2 = await this.populateDatabaseDropdown();
		let r3 = await this.populateSchemaDropdown();
		return r1 && r2 && r3;
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
		this.instance.registerNavigationValidator((info) => {
			if (this.schemaLoader.loading || this.databaseLoader.loading) {
				return false;
			}
			return true;
		});
	}

	private async createServerDropdown(): Promise<azdata.FormComponent> {
		this.serverDropdown = this.view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();

		// Handle server changes
		this.serverDropdown.onValueChanged(async (params) => {
			this.model.server = (this.serverDropdown.value as ConnectionDropdownValue).connection;

			await this.populateDatabaseDropdown();
			await this.populateSchemaDropdown();
		});

		return {
			component: this.serverDropdown,
			title: constants.serverDropDownTitleText
		};
	}

	private async populateServerDropdown(): Promise<boolean> {
		let values = await this.getServerValues();
		if (values === undefined) {
			return false;
		}

		this.model.server = values[0].connection;


		this.serverDropdown.updateProperties({
			values: values
		});
		return true;
	}

	private async createDatabaseDropdown(): Promise<azdata.FormComponent> {
		this.databaseDropdown = this.view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();

		// Handle database changes
		this.databaseDropdown.onValueChanged(async (db) => {
			this.model.database = (<azdata.CategoryValue>this.databaseDropdown.value).name;
			//this.populateTableNames();
			let connectionProvider = this._apiWrapper.getProvider<azdata.ConnectionProvider>(this.model.server.providerName, azdata.DataProviderType.ConnectionProvider);
			let connectionUri = await this._apiWrapper.getUriForConnection(this.model.server.connectionId);
			connectionProvider.changeDatabase(connectionUri, this.model.database);
			this.populateSchemaDropdown();
		});

		this.databaseLoader = this.view.modelBuilder.loadingComponent().withItem(this.databaseDropdown).component();

		return {
			component: this.databaseLoader,
			title: constants.databaseDropdownTitleText
		};
	}

	private async populateDatabaseDropdown(): Promise<boolean> {
		this.databaseLoader.loading = true;
		this.databaseDropdown.updateProperties({ values: [] });
		this.schemaDropdown.updateProperties({ values: [] });

		if (!this.model.server) {
			//TODO handle error case
			this.databaseLoader.loading = false;
			return false;
		}

		let defaultServerDatabase = this.model.server.options.database;

		let values: any[];
		try {
			values = await this.getDatabaseValues();
		} catch (error) {
			// This code is used in case of contained databases when the query will return an error.
			console.log(error);
			values = [{ displayName: defaultServerDatabase, name: defaultServerDatabase }];
			this.databaseDropdown.editable = false;
		}

		this.model.database = defaultServerDatabase;

		this.databaseDropdown.updateProperties({
			values: values
		});

		this.databaseDropdown.value = { displayName: this.model.database, name: this.model.database };
		this.databaseLoader.loading = false;

		return true;
	}

	private async createFileBrowser(): Promise<azdata.FormComponent> {
		this.fileTextBox = this.view.modelBuilder.inputBox().withProperties({
			required: true
		}).component();
		this.fileButton = this.view.modelBuilder.button().withProperties({
			label: constants.browseFilesText,
		}).component();

		this.fileButton.onDidClick(async (click) => {
			let fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					openLabel: constants.openFileText,
					filters: {
						'CSV/TXT Files': ['csv', 'txt'],
						'All Files': ['*']
					}
				}
			);

			if (!fileUris || fileUris.length === 0) {
				return;
			}

			let fileUri = fileUris[0];
			this.fileTextBox.value = fileUri.fsPath;

			// Get the name of the file.
			let nameStart = fileUri.path.lastIndexOf('/');
			let nameEnd = fileUri.path.lastIndexOf('.');

			// Handle files without extensions
			if (nameEnd === 0) {
				nameEnd = fileUri.path.length;
			}
			this.model.fileType = 'TXT';
			let extension = fileUri.path.substring(nameEnd + 1, fileUri.path.length);

			if (extension.toLowerCase() === 'json') {
				this.model.fileType = 'JSON';
			}

			this.tableNameTextBox.value = fileUri.path.substring(nameStart + 1, nameEnd);
			this.model.table = this.tableNameTextBox.value;
			this.tableNameTextBox.validate();

			// Let then model know about the file path
			this.model.filePath = fileUri.fsPath;
		});

		return {
			component: this.fileTextBox,
			title: constants.fileTextboxTitleText,
			actions: [this.fileButton]
		};
	}

	private async createTableNameBox(): Promise<azdata.FormComponent> {
		this.tableNameTextBox = this.view.modelBuilder.inputBox().withValidation((name) => {
			let tableName = name.value;

			if (!tableName || tableName.length === 0) {
				return false;
			}

			// This won't actually do anything until table names are brought back in.
			if (this.tableNames.indexOf(tableName) !== -1) {
				return false;
			}

			return true;
		}).withProperties({
			required: true,
		}).component();

		this.tableNameTextBox.onTextChanged((tableName) => {
			this.model.table = tableName;
		});

		return {
			component: this.tableNameTextBox,
			title: constants.tableTextboxTitleText,
		};
	}


	private async createSchemaDropdown(): Promise<azdata.FormComponent> {
		this.schemaDropdown = this.view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();
		this.schemaLoader = this.view.modelBuilder.loadingComponent().withItem(this.schemaDropdown).component();

		this.schemaDropdown.onValueChanged(() => {
			this.model.schema = (<azdata.CategoryValue>this.schemaDropdown.value).name;
		});


		return {
			component: this.schemaLoader,
			title: constants.schemaTextboxTitleText,
		};

	}

	public async populateSchemaDropdown(): Promise<boolean> {
		this.schemaLoader.loading = true;

		let values = await this.getSchemaValues();

		this.model.schema = values[0].name;

		this.schemaDropdown.updateProperties({
			values: values
		});

		this.schemaLoader.loading = false;
		return true;
	}

	public async getSchemaValues(): Promise<{ displayName: string, name: string }[]> {
		let connectionUri = await this._apiWrapper.getUriForConnection(this.model.server.connectionId);
		let queryProvider = this._apiWrapper.getProvider<azdata.QueryProvider>(this.model.server.providerName, azdata.DataProviderType.QueryProvider);

		let results = await queryProvider.runQueryAndReturn(connectionUri, constants.selectSchemaQuery);

		let idx = -1;
		let count = -1;

		let values = results.rows.map(row => {
			let schemaName = row[0].displayValue;
			count++;
			if (this.model.schema && schemaName === this.model.schema) {
				idx = count;
			}
			let val = row[0].displayValue;

			return {
				name: val,
				displayName: val
			};
		});

		if (idx >= 0) {
			let tmp = values[0];
			values[0] = values[idx];
			values[idx] = tmp;
		}
		return values;
	}

	protected deleteServerValues() {
		delete this.model.server;
		delete this.model.serverId;
		delete this.model.database;
		delete this.model.schema;
	}

	protected deleteDatabaseValues() {
		delete this.model.database;
		delete this.model.schema;
	}

	// private async populateTableNames(): Promise<boolean> {
	// 	this.tableNames = [];
	// 	let databaseName = (<azdata.CategoryValue>this.databaseDropdown.value).name;
	//
	// 	if (!databaseName || databaseName.length === 0) {
	// 		this.tableNames = [];
	// 		return false;
	// 	}
	//
	// 	let connectionUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);
	// 	let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(this.model.server.providerName, azdata.DataProviderType.QueryProvider);
	// 	let results: azdata.SimpleExecuteResult;
	//
	// 	try {
	// 		//let query = sqlstring.format('USE ?; SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\'', [databaseName]);
	// 		//results = await queryProvider.runQueryAndReturn(connectionUri, query);
	// 	} catch (e) {
	// 		return false;
	// 	}
	//
	// 	this.tableNames = results.rows.map(row => {
	// 		return row[0].displayValue;
	// 	});
	//
	// 	return true;
	// }
}


interface ConnectionDropdownValue extends azdata.CategoryValue {
	connection: azdata.connection.Connection;
}
