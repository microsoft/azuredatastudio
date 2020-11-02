/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as constants from '../common/constants';

/**
 * Returns the default location to save a dacpac or bacpac
 */
export function defaultSaveLocation(): vscode.Uri | undefined {
	return dacFxSaveLocationSettingIsValid() ? vscode.Uri.file(dacFxSaveLocationSetting()) : undefined;
}

/**
 * Get workspace configurations for this extension
 */
function config(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(constants.dacFxConfigurationKey);
}

/**
 * Returns the workspace setting on the default location to save dacpacs and bacpacs
 */
function dacFxSaveLocationSetting(): string {
	return config()[constants.dacFxSaveLocationKey];
}

/**
 * Returns if the default save location for dacpacs and bacpacs setting exists and is
 * a valid path
 */
function dacFxSaveLocationSettingIsValid(): boolean {
	return dacFxSaveLocationSettingExists() && fs.existsSync(dacFxSaveLocationSetting());
}

/**
 * Returns if a value for the default save location exists
 */
function dacFxSaveLocationSettingExists(): boolean {
	return dacFxSaveLocationSetting() !== undefined && dacFxSaveLocationSetting() !== null
		&& dacFxSaveLocationSetting().trim() !== '';
}
