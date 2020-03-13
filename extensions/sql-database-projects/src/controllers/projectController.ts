/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../common/constants';
import * as dataSources from '../models/dataSources/dataSources';


import { Project } from '../models/project';
import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';
import { promises as fs } from 'fs';
import { newSqlProjectTemplate } from '../templates/newSqlProjTemplate';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';

/**
 * Controller for managing project lifecycle
 */
export class ProjectsController {
	private projectTreeViewProvider: SqlDatabaseProjectTreeViewProvider;

	projects: Project[] = [];

	constructor(projTreeViewProvider: SqlDatabaseProjectTreeViewProvider) {
		this.projectTreeViewProvider = projTreeViewProvider;
	}

	public async openProject(projectFile: vscode.Uri) {
		for (const proj of this.projects) {
			if (proj.projectFile === projectFile.fsPath) {
				vscode.window.showInformationMessage(`Project '${projectFile.fsPath}' is already opened.`);
				return;
			}
		}

		// Read project file
		const newProject = new Project(projectFile.fsPath);
		await newProject.readProjFile();
		this.projects.push(newProject);

		// Read datasources.json (if present)
		const dataSourcesFilePath = path.join(path.dirname(projectFile.fsPath), constants.dataSourcesFileName);

		try {
			newProject.dataSources = await dataSources.load(dataSourcesFilePath);
		}
		catch (err) {
			if (err instanceof dataSources.NoDataSourcesFileError) {
				// TODO: prompt to create new datasources.json; for now, swallow
			}
			else {
				throw err;
			}
		}

		this.refreshProjectsTree();
	}

	public async createNewProject(newProjName: string, newProjUri: vscode.Uri) {
		const macroIndicator = '@@';

		const macroDict: Record<string, string> = {
			'PROJECT_NAME': newProjName,
			'PROJECT_GUID': '00000000-0000-0000-0000-000000000000'//Guid.create().toString() // TODO: extension building problems when using this library?
		};

		let newProjFileContents = newSqlProjectTemplate;

		for (const macro in macroDict) {

			// check if value contains the macroIndicator, which could break expansion for successive macros
			if (macroDict[macro].includes(macroIndicator)) {
				throw new Error(`New Project value ${macroDict[macro]} is invalid because it contains ${macroIndicator}`);
			}

			newProjFileContents = newProjFileContents.replace(new RegExp(macroIndicator + macro + macroIndicator, 'g'), macroDict[macro]);
		}

		let newProjFileName = newProjName;

		if (!newProjFileName.toLowerCase().endsWith(constants.sqlprojExtension)) {
			newProjFileName += constants.sqlprojExtension;
		}

		const newProjFilePath = path.join(newProjUri.fsPath, newProjFileName);

		if (fs.access(newProjFilePath)) {
			throw new Error(`A project named ${newProjFileName} already exists in ${newProjUri.fsPath}.`);
		}

		fs.writeFile(newProjFilePath, newProjFileContents);
		this.openProject(vscode.Uri.file(newProjFilePath));
	}

	public closeProject(arg: any) {
		if (!(arg instanceof BaseProjectTreeItem)) {
			// TODO: if this really does have to show up in the command palette, what's the expected behavior?
			// Prompt for project name as input, or silently exit the flow?
			return;
		}

		let rootNode = (arg as BaseProjectTreeItem).root;

		if (rootNode instanceof ProjectRootTreeItem) {
			this.projects = this.projects.filter((e) => { return e !== (rootNode as ProjectRootTreeItem).project; });
			this.refreshProjectsTree();
		}
	}

	public addItem(itemType: string, itemObjectName: string) {
		vscode.window.showInformationMessage(`creating new ${itemType} called ${itemObjectName}`);
	}

	public refreshProjectsTree() {
		this.projectTreeViewProvider.load(this.projects);
	}
}
