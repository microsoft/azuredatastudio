/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as constants from '../common/constants';

/**
 * Returns the default location to save a new database project
 */
export function defaultProjectSaveLocation(): vscode.Uri | undefined {
	return projectSaveLocationSettingIsValid() ? vscode.Uri.file(projectSaveLocationSetting()) : undefined;
}

/**
 * Get workspace configurations for this extension
 */
function config(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(constants.ProjectConfigurationKey);
}

/**
 * Returns the workspace setting on the default location to save new database projects
 */
function projectSaveLocationSetting(): string {
	return config()[constants.ProjectSaveLocationKey];
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

