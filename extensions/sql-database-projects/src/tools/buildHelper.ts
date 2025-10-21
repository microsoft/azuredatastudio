/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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

		const dacFxDllsExist = await this.ensureDacFxDllsPresence(outputChannel);
		const scriptDomExists = await this.ensureScriptDomDllPresence(outputChannel);

		if (!dacFxDllsExist || !scriptDomExists) {
			return false;
		}

		this.initialized = true;
		return true;
	}

	public async ensureDacFxDllsPresence(outputChannel: vscode.OutputChannel): Promise<boolean> {
		const sdkName = 'Microsoft.Build.Sql';
		const microsoftBuildSqlDefaultVersion = '2.0.0'; // default version of Microsoft.Build.Sql nuget to use for building legacy style projects, update in README when updating this

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

		// check if the settings has a version specified for Microsoft.Build.Sql, otherwise use default
		const microsoftBuildSqlVersionConfig = vscode.workspace.getConfiguration(DBProjectConfigurationKey)[constants.microsoftBuildSqlVersionKey];
		const sdkVersion = !!microsoftBuildSqlVersionConfig ? microsoftBuildSqlVersionConfig : microsoftBuildSqlDefaultVersion;

		const microsoftBuildSqlDllLocation = path.join('tools', 'net8.0');
		return this.ensureNugetAndFilesPresence(sdkName, sdkVersion, dacFxBuildFiles, microsoftBuildSqlDllLocation, outputChannel);
	}

	public async ensureScriptDomDllPresence(outputChannel: vscode.OutputChannel): Promise<boolean> {
		const scriptdomNugetPkgName = 'Microsoft.SqlServer.TransactSql.ScriptDom';
		const scriptDomDll = 'Microsoft.SqlServer.TransactSql.ScriptDom.dll';
		const scriptDomNugetVersion = '170.128.0'; // TODO: make this a configurable setting, like the Microsoft.Build.Sql version
		const scriptDomDllLocation = path.join('lib', 'netstandard2.1');

		return this.ensureNugetAndFilesPresence(scriptdomNugetPkgName, scriptDomNugetVersion, [scriptDomDll], scriptDomDllLocation, outputChannel);
	}

	/**
	 * Ensures a nuget package and expected files exist in the BuildDirectory
	 * @param nugetName Name of the nuget package
	 * @param nugetVersion versiion of the nuget files
	 * @param expectedFiles array of expected files from the nuget in the BuildDirectory
	 * @param nugetFolderWithExpectedfiles folder in the nuget containing the expected files
	 * @param outputChannel
	 * @returns true if expected files exist in the BuildDirectory
	 */
	public async ensureNugetAndFilesPresence(nugetName: string, nugetVersion: string, expectedFiles: string[], nugetFolderWithExpectedfiles: string, outputChannel: vscode.OutputChannel): Promise<boolean> {
		let missingNuget = false;

		const fullNugetName = `${nugetName}.${nugetVersion}`;
		const fullNugetPath = path.join(this.extensionBuildDir, `${fullNugetName}.nupkg`);

		// check if the correct nuget version has been previously downloaded before checking if the files exist.
		// TODO: handle when multiple nugets are in the BuildDirectory and a user wants to switch back to an older one - probably should
		// remove other versions of this nuget when a new one is downloaded
		if (await utils.exists(fullNugetPath)) {
			// if it does exist, make sure all the necessary files are also in the BuildDirectory
			for (const fileName of expectedFiles) {
				if (!await (utils.exists(path.join(this.extensionBuildDir, fileName)))) {
					missingNuget = true;
					break;
				}
			}
		} else {
			// if the nuget isn't there, it needs to be downloaded and the build dlls extracted
			missingNuget = true;
		}

		if (!missingNuget) {
			return true;
		}

		outputChannel.appendLine(constants.downloadingNuget(fullNugetName));

		const nugetUrl = `https://www.nuget.org/api/v2/package/${nugetName}/${nugetVersion}`;
		const extractedFolderPath = path.join(this.extensionDir, buildDirectory, nugetName);

		try {
			await this.downloadAndExtractNuget(nugetUrl, fullNugetPath, extractedFolderPath, outputChannel);
		} catch (e) {
			void vscode.window.showErrorMessage(e);
			return false;
		}

		// copy the dlls and targets file to the BuildDirectory folder
		const buildfilesPath = path.join(extractedFolderPath, nugetFolderWithExpectedfiles);

		for (const fileName of expectedFiles) {
			if (await (utils.exists(path.join(buildfilesPath, fileName)))) {
				await fs.copyFile(path.join(buildfilesPath, fileName), path.join(this.extensionBuildDir, fileName));
			}
		}

		// cleanup extracted folder
		await fs.rm(extractedFolderPath, { recursive: true });

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

	/**
	 * Constructs the build arguments for building a sqlproj file
	 * @param buildDirPath The path to the build directory where the dlls and targets are located
	 * @param sqlProjStyle The type of the sqlproj project (LegacyStyle or SdkStyle)
	 * @returns An array of arguments to be used for building the sqlproj file
	 */
	public constructBuildArguments(buildDirPath: string, sqlProjStyle: ProjectType): string[] {
		buildDirPath = utils.getQuotedPath(buildDirPath);
		const args: string[] = [
			'/p:NetCoreBuild=true',
			`/p:SystemDacpacsLocation=${buildDirPath}`
		];

		// Adding NETCoreTargetsPath only for non-SDK style projects
		const isSdkStyle = utils.getAzdataApi()
			? sqlProjStyle === mssql.ProjectType.SdkStyle
			: sqlProjStyle === vscodeMssql.ProjectType.SdkStyle;

		if (!isSdkStyle) {
			args.push(`/p:NETCoreTargetsPath=${buildDirPath}`);
		}

		return args;
	}
}

