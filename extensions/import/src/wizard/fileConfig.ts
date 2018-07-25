/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import {ImportDataModel} from './dataModel';

let server: sqlops.connection.Connection;

let serverDropdown: sqlops.DropDownComponent;
let databaseDropdown: sqlops.DropDownComponent;
let fileTextBox: sqlops.InputBoxComponent;
let fileButton: sqlops.ButtonComponent;
let tableNameTextBox: sqlops.InputBoxComponent;
let schemaDropdown: sqlops.DropDownComponent;

let tableNames: string[] = [];

let model: ImportDataModel;

export async function fileConfig(view: sqlops.ModelView, dm: ImportDataModel): Promise<void> {
	model = dm;

	let serverComponent = await createServerDropdown(view);
	let databaseComponent = await createDatabaseDropdown(view);

	// Handle server changes
	serverDropdown.onValueChanged(async (params) => {
		console.log(params);

		server = (serverDropdown.value as ConnectionDropdownValue).connection;

		model.server = server;
		await populateDatabaseDropdown().then(() => populateSchemaDropdown());
	});

	// Handle database changes
	databaseDropdown.onValueChanged(async (db) => {

		model.database = (<sqlops.CategoryValue>databaseDropdown.value).name;
		await populateTableNames();
	});

	let fileBrowserComponent = await createFileBrowser(view);
	let tableNameComponent = await createTableNameBox(view);
	let schemaComponent = await createSchemaDropdown(view);

	let formModel = view.modelBuilder.formContainer()
		.withFormItems(
			[
				serverComponent,
				databaseComponent,
				fileBrowserComponent,
				tableNameComponent,
				schemaComponent
			]).component();
	let formWrapper = view.modelBuilder.loadingComponent().withItem(formModel).component();
	formWrapper.loading = false;
	await view.initializeModel(formWrapper);
}

async function populateTableNames(): Promise<boolean> {
	let databaseName = (<sqlops.CategoryValue>databaseDropdown.value).name;

	if (!databaseName || databaseName.length === 0) {
		this.tableNames = [];
		return false;
	}

	let connectionUri = await sqlops.connection.getUriForConnection(server.connectionId);
	let queryProvider = sqlops.dataprotocol.getProvider<sqlops.QueryProvider>(server.providerName, sqlops.DataProviderType.QueryProvider);
	let results: sqlops.SimpleExecuteResult;

	try {
		console.log(databaseName);

		let query = `USE ${databaseName}; SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`;
		results = await queryProvider.runQueryAndReturn(connectionUri, query);
	} catch (e) {
		console.log('we ded');
		return false;
	}

	tableNames = results.rows.map(row => {
		return row[0].displayValue;
	});

	console.log(tableNames);
	return true;
}

async function populateDatabaseDropdown(): Promise<boolean> {
	if (!server) {
		console.log('server was undefined');
		return false;
	}
	let first = true;
	databaseDropdown.updateProperties({
		values: (await sqlops.connection.listDatabases(server.connectionId)).map(db => {

			if (first) {
				first = false;
				model.database = db;
			}

			return {
				displayName: db,
				name: db
			};
		})
	});

	return true;
}

async function createSchemaDropdown(view: sqlops.ModelView): Promise<sqlops.FormComponent> {
	schemaDropdown = view.modelBuilder.dropDown().component();

	schemaDropdown.onValueChanged(() => {
		model.schema = (<sqlops.CategoryValue>schemaDropdown.value).name;
	});
	await populateSchemaDropdown();

	return {
		component: schemaDropdown,
		title: 'Table schema'
	};

}

async function populateSchemaDropdown(): Promise<Boolean> {
	let connectionUri = await sqlops.connection.getUriForConnection(server.connectionId);
	let queryProvider = sqlops.dataprotocol.getProvider<sqlops.QueryProvider>(server.providerName, sqlops.DataProviderType.QueryProvider);

	let query = `SELECT name FROM sys.schemas`;

	let results = await queryProvider.runQueryAndReturn(connectionUri, query);

	let first = true;
	let schemas = results.rows.map(row => {
		let schemaName = row[0].displayValue;
		if (first) {
			first = false;
			model.schema = schemaName;
		}

		return row[0].displayValue;
	});

	schemaDropdown.updateProperties({
		values: schemas
	});
	return true;
}

async function createTableNameBox(view: sqlops.ModelView): Promise<sqlops.FormComponent> {
	tableNameTextBox = view.modelBuilder.inputBox().withValidation((name) => {
		let tableName = name.value;

		if (!tableName || tableName.length === 0) {
			return false;
		}

		if (tableNames.indexOf(tableName) !== -1) {
			return false;
		}

		return true;
	}).component();

	tableNameTextBox.onTextChanged((tableName) => {
		model.table = tableName;
	});

	return {
		component: tableNameTextBox,
		title: 'New table name',
	};
}

async function createFileBrowser(view: sqlops.ModelView): Promise<sqlops.FormComponent> {
	fileTextBox = view.modelBuilder.inputBox().component();
	fileButton = view.modelBuilder.button().withProperties({
		label: 'Browse'
	}).component();

	fileButton.onDidClick(async (click) => {
		//TODO: Add filters for csv and txt
		let fileUris = await vscode.window.showOpenDialog(
			{
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				openLabel: 'Open',
				filters: {
					'Files': ['csv', 'txt']
				}
			}
		);

		if (!fileUris || fileUris.length === 0) {
			return;
		}

		let fileUri = fileUris[0];
		fileTextBox.value = fileUri.fsPath;

		// Get the name of the file.
		let nameStart = fileUri.fsPath.lastIndexOf('/');
		let nameEnd = fileUri.fsPath.lastIndexOf('.');

		// Handle files without extensions
		if (nameEnd === 0) {
			nameEnd = fileUri.fsPath.length;
		}

		tableNameTextBox.value = fileUri.fsPath.substring(nameStart + 1, nameEnd);
		tableNameTextBox.validate();

		// Let then model know about the file path
		model.filePath = fileUri.fsPath;
	});

	return {
		component: fileTextBox,
		title: 'Location of file to be imported',
		actions: [fileButton]
	};
}

async function createServerDropdown(view: sqlops.ModelView): Promise<sqlops.FormComponent> {
	let cons = await sqlops.connection.getActiveConnections();
	// This user has no active connections ABORT MISSION
	if (!cons || cons.length === 0) {
		return;
	}

	server = cons[0];
	model.server = server;

	serverDropdown = view.modelBuilder.dropDown().withProperties({
		values: cons.map(c => {
			return {
				connection: c,
				displayName: c.options.server,
				name: c.connectionId
			};
		})
	}).component();

	return {
		component: serverDropdown,
		title: 'Server the database is in',
	};
}

async function createDatabaseDropdown(view: sqlops.ModelView): Promise<sqlops.FormComponent> {
	databaseDropdown = view.modelBuilder.dropDown().component();
	await populateDatabaseDropdown();

	return {
		component: databaseDropdown,
		title: 'Database the table is created in',
	};
}


interface ConnectionDropdownValue extends sqlops.CategoryValue {
	connection: sqlops.connection.Connection;
}
