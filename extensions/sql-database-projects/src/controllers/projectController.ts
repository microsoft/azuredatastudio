/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../common/constants';
import * as dataSources from '../models/dataSources/dataSources';
import * as templateMap from '../templates/templateMap';
import * as utils from '../common/utils';

import { Project } from '../models/project';
import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';
import { promises as fs } from 'fs';
import { newSqlProjectTemplate } from '../templates/newSqlProjTemplate';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';
import { FolderNode } from '../models/tree/fileFolderTreeItem';

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
			if (proj.projectFilePath === projectFile.fsPath) {
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
		const macroDict: Record<string, string> = {
			'PROJECT_NAME': newProjName,
			'PROJECT_GUID': '00000000-0000-0000-0000-000000000000'//Guid.create().toString() // TODO: extension building problems when using this library?
		};

		let newProjFileContents = this.macroExpansion(newSqlProjectTemplate, macroDict);

		let newProjFileName = newProjName;

		if (!newProjFileName.toLowerCase().endsWith(constants.sqlprojExtension)) {
			newProjFileName += constants.sqlprojExtension;
		}

		const newProjFilePath = path.join(newProjUri.fsPath, newProjFileName);

		try {
			await fs.access(newProjFilePath);
			throw new Error(`A project named ${newProjFileName} already exists in ${newProjUri.fsPath}.`);
		}
		catch { } // file doesn't already exist

		await fs.writeFile(newProjFilePath, newProjFileContents);
		this.openProject(vscode.Uri.file(newProjFilePath));
	}

	public closeProject(treeNode: BaseProjectTreeItem) {
		const project = this.getProjectFromTreeNode(treeNode);
		this.projects = this.projects.filter((e) => { return e !== project; });
		this.refreshProjectsTree();
	}

	private getProjectFromTreeNode(treeNode: BaseProjectTreeItem): Project | undefined {
		if (treeNode.root instanceof ProjectRootTreeItem) {
			return (treeNode.root as ProjectRootTreeItem).project;
		}
		else {
			return undefined;
		}
	}

	public async addItemPrompt(treeNode: BaseProjectTreeItem, itemTypeName?: string) {
		if (!treeNode) {
			// TODO: prompt for which (currently-open) project when invoked via command pallet
			return;
		}

		const project = this.getProjectFromTreeNode(treeNode);

		if (!project) {
			throw new Error('"Add item" command invoked from unexpected location: ' + treeNode.uri.path);
		}

		if (!itemTypeName) {
			let itemFriendlyNames: string[] = [];

			for (const itemType of templateMap.projectScriptTypes) {
				itemFriendlyNames.push(itemType.friendlyName);
			}

			itemTypeName = await vscode.window.showQuickPick(itemFriendlyNames, {
				canPickMany: false
			});

			if (!itemTypeName) {
				return; // user cancelled
			}
		}

		const itemType = templateMap.projectScriptTypeMap[itemTypeName.toLocaleLowerCase()];

		// TODO: ask project for suggested name that doesn't conflict
		const suggestedName = itemType.friendlyName.replace(new RegExp('\s', 'g'), '') + '1';

		const itemObjectName = await vscode.window.showInputBox({
			prompt: `New ${itemType.friendlyName} name:`,
			value: suggestedName,
		});

		if (!itemObjectName) {
			return; // user cancelled
		}

		// TODO: file already exists?

		const newFileText = this.macroExpansion(itemType.templateScript, { 'OBJECT_NAME': itemObjectName });

		let relativeFilePath = itemObjectName + '.sql';

		if (treeNode instanceof FolderNode) {
			relativeFilePath = path.join(utils.trimUri(treeNode.root.uri, treeNode.uri), relativeFilePath);
		}

		const newEntry = await project.addScriptItem(relativeFilePath, newFileText);

		vscode.commands.executeCommand('vscode.open', newEntry.fsUri);

		this.refreshProjectsTree();
	}

	private macroExpansion(template: string, macroDict: Record<string, string>): string {
		const macroIndicator = '@@';
		let output = template;

		for (const macro in macroDict) {
			// check if value contains the macroIndicator, which could break expansion for successive macros
			if (macroDict[macro].includes(macroIndicator)) {
				throw new Error(`Macro value ${macroDict[macro]} is invalid because it contains ${macroIndicator}`);
			}

			output = output.replace(new RegExp(macroIndicator + macro + macroIndicator, 'g'), macroDict[macro]);
		}

		return output;
	}

	public refreshProjectsTree() {
		this.projectTreeViewProvider.load(this.projects);
	}
}
