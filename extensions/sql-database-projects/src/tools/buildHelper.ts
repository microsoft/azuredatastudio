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
import { DBProjectConfigurationKey } from './netcoreTool';
import { ProjectType } from '../common/typeHelper';
import * as mssql from 'mssql';
import * as vscodeMssql from 'vscode-mssql';

const buildDirectory = 'BuildDirectory';
const sdkName = 'Microsoft.Build.Sql';
const microsoftBuildSqlDefaultVersion = '0.1.10-preview'; // default version of Microsoft.Build.Sql nuget to use for building legacy style projects, update in README when updating this
const scriptdomNugetPkgName = 'Microsoft.SqlServer.TransactSql.ScriptDom';
const scriptDomDll = 'Microsoft.SqlServer.TransactSql.ScriptDom.dll';
const scriptDomNugetVersion = '161.8812.0'; // TODO: make this a configurable setting, like the Microsoft.Build.Sql version

const dacFxBuildFiles: string[] = [
	'Microsoft.Data.SqlClient.dll',
	'Microsoft.Data.Tools.Schema.Sql.dll',
	'Microsoft.Data.Tools.Schema.Tasks.Sql.dll',
	'Microsoft.Data.Tools.Utilities.dll',
	'Microsoft.SqlServer.Dac.dll',
	'Microsoft.SqlServer.Dac.Extensions.dll',
	'Microsoft.SqlServer.Types.dll',
	'System.ComponentModel.Composition.dll',
	'System.IO.Packaging.dll',
	'Microsoft.Data.Tools.Schema.SqlTasks.targets',
	'Microsoft.SqlServer.Server.dll'
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
	public async createBuildDirFolder(outputChannel: vscode.OutputChannel): Promise<boolean> {

		if (this.initialized) {
			return true;
		}

		if (!await utils.exists(this.extensionBuildDir)) {
			await fs.mkdir(this.extensionBuildDir);
		}

		// check if the settings has a version specified for Microsoft.Build.Sql, otherwise use default
		const microsoftBuildSqlVersionConfig = vscode.workspace.getConfiguration(DBProjectConfigurationKey)[constants.microsoftBuildSqlVersionKey];
		const sdkVersion = !!microsoftBuildSqlVersionConfig ? microsoftBuildSqlVersionConfig : microsoftBuildSqlDefaultVersion;
		const fullSdkName = `${sdkName}.${sdkVersion}`;

		// check if this if the nuget needs to be downloaded
		const buildSdkNugetPath = path.join(this.extensionBuildDir, `${fullSdkName}.nupkg`);

		let missingDacFxFiles = false;
		let missingScriptDom = false;

		if (await utils.exists(buildSdkNugetPath)) {
			// if it does exist, make sure all the necessary files are also in the BuildDirectory
			for (const fileName of dacFxBuildFiles) {
				if (!await (utils.exists(path.join(this.extensionBuildDir, fileName)))) {
					missingDacFxFiles = true;
					break;
				}
			}
		} else {
			// if the Microsoft.Build.Sql nuget isn't there, it needs to be downloaded and the build dlls extracted
			missingDacFxFiles = true;
		}

		// check if scriptdom exists
		if (!await (utils.exists(path.join(this.extensionBuildDir, scriptDomDll)))) {
			missingScriptDom = true;
		}

		// if all the files are there, no need to continue
		if (!missingDacFxFiles && !missingScriptDom) {
			return true;
		}

		// TODO: check nuget cache locations first to avoid downloading if those exist
		// download the Microsoft.Build.Sql sdk nuget
		if (missingDacFxFiles) {
			outputChannel.appendLine(constants.downloadingDacFxDlls);

			const microsoftBuildSqlUrl = `https://www.nuget.org/api/v2/package/${sdkName}/${sdkVersion}`;

			// extract the files from the nuget
			const extractedFolderPath = path.join(this.extensionDir, buildDirectory, sdkName);
			outputChannel.appendLine(constants.extractingDacFxDlls(extractedFolderPath));

			try {
				await this.downloadAndExtractNuget(microsoftBuildSqlUrl, buildSdkNugetPath, extractedFolderPath, outputChannel);
			} catch (e) {
				void vscode.window.showErrorMessage(e);
				return false;
			}

			// copy the dlls and targets file to the BuildDirectory folder
			const buildfilesPath = path.join(extractedFolderPath, 'tools', 'netstandard2.1');

			for (const fileName of dacFxBuildFiles) {
				if (await (utils.exists(path.join(buildfilesPath, fileName)))) {
					await fs.copyFile(path.join(buildfilesPath, fileName), path.join(this.extensionBuildDir, fileName));
				}
			}

			// cleanup extracted folder
			await fs.rm(extractedFolderPath, { recursive: true });
		}

		if (missingScriptDom) {
			// download scriptdom
			outputChannel.appendLine(constants.downloadingScriptDom);

			const scriptdomNugetPath = path.join(this.extensionBuildDir, `${scriptdomNugetPkgName}.nupkg`);
			const scriptDomNugetUrl = `https://www.nuget.org/api/v2/package/${scriptdomNugetPkgName}/${scriptDomNugetVersion}`;
			const scriptDomExtractedFolderPath = path.join(this.extensionDir, buildDirectory, scriptdomNugetPkgName);

			try {
				await this.downloadAndExtractNuget(scriptDomNugetUrl, scriptdomNugetPath, scriptDomExtractedFolderPath, outputChannel);
			} catch (e) {
				void vscode.window.showErrorMessage(e);
				return false;
			}

			const extractedScriptDomPath = path.join(scriptDomExtractedFolderPath, 'lib', 'netstandard2.1', 'Microsoft.SqlServer.TransactSql.ScriptDom.dll')
			await fs.copyFile(extractedScriptDomPath, path.join(this.extensionBuildDir, 'Microsoft.SqlServer.TransactSql.ScriptDom.dll'));

			// cleanup extracted folder
			await fs.rm(scriptDomExtractedFolderPath, { recursive: true });
		}

		this.initialized = true;
		return true;
	}

	/**
	 * Downloads and extracts a nuget package
	 * @param downloadUrl Url to download the nuget package from
	 * @param nugetPath Path to download the nuget package to
	 * @param extractFolderPath Folder path to extract the nuget package contents to
	 * @param outputChannel
	 */
	public async downloadAndExtractNuget(downloadUrl: string, nugetPath: string, extractFolderPath: string, outputChannel: vscode.OutputChannel): Promise<void> {
		try {
			const httpClient = new HttpClient();
			outputChannel.appendLine(constants.downloadingFromTo(downloadUrl, nugetPath));
			await httpClient.download(downloadUrl, nugetPath, outputChannel);
		} catch (e) {
			throw constants.errorDownloading(extractFolderPath, utils.getErrorMessage(e));
		}

		try {
			await extractZip(nugetPath, { dir: extractFolderPath });
		} catch (e) {
			throw constants.errorExtracting(nugetPath, utils.getErrorMessage(e));
		}
	}

	public get extensionBuildDirPath(): string {
		return this.extensionBuildDir;
	}

	public constructBuildArguments(projectPath: string, buildDirPath: string, sqlProjStyle: ProjectType): string {
		projectPath = utils.getQuotedPath(projectPath);
		buildDirPath = utils.getQuotedPath(buildDirPath);

		// Right now SystemDacpacsLocation and NETCoreTargetsPath get set to the same thing, but separating them out for if we move
		// the system dacpacs somewhere else and also so that the variable name makes more sense if building from the commandline,
		// since SDK style projects don't to specify the targets path, just where the system dacpacs are
		if (utils.getAzdataApi()) {
			if (sqlProjStyle === mssql.ProjectType.SdkStyle) {
				return ` build ${projectPath} /p:NetCoreBuild=true /p:SystemDacpacsLocation=${buildDirPath}`;
			} else {
				return ` build ${projectPath} /p:NetCoreBuild=true /p:NETCoreTargetsPath=${buildDirPath} /p:SystemDacpacsLocation=${buildDirPath}`;
			}
		} else {
			if (sqlProjStyle === vscodeMssql.ProjectType.SdkStyle) {
				return ` build ${projectPath} /p:NetCoreBuild=true /p:SystemDacpacsLocation=${buildDirPath}`;
			} else {
				return ` build ${projectPath} /p:NetCoreBuild=true /p:NETCoreTargetsPath=${buildDirPath} /p:SystemDacpacsLocation=${buildDirPath}`;
			}
		}
	}
}

