/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../common/constants';
import { exists, getVscodeMssqlApi, isValidBasenameErrorMessage, sanitizeStringForFilename, getErrorMessage } from '../common/utils';
import { IConnectionInfo } from 'vscode-mssql';
import { defaultProjectNameFromDb, defaultProjectSaveLocation } from '../tools/newProjectTool';
import { ImportDataModel } from '../models/api/import';
import { mapExtractTargetEnum } from './utils';

import { getSDKStyleProjectInfo } from './quickpickHelper';

/**
 * Create flow for a New Project using only VS Code-native APIs such as QuickPick
 * @param connectionInfo Optional connection info to use instead of prompting the user for a connection
 * @param createProjectFromDatabaseCallback Optional callback function to create the project from the user inputs
 */
export async function createNewProjectFromDatabaseWithQuickpick(connectionInfo?: IConnectionInfo, createProjectFromDatabaseCallback?: (model: ImportDataModel, connectionInfo?: string | IConnectionInfo, serverName?: string) => Promise<void>): Promise<void> {
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

	let isValidProfile = connectionProfile?.server !== undefined; // undefined when createProjectFromDatabase is launched without context (via command palette)

	while (!dbs) {
		// Get the list of databases now to validate that the connection is valid and re-prompt them if it isn't
		if (isValidProfile) {
			try {
				connectionUri = await vscodeMssqlApi.connect(connectionProfile);
				dbs = (await vscodeMssqlApi.listDatabases(connectionUri))
					.filter(db => !constants.systemDbs.includes(db)); // Filter out system dbs
			} catch (err) {
				// Prompt the user for a new connection and then go and try getting the DBs again
				isValidProfile = false;
				console.error(getErrorMessage(err));
			}
		} else {
			connectionProfile = await vscodeMssqlApi.promptForConnection(true);
			if (!connectionProfile) {
				return undefined; // cancelled by user
			} else {
				isValidProfile = true;
			}
		}
	}

	// Move the database for the given connection up to the top
	if (connectionProfile.database && connectionProfile.database !== constants.master) {
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
			value: defaultProjectNameFromDb(sanitizeStringForFilename(selectedDatabase)),
			validateInput: (value) => {
				return isValidBasenameErrorMessage(value);
			},
			ignoreFocusOut: true
		});
	if (!projectName) {
		return undefined;
	}

	// 4. Prompt for Project location
	const defaultProjectSaveLoc = defaultProjectSaveLocation();
	const browseProjectLocationOptions: string[] = [constants.browseEllipsisWithIcon];
	if (defaultProjectSaveLoc) {
		browseProjectLocationOptions.push(defaultProjectSaveLoc.fsPath);
	}
	// We validate that the folder doesn't already exist, and if it does keep prompting them to pick a new one
	let projectLocation = '';
	let browseProjectLocationTitle = constants.projectLocationPlaceholderText;
	while (true) {
		const browseProjectLocation = await vscode.window.showQuickPick(
			browseProjectLocationOptions,
			{ title: browseProjectLocationTitle, ignoreFocusOut: true });
		if (!browseProjectLocation) {
			// User cancelled
			return undefined;
		}
		if (browseProjectLocation === constants.browseEllipsisWithIcon) {
			const locations = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: constants.selectString,
				title: constants.selectProjectLocation,
				defaultUri: defaultProjectSaveLoc
			});
			if (!locations) {
				// User cancelled out of open dialog - let them choose location again
				browseProjectLocationTitle = constants.projectLocationPlaceholderText;
				continue;
			}
			projectLocation = locations[0].fsPath;
		} else {
			projectLocation = browseProjectLocation;
		}
		const locationExists = await exists(path.join(projectLocation, projectName));
		if (!locationExists) {
			// Have a valid location so exit out now
			break;
		}
		// Otherwise show the browse quick pick again with the title updated with the error
		browseProjectLocationTitle = constants.folderAlreadyExistsChooseNewLocation(projectName);
		continue;
	}

	// 5: Prompt for folder structure
	const folderStructure = await vscode.window.showQuickPick(
		[constants.schemaObjectType, constants.file, constants.flat, constants.objectType, constants.schema],
		{ title: constants.selectFolderStructure, ignoreFocusOut: true, });
	if (!folderStructure) {
		// User cancelled
		return undefined;
	}

	// 6. Include permissions or not
	const includePermissionsResult = await vscode.window.showQuickPick(
		[constants.noStringDefault, constants.yesString],
		{ title: constants.includePermissionsInProject, ignoreFocusOut: true }
	);

	if (!includePermissionsResult) {
		// User cancelled
		return undefined;
	}

	const includePermissions = includePermissionsResult === constants.yesString;

	// 7. SDK-style project or not
	let sdkStyle = await getSDKStyleProjectInfo();

	if (sdkStyle === undefined) {
		// User cancelled
		return;
	}

	// 8. Configure Sql project default build or not
	const configureDefaultBuild = await vscode.window.showQuickPick(
		[constants.yesString, constants.noString],
		{ title: constants.confirmCreateProjectWithBuildTaskDialogName, ignoreFocusOut: false }
	);

	if (!configureDefaultBuild) {
		// User cancelled
		return;
	}

	const model = {
		connectionUri: connectionUri,
		database: selectedDatabase,
		projName: projectName,
		filePath: projectLocation,
		version: '1.0.0.0',
		extractTarget: mapExtractTargetEnum(folderStructure),
		sdkStyle: sdkStyle,
		includePermissions: includePermissions,
		configureDefaultBuild: configureDefaultBuild === constants.yesString,
	} as ImportDataModel;

	// 9. Create the project using the callback
	if (createProjectFromDatabaseCallback) {
		await createProjectFromDatabaseCallback(model, connectionProfile, connectionProfile.server);
	}
}
