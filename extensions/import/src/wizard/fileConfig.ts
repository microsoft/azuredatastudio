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
	let server: sqlops.connection.Connection;

	let serverDropdown = await createServerDropdown(view);

	serverDropdown.onValueChanged((params) => {
		server = (serverDropdown.value as ConnectionDropdownValue).connection;
		vscode.window.showInformationMessage(server.connectionId);
	});

	let databaseDropdown = view.modelBuilder.dropDown().withProperties({});
	let formModel = view.modelBuilder.formContainer()
		.withFormItems(
			[
				{
					component: serverDropdown,
					title: 'Server'
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
		value: {
			connection: cons[0],
			displayName: cons[0].connectionId,
			name: cons[0].options.serverName
		},
		values: cons.map(c => {
			return {
				connection: c,
				displayName: c.connectionId,
				name: c.connectionId
			};
		})
	}).component();
	return Promise.resolve(serverDropdown);
}

interface ConnectionDropdownValue extends sqlops.CategoryValue {

	connection: sqlops.connection.Connection;
}
