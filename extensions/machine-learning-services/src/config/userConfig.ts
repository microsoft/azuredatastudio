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

	private _mlsConfig: vscode.WorkspaceConfiguration | undefined;

	constructor(private _apiWrapper: ApiWrapper) {
	}

	private get config(): vscode.WorkspaceConfiguration {
		if (!this._mlsConfig) {
			this._mlsConfig = this._apiWrapper.getConfiguration(constants.mlsConfigKey);
		}
		return this._mlsConfig;
	}

	/**
	 * Returns python path from user settings
	 */
	public get pythonExecutable(): string {
		return this.config.get(constants.pythonPathConfigKey) || defaultPythonExecutable;
	}

	/**
	 * Returns r path from user settings
	 */
	public get rExecutable(): string {
		return this.config.get(constants.rPathConfigKey) || defaultRExecutable;
	}
}
