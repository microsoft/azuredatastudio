/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { Project } from '../models/project';
import { PublishProfile, readPublishProfile } from '../models/publishProfile/publishProfile';
import { promptForPublishProfile } from './publishDatabaseDialog';
import { getDefaultPublishDeploymentOptions, getVscodeMssqlApi } from '../common/utils';
import { IConnectionInfo, IFireWallRuleError } from 'vscode-mssql';
import { getPublishServerName } from './utils';
import { ISqlProject, SqlTargetPlatform } from 'sqldbproj';
import { DBProjectConfigurationKey } from '../tools/netcoreTool';
import { ISqlProjectPublishSettings } from '../models/deploy/publishSettings';

/**
 * Create flow for Publishing a database using only VS Code-native APIs such as QuickPick
 */
export async function getPublishDatabaseSettings(project: ISqlProject, promptForConnection: boolean = true): Promise<ISqlProjectPublishSettings | undefined> {

	// 1. Select publish settings file (optional)
	let publishProfileUri;
	// Create custom quickpick so we can control stuff like displaying the loading indicator
	const quickPick = vscode.window.createQuickPick();
	quickPick.items = [{ label: constants.dontUseProfile }, { label: constants.browseForProfileWithIcon }];
	quickPick.ignoreFocusOut = true;
	quickPick.title = constants.selectProfileToUse;
	const profilePicked = new Promise<PublishProfile | undefined>((resolve, reject) => {
		quickPick.onDidHide(() => {
			// If the quickpick is hidden that means the user cancelled or another quickpick came up - so we reject
			// here to be able to complete the promise being waited on below
			reject();
		});
		quickPick.onDidChangeSelection(async items => {
			if (items[0].label === constants.browseForProfileWithIcon) {
				const locations = await promptForPublishProfile(project.projectFolderPath);
				if (!locations) {
					// Clear items so that this event will trigger again if they select the same item
					quickPick.selectedItems = [];
					quickPick.activeItems = [];
					// If the user cancels out of the file picker then just return and let them choose another option
					return;
				}
				publishProfileUri = locations[0];
				try {
					// Show loading state while reading profile
					quickPick.busy = true;
					quickPick.enabled = false;
					const profile = await readPublishProfile(publishProfileUri);
					resolve(profile);
				} catch (err) {
					// readPublishProfile will handle displaying an error if one occurs
					// Clear items so that this event will trigger again if they select the same item
					quickPick.selectedItems = [];
					quickPick.activeItems = [];
					quickPick.busy = false;
					quickPick.enabled = true;

				}
			} else {
				// Selected no profile so just continue on
				resolve(undefined);
			}
		});
	});
	quickPick.show();
	let publishProfile: PublishProfile | undefined = undefined;
	try {
		publishProfile = await profilePicked;
	} catch (err) {
		// User cancelled or another quickpick came up and hid the current one
		// so exit the flow.
		return;
	}
	quickPick.hide(); // Hide the quickpick immediately so it isn't showing while the API loads

	// 2. Select connection

	let connectionProfile: IConnectionInfo | undefined = undefined;
	let dbs: string[] | undefined = undefined;
	let connectionUri: string | undefined;
	if (promptForConnection) {
		const vscodeMssqlApi = await getVscodeMssqlApi();
		while (!dbs) {
			connectionProfile = await vscodeMssqlApi.promptForConnection(true);
			if (!connectionProfile) {
				// User cancelled
				return;
			}
			// Get the list of databases now to validate that the connection is valid and re-prompt them if it isn't
			try {
				try {
					connectionUri = await vscodeMssqlApi.connect(connectionProfile);
				} catch (azureErr) {
					// If the error is the firewall rule, prompt to add firewall rule and try again
					const firewallRuleError = <IFireWallRuleError>azureErr;
					if (firewallRuleError?.connectionUri) {
						await vscodeMssqlApi.promptForFirewallRule(azureErr.connectionUri, connectionProfile);
						connectionUri = await vscodeMssqlApi.connect(connectionProfile);
					} else {
						throw azureErr;
					}
				}
				dbs = await vscodeMssqlApi.listDatabases(connectionUri);
			} catch (err) {
				// no-op, the mssql extension handles showing the error to the user. We'll just go
				// back and prompt the user for a connection again
			}
		}
	} else {
		dbs = [];
	}

	// 3. Select database
	const dbQuickpicks = dbs
		.filter(db => !constants.systemDbs.includes(db))
		.map(db => {
			return {
				label: db
			} as vscode.QuickPickItem & { isCreateNew?: boolean };
		});
	// Add Create New at the top now so it'll show second to top below the suggested name of the current project
	dbQuickpicks.unshift({ label: `$(add) ${constants.createNew}`, isCreateNew: true });

	// if a publish profile was loaded and had a database name, use that instead of the project file name
	const dbName = publishProfile?.databaseName || project.projectFileName;

	// Ensure the project name or name specified in the publish profile is an option
	const projectNameIndex = dbQuickpicks.findIndex(db => db.label === dbName);
	if (projectNameIndex === -1) { // add it if it doesn't already exist...
		dbQuickpicks.unshift({ label: dbName, description: constants.newText });
	} else { // ...or move it to the top if it does
		const removed = dbQuickpicks.splice(projectNameIndex, 1)[0];
		dbQuickpicks.unshift(removed);
	}

	let databaseName: string | undefined = undefined;
	while (!databaseName) {
		const selectedDatabase = await vscode.window.showQuickPick(
			dbQuickpicks,
			{ title: constants.selectDatabase, ignoreFocusOut: true });
		if (!selectedDatabase) {
			// User cancelled
			return;
		}
		databaseName = selectedDatabase.label;
		if (selectedDatabase.isCreateNew) {
			databaseName = await vscode.window.showInputBox(
				{
					title: constants.enterNewDatabaseName,
					ignoreFocusOut: true,
					validateInput: input => input ? undefined : constants.nameMustNotBeEmpty
				}
			) ?? '';
			// If user cancels out of this just return them to the db select quickpick in case they changed their mind
		}
	}

	// 4. Modify sqlcmd vars
	let sqlCmdVariables: Map<string, string> = getInitialSqlCmdVariables(project, publishProfile);

	if (sqlCmdVariables.size > 0) {
		// Continually loop here, allowing the user to modify SQLCMD variables one
		// at a time until they're done (either by selecting the "Done" option or
		// escaping out of the quick pick dialog). Users can modify each variable
		// as many times as they wish - with an option to reset all the variables
		// to their starting values being provided as well.
		while (true) {
			let quickPickItems = [];
			for (const key of sqlCmdVariables.keys()) {
				quickPickItems.push({
					label: key,
					description: sqlCmdVariables.get(key),
					key: key
				} as vscode.QuickPickItem & { key?: string, isResetAllVars?: boolean, isDone?: boolean })
			}
			quickPickItems.push({ label: `$(refresh) ${constants.resetAllVars}`, isResetAllVars: true });
			quickPickItems.unshift({ label: `$(check) ${constants.done}`, isDone: true });
			const sqlCmd = await vscode.window.showQuickPick(
				quickPickItems,
				{ title: constants.chooseSqlcmdVarsToModify, ignoreFocusOut: true }
			);
			if (!sqlCmd) {
				// When user hits escape then we continue on here, we don't exit the publish
				// flow since this is an optional step
				break;
			}
			if (sqlCmd.key) {
				const newValue = await vscode.window.showInputBox(
					{
						title: constants.enterNewValueForVar(sqlCmd.key),
						value: sqlCmdVariables.get(sqlCmd.key),
						ignoreFocusOut: true
					}
				);
				if (newValue) {
					sqlCmdVariables.set(sqlCmd.key, newValue);
				}
			} else if (sqlCmd.isResetAllVars) {
				sqlCmdVariables = getInitialSqlCmdVariables(project, publishProfile);
			} else if (sqlCmd.isDone) {
				break;
			}

		}
	}

	// 6. Generate script/publish
	let settings: ISqlProjectPublishSettings = {
		databaseName: databaseName,
		serverName: connectionProfile?.server || '',
		connectionUri: connectionUri || '',
		sqlCmdVariables: sqlCmdVariables,
		deploymentOptions: publishProfile?.options ?? await getDefaultPublishDeploymentOptions(project),
		publishProfileUri: publishProfileUri
	};
	return settings;
}

/**
 * Loads the sqlcmd variables from a sql projects. If a publish profile is provided then the values from there will overwrite the ones in the project file (if they exist)
 * @param project
 * @param publishProfile
 * @returns Map of sqlcmd variables
 */
function getInitialSqlCmdVariables(project: ISqlProject, publishProfile?: PublishProfile): Map<string, string> {
	// create a copy of the sqlcmd variable map so that the original ones don't get overwritten
	let sqlCmdVariables = new Map(project.sqlCmdVariables);
	if (publishProfile?.sqlCmdVariables) {
		for (const [key, value] of publishProfile.sqlCmdVariables) {
			sqlCmdVariables.set(key, value);
		}
	}

	return sqlCmdVariables;
}

export async function launchPublishTargetOption(project: Project): Promise<constants.PublishTargetType | undefined> {
	// Show options to user for deploy to existing server or docker
	const target = project.getProjectTargetVersion();
	const name = getPublishServerName(target);
	const logicalServerName = target === constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlAzure) ? constants.AzureSqlLogicalServerName : constants.SqlServerName;

	// Options list based on target
	let options;

	if (target === constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlAzure)) {
		options = [constants.publishToAzureEmulator, constants.publishToExistingServer(logicalServerName)]

		// only show "Publish to New Azure Server" option if preview features are enabled
		const enablePreviewFeatures = vscode.workspace.getConfiguration(DBProjectConfigurationKey).get(constants.enablePreviewFeaturesKey);
		if (enablePreviewFeatures) {
			options.push(constants.publishToNewAzureServer);
		}
	} else {
		options = [constants.publishToDockerContainer(name), constants.publishToExistingServer(logicalServerName)];
	}

	// Show the options to the user
	const publishOption = await vscode.window.showQuickPick(
		options,
		{ title: constants.selectPublishOption, ignoreFocusOut: true });

	// Return when user hits escape
	if (!publishOption) {
		return undefined;
	}

	// Map the title to the publish option type
	switch (publishOption) {
		case constants.publishToExistingServer(name):
			return constants.PublishTargetType.existingServer;
		case constants.publishToDockerContainer(name):
			return constants.PublishTargetType.docker;
		case constants.publishToAzureEmulator:
			return constants.PublishTargetType.docker;
		case constants.publishToNewAzureServer:
			return constants.PublishTargetType.newAzureServer;
		default:
			return constants.PublishTargetType.existingServer;
	}
}

