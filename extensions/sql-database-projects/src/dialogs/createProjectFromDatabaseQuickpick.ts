/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../common/constants';
import { exists, getVscodeMssqlApi } from '../common/utils';
import { IConnectionInfo } from 'vscode-mssql';
import { defaultProjectNameFromDb, defaultProjectSaveLocation } from '../tools/newProjectTool';
import { ImportDataModel } from '../models/api/import';
import { mapExtractTargetEnum } from './createProjectFromDatabaseDialog';

/**
 * Create flow for a New Project using only VS Code-native APIs such as QuickPick
 * @param connectionInfo Optional connection info to use instead of prompting the user for a connection
 */
export async function createNewProjectFromDatabaseWithQuickpick(connectionInfo?: IConnectionInfo): Promise<ImportDataModel | undefined> {

	const vscodeMssqlApi = await getVscodeMssqlApi();

	// 1. Select connection
	// Use passed in profile if we have one - otherwise prompt user to select one
	let connectionProfile: IConnectionInfo | undefined = connectionInfo ?? await vscodeMssqlApi.promptForConnection(true);
	if (!connectionProfile) {
		// User cancelled
		return undefined;
	}
	let connectionUri: string = '';
	let dbs: string[] | undefined = undefined;
	while (!dbs) {
		// Get the list of databases now to validate that the connection is valid and re-prompt them if it isn't
		try {
			connectionUri = await vscodeMssqlApi.connect(connectionProfile);
			dbs = (await vscodeMssqlApi.listDatabases(connectionUri))
				.filter(db => !constants.systemDbs.includes(db)); // Filter out system dbs
		} catch (err) {
			// The mssql extension handles showing the error to the user. Prompt the user
			// for a new connection and then go and try getting the DBs again
			connectionProfile = await vscodeMssqlApi.promptForConnection(true);
			if (!connectionProfile) {
				// User cancelled
				return undefined;
			}

		}
	}

	// Move the database for the given connection up to the top
	if (connectionProfile.database && connectionProfile.database !== 'master') {
		const index = dbs.indexOf(connectionProfile.database);
		if (index >= 0) {
			dbs.splice(index, 1);
		}
		dbs.unshift(connectionProfile.database);
	}

	// 2. Select database
	const selectedDatabase = await vscode.window.showQuickPick(
		dbs,
		{ title: constants.selectDatabase, ignoreFocusOut: true });
	if (!selectedDatabase) {
		// User cancelled
		return undefined;
	}

	// 3. Prompt for project name
	const projectName = await vscode.window.showInputBox(
		{
			title: constants.projectNamePlaceholderText,
			value: defaultProjectNameFromDb(selectedDatabase),
			validateInput: (value) => {
				return value ? undefined : constants.nameMustNotBeEmpty;
			},
			ignoreFocusOut: true
		});
	if (!projectName) {
		return undefined;
	}

	// 4. Prompt for Project location
	// Show quick pick with just browse option to give user context about what the file dialog is for (since that doesn't always have a title)
	const browseProjectLocation = await vscode.window.showQuickPick(
		[constants.browseEllipsis],
		{ title: constants.projectLocationPlaceholderText, ignoreFocusOut: true });
	if (!browseProjectLocation) {
		return undefined;
	}
	// We validate that the folder doesn't already exist, and if it does keep prompting them to pick a new one
	let valid = false;
	let projectLocation = '';
	while (!valid) {
		const locations = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: constants.selectString,
			title: constants.selectProjectLocation,
			defaultUri: defaultProjectSaveLocation()
		});
		if (!locations) {
			// User cancelled
			return undefined;
		}
		projectLocation = locations[0].fsPath;
		const locationExists = await exists(path.join(projectLocation, projectName));
		if (locationExists) {
			// Show the browse quick pick again with the title updated with the error
			const browseProjectLocation = await vscode.window.showQuickPick(
				[constants.browseEllipsis],
				{ title: constants.folderAlreadyExistsChooseNewLocation(projectName), ignoreFocusOut: true });
			if (!browseProjectLocation) {
				return undefined;
			}
		} else {
			valid = true;
		}
	}

	// 5: Prompt for folder structure
	const folderStructure = await vscode.window.showQuickPick(
		[constants.file, constants.flat, constants.objectType, constants.schema, constants.schemaObjectType],
		{ title: constants.selectFolderStructure, ignoreFocusOut: true, });
	if (!folderStructure) {
		// User cancelled
		return undefined;
	}

	return {
		connectionUri: connectionUri,
		database: selectedDatabase,
		projName: projectName,
		filePath: projectLocation,
		version: '1.0.0.0',
		extractTarget: mapExtractTargetEnum(folderStructure)
	};
}
