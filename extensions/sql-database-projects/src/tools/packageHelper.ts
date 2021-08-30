/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import * as utils from '../common/utils';
import * as constants from '../common/constants';
import { DotNetCommandOptions, NetCoreTool } from './netcoreTool';

export class PackageHelper {
	private netCoreTool: NetCoreTool;

	constructor(outputChannel: vscode.OutputChannel) {
		this.netCoreTool = new NetCoreTool(outputChannel);
	}

	/**
	 * Constructs the parameters for a dotnet add package
	 * @param projectPath full path to project to add package to
	 * @param packageName name of package
	 * @param packageVersion optional version of package. If none, latest will be pulled in
	 * @returns string constructed with the arguments for dotnet add package
	 */
	public constructAddPackageArguments(projectPath: string, packageName: string, packageVersion?: string): string {
		projectPath = utils.getQuotedPath(projectPath);
		if (packageVersion) {
			return ` add ${projectPath} package ${packageName} -v ${packageVersion}`;
		} else {
			// pull in the latest version of the package and allow prerelease versions
			return ` add ${projectPath} package ${packageName} --prerelease`;
		}
	}

	/**
	 * Runs dotnet add package to add a package reference to the specified project. If the project already has a package reference
	 * for this package version, the project file won't get updated
	 * @param projectPath full path to project to add package to
	 * @param packageName name of package
	 * @param packageVersion optional version of package. If none, latest will be pulled in
	 */
	public async addPackage(project: string, packageName: string, packageVersion?: string): Promise<void> {
		const addOptions: DotNetCommandOptions = {
			commandTitle: constants.addPackage,
			argument: this.constructAddPackageArguments(project, packageName, packageVersion)
		};

		await this.netCoreTool.runDotnetCommand(addOptions);
	}

	/**
	 * Adds specified package to Azure Functions project the specified file is a part of
	 * @param filePath full path to file to find the containing AF project of to add package reference to
	 * @param packageName package to add reference to
	 * @param packageVersion optional version of package. If none, latest will be pulled in
	 */
	public async addPackageToAFProjectContainingFile(filePath: string, packageName: string, packageVersion?: string): Promise<void> {
		try {
			const project = await this.getAFProjectContainingFile(filePath);

			// if no AF projects were found, an error gets thrown from getAFProjectContainingFile(). This check is temporary until
			// multiple AF projects in the workspace is handled. That scenario returns undefined and shows an info message telling the
			// user to make sure their project has the package reference
			if (project) {
				await this.addPackage(project, packageName, packageVersion);
			}
		} catch (e) {
			vscode.window.showErrorMessage(e.message);
		}
	}

	/**
	 * Gets the Azure Functions project that contains the given file
	 * @param filePath file that the containing project needs to be found for
	 * @returns filepath of project or undefined if project couldn't be found
	 */
	public async getAFProjectContainingFile(filePath: string): Promise<string | undefined> {
		// get functions csprojs in the workspace
		const projectPromises = vscode.workspace.workspaceFolders?.map(f => utils.getAllProjectsInFolder(f.uri, '.csproj')) ?? [];
		const functionsProjects = (await Promise.all(projectPromises)).reduce((prev, curr) => prev.concat(curr), []).filter(p => this.isFunctionProject(path.dirname(p.fsPath)));

		// look for project folder containing file if there's more than one
		if (functionsProjects.length > 1) {
			// TODO: figure out which project contains the file
			// the new style csproj doesn't list all the files in the project anymore, unless the file isn't in the same folder
			// so we can't rely on using that to check
			vscode.window.showInformationMessage(`To use SQL bindings, ensure your Azure Functions project has a reference to ${constants.sqlExtensionPackageName}`);
			console.error('need to find which project contains the file ' + filePath);
			return undefined;
		} else if (functionsProjects.length === 0) {
			throw new Error(constants.noAzureFunctionsProjectsInWorkspace);
		} else {
			return functionsProjects[0].fsPath;
		}
	}

	// Use 'host.json' as an indicator that this is a functions project
	// copied from verifyIsproject.ts in vscode-azurefunctions extension
	async isFunctionProject(folderPath: string): Promise<boolean> {
		return await fse.pathExists(path.join(folderPath, constants.hostFileName));
	}
}

