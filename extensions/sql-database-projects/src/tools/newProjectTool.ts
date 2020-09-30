/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as constants from '../common/constants';

/**
 * Sets workspace setting on the default save location to the user's home directory
 */
export async function initializeSaveLocationSetting() {
	if (!projectSaveLocationSettingExists()) {
		await config().update(constants.projectSaveLocationKey, os.homedir(), true);
	}
}

/**
 * Returns the default location to save a new database project
 */
export function defaultProjectSaveLocation(): vscode.Uri {
	return projectSaveLocationSettingIsValid() ? vscode.Uri.file(projectSaveLocationSetting()) : vscode.Uri.file(os.homedir());
}

/**
 * Returns default project name for a fresh new project, such as 'DatabaseProject1'. Auto-increments
 * the suggestion if a project of that name already exists in the default save location
 */
export function defaultProjectNameNewProj(): string {
	return defaultProjectName(constants.defaultProjectNameStarter, 1);
}

/**
 * Returns default project name for a new project based on given dbName. Auto-increments
 * the suggestion if a project of that name already exists in the default save location
 *
 * @param dbName the database name to base the default project name off of
 */
export function defaultProjectNameFromDb(dbName: string): string {
	const projectNameStarter = constants.defaultProjectNameStarter + dbName;
	const projectPath: string = path.join(defaultProjectSaveLocation().fsPath, projectNameStarter);
	if (!fs.existsSync(projectPath)) {
		return projectNameStarter;
	}

	return defaultProjectName(projectNameStarter, 2);
}

/**
 * Prompts user to update workspace settings
 */
export async function updateSaveLocationSetting(): Promise<void> {
	const showPrompt: boolean = config()[constants.showUpdatePromptKey];
	if (showPrompt) {
		const openSettingsMessage = projectSaveLocationSettingIsValid() ?
			constants.newDefaultProjectSaveLocation : constants.invalidDefaultProjectSaveLocation;
		const result = await vscode.window.showInformationMessage(openSettingsMessage, constants.openWorkspaceSettings,
			constants.doNotPromptAgain);

		if (result === constants.openWorkspaceSettings || result === constants.doNotPromptAgain) {
			// if user either opens settings or clicks "don't ask again", do not prompt for save location again
			await config().update(constants.showUpdatePromptKey, false, true);

			if (result === constants.openWorkspaceSettings) {
				await vscode.commands.executeCommand('workbench.action.openGlobalSettings'); //open settings
			}
		}
	}
}

/**
 * Get workspace configurations for this extension
 */
function config(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(constants.dbProjectConfigurationKey);
}

/**
 * Returns the workspace setting on the default location to save new database projects
 */
function projectSaveLocationSetting(): string {
	return config()[constants.projectSaveLocationKey];
}

/**
 * Returns if the default save location for new database projects workspace setting exists and is
 * a valid path
 */
function projectSaveLocationSettingIsValid(): boolean {
	return projectSaveLocationSettingExists() && fs.existsSync(projectSaveLocationSetting());
}

/**
 * Returns if a value for the default save location for new database projects exists
 */
function projectSaveLocationSettingExists(): boolean {
	return projectSaveLocationSetting() !== undefined && projectSaveLocationSetting() !== null
		&& projectSaveLocationSetting().trim() !== '';
}

/**
 * Returns a project name that begins with the given nameStarter, and ends in a number, such as
 * 'DatabaseProject1'. Number begins at the given counter, but auto-increments if a project of
 * that name already exists in the default save location.
 *
 * @param nameStarter the beginning of the default project name, such as 'DatabaseProject'
 * @param counter the starting value of of the number appended to the nameStarter
 */
function defaultProjectName(nameStarter: string, counter: number): string {
	while (counter < Number.MAX_SAFE_INTEGER) {
		const name: string = nameStarter + counter;
		const projectPath: string = path.join(defaultProjectSaveLocation().fsPath, name);
		if (!fs.existsSync(projectPath)) {
			return name;
		}
		counter++;
	}
	return constants.defaultProjectNameStarter + counter;
}
