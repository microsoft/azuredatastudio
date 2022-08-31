/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import * as utils from '../common/utils';
import * as sqldbproj from 'sqldbproj';
import * as extractZip from 'extract-zip';
import * as constants from '../common/constants';
import { HttpClient } from '../common/httpClient';

const buildDirectory = 'BuildDirectory';
const sdkName = 'Microsoft.Build.Sql';
const microsoftBuildSqlVersion = '0.1.3-preview'; // TODO: have this be configurable
const fullSdkName = `${sdkName}.${microsoftBuildSqlVersion}`;
const microsoftBuildSqlUrl = `https://www.nuget.org/api/v2/package/${sdkName}/${microsoftBuildSqlVersion}`;

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

	/**
	 * Create build dlls directory with the dlls and targets needed for building a sqlproj
	 * @param outputChannel
	 */
	public async createBuildDirFolder(outputChannel: vscode.OutputChannel): Promise<void> {

		if (this.initialized) {
			return;
		}

		if (!await utils.exists(this.extensionBuildDir)) {
			await fs.mkdir(this.extensionBuildDir);
		}

		// check if this if the nuget needs to be downloaded
		const nugetPath = path.join(this.extensionBuildDir, `${fullSdkName}.nupkg`);

		if (await utils.exists(nugetPath)) {
			// if it does exist, make sure all the necessary files are also in the BuildDirectory
			let missingFiles = false;
			for (const fileName of buildFiles) {
				if (!await (utils.exists(path.join(this.extensionBuildDir, fileName)))) {
					missingFiles = true;
					break;
				}
			}

			// if all the files are there, no need to continue
			if (!missingFiles) {
				return;
			}
		}

		// TODO: check nuget cache locations first to avoid downloading if those exist
		// download the Microsoft.Build.Sql sdk nuget
		outputChannel.appendLine(constants.downloadingDacFxDlls);

		try {
			const httpClient = new HttpClient();
			await httpClient.download(microsoftBuildSqlUrl, nugetPath, outputChannel);
		} catch (e) {
			void vscode.window.showErrorMessage(constants.errorDownloading(microsoftBuildSqlUrl, utils.getErrorMessage(e)));
			return;
		}

		// extract the files from the nuget
		outputChannel.appendLine(constants.extractingDacFxDlls);
		const extractedFolderPath = path.join(this.extensionDir, buildDirectory, sdkName);

		try {
			await extractZip(nugetPath, { dir: extractedFolderPath });
		} catch (e) {
			void vscode.window.showErrorMessage(constants.errorExtracting(nugetPath, utils.getErrorMessage(e)));
			return;
		}

		// copy the dlls and targets file to the BuildDirectory folder
		const buildfilesPath = path.join(extractedFolderPath, 'tools', 'netstandard2.1');

		for (const fileName of buildFiles) {
			if (await (utils.exists(path.join(buildfilesPath, fileName)))) {
				await fs.copyFile(path.join(buildfilesPath, fileName), path.join(this.extensionBuildDir, fileName));
			}
		}

		// cleanup extracted folder
		await fs.rm(extractedFolderPath, { recursive: true });

		this.initialized = true;
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

