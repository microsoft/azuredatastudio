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

	constructor(private _root: string, private _apiWrapper: ApiWrapper) {
	}

	/**
	 * Loads the config values
	 */
	public async load(): Promise<void> {
		const rawConfig = await fs.readFile(path.join(this._root, configFileName));
		this._configValues = JSON.parse(rawConfig.toString());
	}

	/**
	 * Returns the config value of required python packages
	 */
	public get requiredSqlPythonPackages(): PackageConfigModel[] {
		return this._configValues.sqlPackageManagement.requiredPythonPackages;
	}

	/**
	 * Returns the config value of required r packages
	 */
	public get requiredSqlRPackages(): PackageConfigModel[] {
		return this._configValues.sqlPackageManagement.requiredRPackages;
	}

	/**
	 * Returns r packages repository
	 */
	public get rPackagesRepository(): string {
		return this._configValues.sqlPackageManagement.rPackagesRepository;
	}

	/**
	 * Returns python path from user settings
	 */
	public get pythonExecutable(): string {
		return this.config.get(constants.pythonPathConfigKey) || defaultPythonExecutable;
	}

	/**
	 * Returns true if python package management is enabled
	 */
	public get pythonEnabled(): boolean {
		return this.config.get(constants.pythonEnabledConfigKey) || false;
	}

	/**
	 * Returns true if r package management is enabled
	 */
	public get rEnabled(): boolean {
		return this.config.get(constants.rEnabledConfigKey) || false;
	}

	/**
	 * Returns registered models table name
	 */
	public get registeredModelTableName(): string {
		return this._configValues.modelManagement.registeredModelsTableName;
	}

	/**
	 * Returns registered models table schema name
	 */
	public get registeredModelTableSchemaName(): string {
		return this._configValues.modelManagement.registeredModelsTableSchemaName;
	}

	/**
	 * Returns registered models table name
	 */
	public get registeredModelDatabaseName(): string {
		return this._configValues.modelManagement.registeredModelsDatabaseName;
	}

	/**
	 * Returns Azure ML API
	 */
	public get amlModelManagementUrl(): string {
		return this._configValues.modelManagement.amlModelManagementUrl;
	}

	/**
	 * Returns Azure ML API
	 */
	public get amlExperienceUrl(): string {
		return this._configValues.modelManagement.amlExperienceUrl;
	}


	/**
	 * Returns Azure ML API Version
	 */
	public get amlApiVersion(): string {
		return this._configValues.modelManagement.amlApiVersion;
	}

	/**
	 * Returns model management python packages
	 */
	public get modelsRequiredPythonPackages(): PackageConfigModel[] {
		return this._configValues.modelManagement.requiredPythonPackages;
	}

	/**
	 * Returns r path from user settings
	 */
	public get rExecutable(): string {
		return this.config.get(constants.rPathConfigKey) || defaultRExecutable;
	}

	private get config(): vscode.WorkspaceConfiguration {
		return this._apiWrapper.getConfiguration(constants.mlsConfigKey);
	}
}
