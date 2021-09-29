/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import * as utils from './utils';
import * as constants from './constants';
import { parseJson } from './parseJson';

/**
 * Represents the settings in an Azure function project's local.settings.json file
 */
export interface ILocalSettingsJson {
	IsEncrypted?: boolean;
	Values?: { [key: string]: string };
	Host?: { [key: string]: string };
	ConnectionStrings?: { [key: string]: string };
}

/**
 * copied and modified from vscode-azurefunctions extension
 * @param localSettingsPath full path to local.settings.json
 * @returns settings in local.settings.json. If no settings are found, returns default "empty" settings
 */
export async function getLocalSettingsJson(localSettingsPath: string): Promise<ILocalSettingsJson> {
	if (await fse.pathExists(localSettingsPath)) {
		const data: string = (await fse.readFile(localSettingsPath)).toString();
		if (/[^\s]/.test(data)) {
			try {
				return parseJson(data);
			} catch (error) {
				throw new Error(constants.failedToParse(error.message));
			}
		}
	}

	return {
		IsEncrypted: false // Include this by default otherwise the func cli assumes settings are encrypted and fails to run
	};
}

/**
 * Adds a new setting to a project's local.settings.json file
 * modified from setLocalAppSetting code from vscode-azurefunctions extension
 * @param projectFolder full path to project folder
 * @param key Key of the new setting
 * @param value Value of the new setting
 * @returns true if successful adding the new setting, false if unsuccessful
 */
export async function setLocalAppSetting(projectFolder: string, key: string, value: string): Promise<boolean> {
	const localSettingsPath: string = path.join(projectFolder, constants.azureFunctionLocalSettingsFileName);
	const settings: ILocalSettingsJson = await getLocalSettingsJson(localSettingsPath);

	settings.Values = settings.Values || {};
	if (settings.Values[key] === value) {
		// don't do anything if it's the same as the existing value
		return true;
	} else if (settings.Values[key]) {
		const result = await vscode.window.showWarningMessage(constants.settingAlreadyExists(key), { modal: true }, constants.yesString);
		if (result !== constants.yesString) {
			// key already exists and user doesn't want to overwrite it
			return false;
		}
	}

	settings.Values[key] = value;
	await fse.writeJson(localSettingsPath, settings, { spaces: 2 });

	return true;
}

/**
 * Gets the Azure Functions project that contains the given file if the project is open in one of the workspace folders
 * @param filePath file that the containing project needs to be found for
 * @returns uri of project or undefined if project couldn't be found
 */
export async function getAFProjectContainingFile(fileUri: vscode.Uri): Promise<vscode.Uri | undefined> {
	// get functions csprojs in the workspace
	const projectPromises = vscode.workspace.workspaceFolders?.map(f => utils.getAllProjectsInFolder(f.uri, '.csproj')) ?? [];
	const functionsProjects = (await Promise.all(projectPromises)).reduce((prev, curr) => prev.concat(curr), []).filter(p => isFunctionProject(path.dirname(p.fsPath)));

	// look for project folder containing file if there's more than one
	if (functionsProjects.length > 1) {
		// TODO: figure out which project contains the file
		// the new style csproj doesn't list all the files in the project anymore, unless the file isn't in the same folder
		// so we can't rely on using that to check
		console.error('need to find which project contains the file ' + fileUri.fsPath);
		return undefined;
	} else if (functionsProjects.length === 0) {
		throw new Error(constants.noAzureFunctionsProjectsInWorkspace);
	} else {
		return functionsProjects[0];
	}
}

// Use 'host.json' as an indicator that this is a functions project
// copied from verifyIsproject.ts in vscode-azurefunctions extension
export async function isFunctionProject(folderPath: string): Promise<boolean> {
	return fse.pathExists(path.join(folderPath, constants.hostFileName));
}
