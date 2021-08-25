/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import * as glob from 'fast-glob';
import * as utils from '../common/utils';
import * as constants from '../common/constants';

export class InstallPackageHelper {

	constructor() { }

	public async getProjectContainingFile(filePath: string): Promise<string> {
		// get csprojs in the workspace
		const projectPromises = vscode.workspace.workspaceFolders?.map(f => this.getAllProjectsInFolder(f.uri, '.csproj')) ?? [];
		let projects = (await Promise.all(projectPromises)).reduce((prev, curr) => prev.concat(curr), []);

		// check if it's a functions project
		let functionsProjects = [];
		for (const p of projects) {
			if (this.isFunctionProject(path.dirname(p.fsPath))) {
				functionsProjects.push(p);
			}
		}

		// look for project folder containing file if there's more than one
		if (functionsProjects.length > 1) {
			// TODO:
			console.error('need to look for folder containing ' + filePath);
			throw new Error('uh oh more than one functions project :o');
		} else if (functionsProjects.length === 0) {
			// TODO
			throw new Error('uh oh no functions projects found in workspace');
		} else {
			return functionsProjects[0].fsPath;
		}
	}

	/**
	 * Gets all the projects of the specified extension in the folder
	 * @param folder
	 * @param projectExtension
	 * @returns
	 */
	async getAllProjectsInFolder(folder: vscode.Uri, projectExtension: string): Promise<vscode.Uri[]> {
		// path needs to use forward slashes for glob to work
		const escapedPath = glob.escapePath(folder.fsPath.replace(/\\/g, '/'));

		// filter for csproj
		const projFilter = path.posix.join(escapedPath, '**', `*${projectExtension}`);

		// glob will return an array of file paths with forward slashes, so they need to be converted back if on windows
		return (await glob(projFilter)).map(p => vscode.Uri.file(path.resolve(p)));
	}


	public constructListPackageArguments(projectPath: string): string {
		projectPath = utils.getQuotedPath(projectPath);
		return ` list ${projectPath} package`;
	}

	public constructAddPackageArguments(projectPath: string, packageName: string, packageVersion: string): string {
		projectPath = utils.getQuotedPath(projectPath);
		return ` add ${projectPath} package ${packageName} -v ${packageVersion}`;
	}

	// Use 'host.json' as an indicator that this is a functions project
	async isFunctionProject(folderPath: string): Promise<boolean> {
		return await fse.pathExists(path.join(folderPath, constants.hostFileName));
	}
}

