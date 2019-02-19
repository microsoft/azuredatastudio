/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { ImportDataModel } from '../api/models';
import { ImportPage } from '../api/importPage';
import { FlatFileProvider } from '../../services/contracts';
import { FlatFileWizard } from '../flatFileWizard';

const localize = nls.loadMessageBundle();

export class FileConfigPage extends ImportPage {

	private serverDropdown: sqlops.DropDownComponent;
	private databaseDropdown: sqlops.DropDownComponent;
	private fileTextBox: sqlops.InputBoxComponent;
	private fileButton: sqlops.ButtonComponent;
	private tableNameTextBox: sqlops.InputBoxComponent;
	private schemaDropdown: sqlops.DropDownComponent;
	private form: sqlops.FormContainer;

	private databaseLoader: sqlops.LoadingComponent;
	private schemaLoader: sqlops.LoadingComponent;

	private tableNames: string[] = [];

	public constructor(instance: FlatFileWizard, wizardPage: sqlops.window.WizardPage, model: ImportDataModel, view: sqlops.ModelView, provider: FlatFileProvider) {
		super(instance, wizardPage, model, view, provider);
	}

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

	private async createServerDropdown(): Promise<sqlops.FormComponent> {
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
			title: localize('flatFileImport.serverDropdownTitle', 'Server the database is in')
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

	private async createDatabaseDropdown(): Promise<sqlops.FormComponent> {
		this.databaseDropdown = this.view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();

		// Handle database changes
		this.databaseDropdown.onValueChanged(async (db) => {
			this.model.database = (<sqlops.CategoryValue>this.databaseDropdown.value).name;
			//this.populateTableNames();
			this.populateSchemaDropdown();
		});

		this.databaseLoader = this.view.modelBuilder.loadingComponent().withItem(this.databaseDropdown).component();

		return {
			component: this.databaseLoader,
			title: localize('flatFileImport.databaseDropdownTitle', 'Database the table is created in')
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

		let values = await this.getDatabaseValues();

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
		this.fileButton = this.view.modelBuilder.button().withProperties({
			label: localize('flatFileImport.browseFiles', 'Browse'),
		}).component();

		this.fileButton.onDidClick(async (click) => {
			let fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					openLabel: localize('flatFileImport.openFile', 'Open'),
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
			title: localize('flatFileImport.fileTextboxTitle', 'Location of the file to be imported'),
			actions: [this.fileButton]
		};
	}

	private async createTableNameBox(): Promise<sqlops.FormComponent> {
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
			title: localize('flatFileImport.tableTextboxTitle', 'New table name'),
		};
	}


	private async createSchemaDropdown(): Promise<sqlops.FormComponent> {
		this.schemaDropdown = this.view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();
		this.schemaLoader = this.view.modelBuilder.loadingComponent().withItem(this.schemaDropdown).component();

		this.schemaDropdown.onValueChanged(() => {
			this.model.schema = (<sqlops.CategoryValue>this.schemaDropdown.value).name;
		});


		return {
			component: this.schemaLoader,
			title: localize('flatFileImport.schemaTextboxTitle', 'Table schema'),
		};

	}

	private async populateSchemaDropdown(): Promise<boolean> {
		this.schemaLoader.loading = true;
		let connectionUri = await sqlops.connection.getUriForConnection(this.model.server.connectionId);
		let queryProvider = sqlops.dataprotocol.getProvider<sqlops.QueryProvider>(this.model.server.providerName, sqlops.DataProviderType.QueryProvider);

		let query = `SELECT name FROM sys.schemas`;

		let results = await queryProvider.runQueryAndReturn(connectionUri, query);

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

		this.model.schema = values[0].name;

		this.schemaDropdown.updateProperties({
			values: values
		});

		this.schemaLoader.loading = false;
		return true;
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
	// 	let databaseName = (<sqlops.CategoryValue>this.databaseDropdown.value).name;
	//
	// 	if (!databaseName || databaseName.length === 0) {
	// 		this.tableNames = [];
	// 		return false;
	// 	}
	//
	// 	let connectionUri = await sqlops.connection.getUriForConnection(this.model.server.connectionId);
	// 	let queryProvider = sqlops.dataprotocol.getProvider<sqlops.QueryProvider>(this.model.server.providerName, sqlops.DataProviderType.QueryProvider);
	// 	let results: sqlops.SimpleExecuteResult;
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


interface ConnectionDropdownValue extends sqlops.CategoryValue {
	connection: sqlops.connection.Connection;
}
