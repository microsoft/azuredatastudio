/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { IGenerateScriptSettings, IPublishSettings } from '../models/IPublishSettings';
import { Project } from '../models/project';
import { promptForPublishProfile } from './publishDatabaseDialog';

/**
 * Create flow for Publishing a database using only VS Code-native APIs such as QuickPick
 */
export async function launchPublishDatabaseQuickpick(project: Project): Promise<void> {

	// 1. Select publish settings file (optional)
	// TODO@chgagnon: Hook up to dacfx service
	const browseProfileOption = await vscode.window.showQuickPick(
		[constants.dontUseProfile, constants.browseForProfile],
		{ title: constants.selectProfile, ignoreFocusOut: true });
	if (!browseProfileOption) {
		return;
	}

	// let publishSettingsFile: vscode.Uri | undefined;
	if (browseProfileOption === constants.browseForProfile) {
		const locations = await promptForPublishProfile(project.projectFolderPath);
		if (!locations) {
			return;
		}
		// publishSettingsFile = locations[0];
	}

	// 2. Select connection
	// TODO@chgagnon: Hook up to MSSQL
	const connectionProfile = await vscode.window.showQuickPick(
		['Connection 1', 'Connection 2', 'Create New Connection'],
		{ title: constants.selectConnection, ignoreFocusOut: true });
	if (!connectionProfile) {
		return;
	}
	const dbs = ['db1', 'db2'];
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
	// 3. Select database
	// TODO@chgagnon: Hook up to MSSQL
	let databaseName = '';
	while (databaseName === '') {
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
	// TODO@chgagnon: Concat ones from publish profile
	let sqlCmdVariables = Object.assign({}, project.sqlCmdVariables);

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
				sqlCmdVariables = Object.assign({}, project.sqlCmdVariables);
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
