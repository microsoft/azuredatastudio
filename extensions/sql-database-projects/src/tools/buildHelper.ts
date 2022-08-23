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
import { HttpClient } from '../common/httpClient';

const buildDirectory = 'BuildDirectory';
const sdkDirectory = 'Microsoft.Build.Sql';
const microsoftBuildSqlVersion = '0.1.3-preview';
const fullSdkName = `${sdkDirectory}.${microsoftBuildSqlVersion}`;

export class BuildHelper {

	private extensionDir: string;
	private extensionBuildDir: string;
	private extensionBuildFullPath: string;
	private initialized: boolean = false;

	constructor() {
		const extName = utils.getAzdataApi() ? sqldbproj.extension.name : sqldbproj.extension.vsCodeName;
		this.extensionDir = vscode.extensions.getExtension(extName)?.extensionPath ?? '';
		this.extensionBuildDir = path.join(this.extensionDir, buildDirectory);
		this.extensionBuildFullPath = path.join(this.extensionDir, buildDirectory, sdkDirectory, 'tools', 'netstandard2.1');

	}

	// create build dlls directory
	// this should not be required. temporary solution for issue #10273
	public async createBuildDirFolder(outputChannel?: vscode.OutputChannel): Promise<void> {

		if (this.initialized) {
			return;
		}

		if (!await utils.exists(this.extensionBuildDir)) {
			await fs.mkdir(this.extensionBuildDir);
		}

		const httpClient = new HttpClient();
		await httpClient.download('https://www.nuget.org/api/v2/package/Microsoft.Build.Sql/0.1.3-preview', path.join(this.extensionBuildDir, `${fullSdkName}.nupkg`), outputChannel);

		try {
			await extractZip(path.join(this.extensionDir, buildDirectory, `${fullSdkName}.nupkg`), { dir: path.join(this.extensionDir, buildDirectory, sdkDirectory) });
		} catch {

		}

		this.initialized = true;
	}

	public get extensionBuildDirPath(): string {
		return this.extensionBuildFullPath;
	}

	// TODO: fix this now that the paths are different for dacpacs and targets
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

