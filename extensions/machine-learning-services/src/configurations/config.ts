/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ApiWrapper } from '../common/apiWrapper';
import * as constants from '../common/constants';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PackageConfigModel } from './packageConfigModel';

const configFileName = 'config.json';
const defaultPythonExecutable = 'python';
const defaultRExecutable = 'r';


/**
 * Extension Configuration from app settings
 */
export class Config {

	private _configValues: any;
	private _mlsConfig: vscode.WorkspaceConfiguration | undefined;

	constructor(private _root: string, private _apiWrapper: ApiWrapper) {
	}

	/**
	 * Loads the config values
	 */
	public async load(): Promise<void> {
		const rawConfig = await fs.readFile(path.join(this._root, 'out', 'configurations', configFileName));
		this._configValues = JSON.parse(rawConfig.toString());
	}

	/**
	 * Returns the config value of required python packages
	 */
	public get requiredPythonPackages(): PackageConfigModel[] {
		return this._configValues.requiredPythonPackages;
	}

	/**
	 * Returns the config value of required r packages
	 */
	public get requiredRPackages(): PackageConfigModel[] {
		return this._configValues.requiredRPackages;
	}

	/**
	 * Returns r packages repository
	 */
	public get rPackagesRepository(): string {
		return this._configValues.rPackagesRepository;
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

	private get config(): vscode.WorkspaceConfiguration {
		if (!this._mlsConfig) {
			this._mlsConfig = this._apiWrapper.getConfiguration(constants.mlsConfigKey);
		}
		return this._mlsConfig;
	}
}
