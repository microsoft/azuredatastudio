/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import * as utils from '../common/utils';
import { errorFindingBuildFilesLocation } from '../common/constants';
import * as mssql from '../../../mssql/src/mssql';
import * as vscodeMssql from 'vscode-mssql';
import * as sqldbproj from 'sqldbproj';

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
	'System.IO.Packaging.dll',
	'Microsoft.Data.Tools.Schema.SqlTasks.targets'
];

export class BuildHelper {

	private extensionDir: string;
	private extensionBuildDir: string;
	private initialized: boolean = false;

	constructor() {
		const extName = utils.getAzdataApi() ? sqldbproj.extension.name : sqldbproj.extension.vsCodeName;
		this.extensionDir = vscode.extensions.getExtension(extName)?.extensionPath ?? '';
		this.extensionBuildDir = path.join(this.extensionDir, buildDirectory);
	}

	// create build dlls directory
	// this should not be required. temporary solution for issue #10273
	public async createBuildDirFolder(): Promise<void> {

		if (this.initialized) {
			return;
		}

		if (!await utils.exists(this.extensionBuildDir)) {
			await fs.mkdir(this.extensionBuildDir);
		}

		const buildfilesPath = await this.getBuildDirPathFromMssqlTools();
		buildFiles.forEach(async (fileName) => {
			if (await (utils.exists(path.join(buildfilesPath, fileName)))) {
				await fs.copyFile(path.join(buildfilesPath, fileName), path.join(this.extensionBuildDir, fileName));
			}
		});
		this.initialized = true;
	}

	/**
	 * Gets the path to the SQL Tools Service installation
	 * @returns
	 */
	private async getBuildDirPathFromMssqlTools(): Promise<string> {
		try {
			if (utils.getAzdataApi()) {
				return (vscode.extensions.getExtension(mssql.extension.name)?.exports as mssql.IExtension).sqlToolsServicePath;
			} else {
				return (vscode.extensions.getExtension(vscodeMssql.extension.name)?.exports as vscodeMssql.IExtension).sqlToolsServicePath;
			}
		} catch (err) {
			throw new Error(errorFindingBuildFilesLocation(err));
		}
	}

	public get extensionBuildDirPath(): string {
		return this.extensionBuildDir;
	}

	public constructBuildArguments(projectPath: string, buildDirPath: string, isSdkStyleProject: boolean): string {
		projectPath = utils.getQuotedPath(projectPath);
		buildDirPath = utils.getQuotedPath(buildDirPath);

		// Right now SystemDacpacsLocation and NETCoreTargetsPath get set to the same thing, but separating them out for if we move
		// the system dacpacs somewhere else and also so that the variable name makes more sense if building from the commandline,
		// since SDK style projects don't to specify the targets path, just where the system dacpacs are
		if (isSdkStyleProject) {
			return ` build ${projectPath} /p:NetCoreBuild=true /p:SystemDacpacsLocation=${buildDirPath}`;
		} else {
			return ` build ${projectPath} /p:NetCoreBuild=true /p:NETCoreTargetsPath=${buildDirPath}`;
		}
	}
}

