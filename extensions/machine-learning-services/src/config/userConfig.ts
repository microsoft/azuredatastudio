/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ApiWrapper } from '../common/apiWrapper';
import * as constants from '../common/constants';

const defaultPythonExecutable = 'python';
const defaultRExecutable = 'r';

/**
 * Extension Configuration from user settings
 */
export class UserConfig {

	private _mlsConfig: vscode.WorkspaceConfiguration;


	constructor(private _apiWrapper: ApiWrapper) {
		this._mlsConfig = this._apiWrapper.getConfiguration(constants.mlsConfigKey);
	}

	/**
	 * Returns python path from user settings
	 */
	public get pythonExecutable(): string {
		return this._mlsConfig.get(constants.pythonPathConfigKey) || defaultPythonExecutable;
	}

	/**
	 * Returns r path from user settings
	 */
	public get rExecutable(): string {
		return this._mlsConfig.get(constants.rPathConfigKey) || defaultRExecutable;
	}
}
