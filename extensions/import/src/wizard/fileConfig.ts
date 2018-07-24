/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';

let server: sqlops.connection.Connection = null;

let serverDropdown: sqlops.DropDownComponent;
let databaseDropdown: sqlops.DropDownComponent;
let fileTextBox : sqlops.InputBoxComponent;
let fileButton : sqlops.ButtonComponent;

export async function fileConfig(view: sqlops.ModelView): Promise<void> {
	let serverComponent = await createServerDropdown(view);
	let databaseComponent = await createDatabaseDropdown(view, server);

	serverDropdown.onValueChanged((params) => {
		console.log('Params:' + params);

		server = (serverDropdown.value as ConnectionDropdownValue).connection;
		populateDatabaseDropdown(server, databaseDropdown);
	});

	let fileBrowserModel = await createFileBrowser(view);

	let formModel = view.modelBuilder.formContainer()
		.withFormItems(
			[
				serverComponent,
				databaseComponent,
				fileBrowserModel
			]).component();
	let formWrapper = view.modelBuilder.loadingComponent().withItem(formModel).component();
	formWrapper.loading = false;
	await view.initializeModel(formWrapper);
}

async function createFileBrowser(view: sqlops.ModelView): Promise<sqlops.FormComponent> {
 	fileTextBox = view.modelBuilder.inputBox().component();
 	fileButton = view.modelBuilder.button().withProperties({
		label: 'Browse'
	}).component();

	fileButton.onDidClick(async (click) => {
		let fileUris = await vscode.window.showOpenDialog(
			{
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				openLabel: 'Open'
			}
		);
		if (!fileUris || fileUris.length === 0) {
			return;
		}

		let fileUri = fileUris[0];
		fileTextBox.value = fileUri.fsPath;
	});

	return Promise.resolve({
		component: fileTextBox,
		title: 'Location of file to be imported',
		actions: [fileButton]
	});
}

async function createServerDropdown(view: sqlops.ModelView): Promise<sqlops.FormComponent> {
	let cons = await sqlops.connection.getActiveConnections();
	// This user has no active connections ABORT MISSION
	if (!cons || cons.length === 0) {
		return;
	}
	serverDropdown = view.modelBuilder.dropDown().withProperties({
		values: cons.map(c => {
			return {
				connection: c,
				displayName: c.options.server,
				name: c.connectionId
			};
		})
	}).component();

	return Promise.resolve({
		component: serverDropdown,
		title:'Server the database is in',
	});
}

async function createDatabaseDropdown(view: sqlops.ModelView, server: sqlops.connection.Connection): Promise<sqlops.FormComponent> {
	let databaseDropdown = view.modelBuilder.dropDown().component();
	await populateDatabaseDropdown(server, databaseDropdown);

	return Promise.resolve({
		component: databaseDropdown,
		title:'Database the table is created in',
	});
}

async function populateDatabaseDropdown(server: sqlops.connection.Connection, dbDropdown: sqlops.DropDownComponent): Promise<boolean> {
	if (server === null) {
		return;
	}

	let connectionProvider = sqlops.dataprotocol.getProvider<sqlops.ConnectionProvider>(server.providerName, sqlops.DataProviderType.ConnectionProvider);
	let databases = await connectionProvider.listDatabases(server.connectionId);

	dbDropdown.updateProperties({
		values: databases.databaseNames.map(db => {
			return {
				displayName: db,
				name: db
			};
		})
	});

	Promise.resolve(true);
}

interface ConnectionDropdownValue extends sqlops.CategoryValue {
	connection: sqlops.connection.Connection;
}
