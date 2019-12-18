/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { promises as fs } from 'fs';
import * as path from 'path';
import * as nbExtensionApis from '../typings/notebookServices';

const configFileName = 'config.json';

/**
 * Extension Configuration
 */
export class Config {

	private _configValues: any;

	constructor(private _root: string) {
	}

	/**
	 * Loads the config values
	 */
	public async load(): Promise<void> {
		const rawConfig = await fs.readFile(path.join(this._root, configFileName));
		this._configValues = JSON.parse(rawConfig.toString());
	}

	/**
	 * Returns the config value of required packages
	 */
	public get requiredPythonPackages(): nbExtensionApis.IPackageDetails[] {
		return this._configValues.requiredPythonPackages;
	}
}
