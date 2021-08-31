/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as utils from '../common/utils';
import * as aFUtils from '../common/azureFunctionsUtils';
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
			const project = await aFUtils.getAFProjectContainingFile(filePath);

			// if no AF projects were found, an error gets thrown from getAFProjectContainingFile(). This check is temporary until
			// multiple AF projects in the workspace is handled. That scenario returns undefined and shows an info message telling the
			// user to make sure their project has the package reference
			if (project) {
				await this.addPackage(project, packageName, packageVersion);
			} else {
				void vscode.window.showInformationMessage(`To use SQL bindings, ensure your Azure Functions project has a reference to ${constants.sqlExtensionPackageName}`);
			}
		} catch (e) {
			void vscode.window.showErrorMessage(e.message);
		}
	}
}

