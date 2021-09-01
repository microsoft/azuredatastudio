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
 * Gets the Azure Functions project that contains the given file if the project is open in one of the workspace folders
 * @param filePath file that the containing project needs to be found for
 * @returns filepath of project or undefined if project couldn't be found
 */
export async function getAFProjectContainingFile(filePath: string): Promise<string | undefined> {
	// get functions csprojs in the workspace
	const projectPromises = vscode.workspace.workspaceFolders?.map(f => utils.getAllProjectsInFolder(f.uri, '.csproj')) ?? [];
	const functionsProjects = (await Promise.all(projectPromises)).reduce((prev, curr) => prev.concat(curr), []).filter(p => isFunctionProject(path.dirname(p.fsPath)));

	// look for project folder containing file if there's more than one
	if (functionsProjects.length > 1) {
		// TODO: figure out which project contains the file
		// the new style csproj doesn't list all the files in the project anymore, unless the file isn't in the same folder
		// so we can't rely on using that to check
		console.error('need to find which project contains the file ' + filePath);
		return undefined;
	} else if (functionsProjects.length === 0) {
		throw new Error(constants.noAzureFunctionsProjectsInWorkspace);
	} else {
		return functionsProjects[0].fsPath;
	}
}

// Use 'host.json' as an indicator that this is a functions project
// copied from verifyIsproject.ts in vscode-azurefunctions extension
export async function isFunctionProject(folderPath: string): Promise<boolean> {
	return fse.pathExists(path.join(folderPath, constants.hostFileName));
}
