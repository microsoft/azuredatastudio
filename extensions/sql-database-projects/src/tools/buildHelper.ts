/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import * as utils from '../common/utils';

const buildDirectory = 'BuildDiectory';
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

	private extensionDir: string = '';
	private extenionBuildDir: string = '';

	constructor(context?: vscode.ExtensionContext) {
		this.extensionDir = context ? context.extensionPath : '';
	}

	// create build dlls directory
	// this should not be required. temporary solution for issue #10273
	public async createBuildDirFolder(): Promise<void> {
		const extensionBuildDir = path.join(this.extensionDir, buildDirectory);
		await fs.rmdir(extensionBuildDir);

		const buildfilesPath = await this.getBuildDirPathFromMssqlTools();

		fs.mkdir(extensionBuildDir);
		buildFiles.forEach(async (fileName) => {
			await fs.copyFile(path.join(buildfilesPath, fileName), path.join(extensionBuildDir, fileName));
		});

		this.extenionBuildDir = extensionBuildDir;
	}

	// get mssql sqltoolsservice path
	private async getBuildDirPathFromMssqlTools(): Promise<string> {
		const mssqlConfigDir = path.join(this.extensionDir, '..', 'mssql');
		const rawConfig = await fs.readFile(path.join(mssqlConfigDir, 'config.json'));
		const config = JSON.parse(rawConfig.toString());
		const installDir = config.installDirectory?.replace('{#version#}', config.version).replace('{#platform#}', 'Windows');
		return path.join(mssqlConfigDir, installDir);
	}

	public get extensionBuildDirPath(): string {
		return this.extenionBuildDir;
	}

	public constructBuildArguments(projectPath: string, buildDirPath: string): string {
		projectPath = utils.getSafePath(projectPath);
		buildDirPath = utils.getSafePath(buildDirPath);
		return ' build ' + projectPath + ` /p:NetCoreBuild=true /p:NetCoreBuildPath=${buildDirPath}`;
	}
}

