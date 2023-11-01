/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as constants from '../common/constants';

/**
 * Returns the default location to save a dacpac or bacpac
 */
export function defaultSaveLocation(): string {
	return dacFxSaveLocationSettingIsValid() ? dacFxSaveLocationSetting() : os.homedir();
}

/**
 * Returns the workspace setting on the default location to save dacpacs and bacpacs
 */
function dacFxSaveLocationSetting(): string {
	return vscode.workspace.getConfiguration(constants.dacFxConfigurationKey)[constants.dacFxSaveLocationKey];
}

/**
 * Returns if the default save location for dacpacs and bacpacs setting exists and is a valid path
 */
function dacFxSaveLocationSettingIsValid(): boolean {
	return dacFxSaveLocationSetting() && dacFxSaveLocationSetting().trim() !== '' && fs.existsSync(dacFxSaveLocationSetting());
}
