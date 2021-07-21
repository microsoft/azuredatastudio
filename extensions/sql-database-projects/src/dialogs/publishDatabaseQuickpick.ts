/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { IGenerateScriptSettings, IPublishSettings } from '../models/IPublishSettings';
import { Project } from '../models/project';
import { PublishProfile, readPublishProfile } from '../models/publishProfile/publishProfile';
import { promptForPublishProfile } from './publishDatabaseDialog';
import { getVscodeMssqlApi } from '../common/utils';

/**
 * Create flow for Publishing a database using only VS Code-native APIs such as QuickPick
 */
export async function launchPublishDatabaseQuickpick(project: Project): Promise<void> {

	// 1. Select publish settings file (optional)
	// Create custom quickpick so we can control stuff like displaying the loading indicator
	const quickPick = vscode.window.createQuickPick();
	quickPick.items = [{ label: constants.dontUseProfile }, { label: constants.browseForProfile }];
	quickPick.ignoreFocusOut = true;
	quickPick.title = constants.selectProfileToUse;
	const profilePicked = new Promise<PublishProfile | undefined>((resolve, reject) => {
		quickPick.onDidHide(() => {
			// If the quickpick is hidden that means the user cancelled or another quickpick came up - so we reject
			// here to be able to complete the promise being waited on below
			reject();
		});
		quickPick.onDidChangeSelection(async items => {
			if (items[0].label === constants.browseForProfile) {
				const locations = await promptForPublishProfile(project.projectFolderPath);
				if (!locations) {
					// Clear items so that this event will trigger again if they select the same item
					quickPick.selectedItems = [];
					quickPick.activeItems = [];
					// If the user cancels out of the file picker then just return and let them choose another option
					return;
				}
				let publishProfileUri = locations[0];
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
	const vscodeMssqlApi = await getVscodeMssqlApi();
	let dbs: string[] | undefined = undefined;
	while (!dbs) {
		const connectionProfile = await vscodeMssqlApi.promptForConnection(true);
		if (!connectionProfile) {
			return;
		}
		// Get the list of databases now to validate that the connection is valid and re-prompt them if it isn't
		try {
			dbs = await vscodeMssqlApi.listDatabases(connectionProfile);
		} catch (err) {
			// no-op, the mssql extension handles showing the error to the user. We'll just go
			// back and prompt the user for a connection again
		}
	}

	// 3. Select database
	const dbQuickpicks = dbs.map(db => {
		return {
			label: db,
			dbName: db
		} as vscode.QuickPickItem & { dbName: string, isCreateNew?: boolean };
	});
	// Ensure the project name is an option, either adding it if it doesn't already exist or moving it to the top if it does
	const projectNameIndex = dbs.findIndex(db => db === project.projectFileName);
	if (projectNameIndex === -1) {
		dbQuickpicks.unshift({ label: constants.newDatabaseTitle(project.projectFileName), dbName: project.projectFileName });
	} else {
		dbQuickpicks.splice(projectNameIndex, 1);
		dbQuickpicks.unshift({ label: project.projectFileName, dbName: project.projectFileName });
	}

	dbQuickpicks.push({ label: constants.createNew, dbName: '', isCreateNew: true });

	let databaseName: string | undefined = undefined;
	while (!databaseName) {
		const selectedDatabase = await vscode.window.showQuickPick(
			dbQuickpicks,
			{ title: constants.selectDatabase, ignoreFocusOut: true });
		if (!selectedDatabase) {
			// User cancelled
			return;
		}
		databaseName = selectedDatabase.dbName;
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
	// If a publish profile is provided then the values from there will overwrite the ones in the
	// project file (if they exist)
	let sqlCmdVariables = Object.assign({}, project.sqlCmdVariables, publishProfile?.sqlCmdVariables);

	if (Object.keys(sqlCmdVariables).length > 0) {
		// Continually loop here, allowing the user to modify SQLCMD variables one
		// at a time until they're done (either by selecting the "Done" option or
		// escaping out of the quick pick dialog). Users can modify each variable
		// as many times as they wish - with an option to reset all the variables
		// to their starting values being provided as well.
		while (true) {
			const quickPickItems = Object.keys(sqlCmdVariables).map(key => {
				return {
					label: key,
					description: sqlCmdVariables[key],
					key: key
				} as vscode.QuickPickItem & { key?: string, isResetAllVars?: boolean, isDone?: boolean };
			});
			quickPickItems.push({ label: constants.resetAllVars, isResetAllVars: true });
			quickPickItems.unshift({ label: constants.done, isDone: true });
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
						value: sqlCmdVariables[sqlCmd.key],
						ignoreFocusOut: true
					}
				);
				if (newValue) {
					sqlCmdVariables[sqlCmd.key] = newValue;
				}
			} else if (sqlCmd.isResetAllVars) {
				sqlCmdVariables = Object.assign({}, project.sqlCmdVariables, publishProfile?.sqlCmdVariables);
			} else if (sqlCmd.isDone) {
				break;
			}

		}
	}

	// 5. Select action to take
	const action = await vscode.window.showQuickPick(
		[constants.generateScriptButtonText, constants.publish],
		{ title: constants.chooseAction, ignoreFocusOut: true });
	if (!action) {
		return;
	}

	// TODO@chgagnon: Get deployment options
	// 6. Generate script/publish
	let settings: IPublishSettings | IGenerateScriptSettings = {
		databaseName: databaseName,
		serverName: '', // TODO@chgagnon: Get from connection profile
		connectionUri: '', // TODO@chgagnon: Get from connection profile
		sqlCmdVariables: undefined, // this.getSqlCmdVariablesForPublish(),
		deploymentOptions: undefined, // await this.getDeploymentOptions(),
		profileUsed: true, // this.profileUsed,
	};

	// TODO@chgagnon Consolidate creation of the settings into one place
	if (action === constants.publish) {
		(settings as IPublishSettings).upgradeExisting = true;
	}
}
