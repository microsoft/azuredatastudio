/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as sqlops from 'sqlops';

export async function fileConfig(view: sqlops.ModelView): Promise<void> {
	//from services sample placeholder code
	let server: sqlops.connection.Connection = null;

	let serverDropdown = await createServerDropdown(view);
	let databaseDropdown = await createDatabaseDropdown(view, server);

	serverDropdown.onValueChanged((params) => {
		console.log('Params:' + params);

		server = (serverDropdown.value as ConnectionDropdownValue).connection;
		populateDatabaseDropdown(server, databaseDropdown);
	});


	let formModel = view.modelBuilder.formContainer()
		.withFormItems(
			[
				{
					component: serverDropdown,
					title: 'Server'
				},
				{
					component: databaseDropdown,
					title: 'Database'
				}
			]).component();
	let formWrapper = view.modelBuilder.loadingComponent().withItem(formModel).component();
	formWrapper.loading = false;
	await view.initializeModel(formWrapper);
}

async function createServerDropdown(view: sqlops.ModelView): Promise<sqlops.DropDownComponent> {
	let cons = await sqlops.connection.getActiveConnections();
	// This user has no active connections ABORT MISSION
	if (!cons || cons.length === 0) {
		return;
	}
	let serverDropdown = view.modelBuilder.dropDown().withProperties({
		values: cons.map(c => {
			return {
				connection: c,
				displayName: c.options.server,
				name: c.connectionId
			};
		})
	}).component();
	return Promise.resolve(serverDropdown);
}
async function createDatabaseDropdown(view: sqlops.ModelView, server: sqlops.connection.Connection): Promise<sqlops.DropDownComponent>{
	let dbDropdown=view.modelBuilder.dropDown().component();
	populateDatabaseDropdown(server, dbDropdown);

	return Promise.resolve(dbDropdown);
}

async function populateDatabaseDropdown(server: sqlops.connection.Connection, dbDropdown: sqlops.DropDownComponent){
	if(server === null){
		return;
	}

	let connectionProvider = sqlops.dataprotocol.getProvider<sqlops.ConnectionProvider>(server.providerName, sqlops.DataProviderType.ConnectionProvider);
	let databases = await connectionProvider.listDatabases(server.connectionId);

	dbDropdown.updateProperties({
		values: databases.databaseNames.map(db=>{
			return {
				displayName: db,
				name: db
			};
		})
	})
}

interface ConnectionDropdownValue extends sqlops.CategoryValue {
	connection: sqlops.connection.Connection;
}
