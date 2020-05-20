/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as constants from './../common/constants';
import * as fs from 'fs';
import * as utils from '../common/utils';
import { mssqlNotFound } from '../common/constants';

const buildDirectory = 'BuildDirectory';
const buildFiles: string[] = [
	'Microsoft.Data.SqlClient.dll',
	'Microsoft.Data.Tools.Schema.Sql.dll',
	'Microsoft.Data.Tools.Schema.Tasks.Sql.dll',
	'Microsoft.Data.Tools.Utilities.dll',
	'Microsoft.SqlServer.Dac.dll',
	'Microsoft.SqlServer.Dac.Extensions.dll',
	'Microsoft.SqlServer.TransactSql.ScriptDom.dll',
	'Microsoft.SqlServer.Types.dll',
	'System.ComponentModel.Composition.dll',
	'Microsoft.Data.Tools.Schema.SqlTasks.targets'
];

export class BuildHelper {

	private extensionDir: string;
	private extensionBuildDir: string;
	private initialized: boolean = false;

	constructor() {
		this.extensionDir = vscode.extensions.getExtension(constants.sqlDatabaseProjectExtensionId)?.extensionPath ?? '';
		this.extensionBuildDir = path.join(this.extensionDir, buildDirectory);
	}

	// create build dlls directory
	// this should not be required. temporary solution for issue #10273
	public async createBuildDirFolder(): Promise<void> {

		if (this.initialized) {
			return;
		}

		if (!await new Promise(c => fs.exists(this.extensionBuildDir, c))) {
			await fs.promises.mkdir(this.extensionBuildDir);
		}

		const buildfilesPath = await this.getBuildDirPathFromMssqlTools();

		buildFiles.forEach(async (fileName) => {
			fs.exists(path.join(buildfilesPath, fileName), async (fileExists) => {
				if (fileExists) {
					await fs.promises.copyFile(path.join(buildfilesPath, fileName), path.join(this.extensionBuildDir, fileName));
				}
			});
		});

		this.initialized = true;
	}

	// get mssql sqltoolsservice path
	private async getBuildDirPathFromMssqlTools(): Promise<string> {
		const mssqlConfigDir = vscode.extensions.getExtension(constants.mssqlExtensionId)?.extensionPath ?? '';
		const rawConfig = await new Promise(c => fs.exists(path.join(mssqlConfigDir, 'config.json'), c))
			? await fs.promises.readFile(path.join(mssqlConfigDir, 'config.json'))
			: undefined;

		if (rawConfig) {
			const config = JSON.parse(rawConfig.toString());
			const installDir = config.installDirectory?.replace('{#version#}', config.version).replace('{#platform#}', this.getPlatform());
			if (installDir) {
				return path.join(mssqlConfigDir, installDir);
			}
		}
		throw new Error(mssqlNotFound(mssqlConfigDir));
	}

	private getPlatform(): string {
		return os.platform() === 'win32' ? 'Windows' :
			os.platform() === 'darwin' ? 'OSX' :
				os.platform() === 'linux' ? 'Linux' :
					'';
	}

	public get extensionBuildDirPath(): string {
		return this.extensionBuildDir;
	}

	public constructBuildArguments(projectPath: string, buildDirPath: string): string {
		projectPath = utils.getSafePath(projectPath);
		buildDirPath = utils.getSafePath(buildDirPath);
		return ` build ${projectPath} /p:NetCoreBuild=true /p:NETCoreTargetsPath=${buildDirPath}`;
	}
}

