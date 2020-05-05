/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../common/constants';
import * as dataSources from '../models/dataSources/dataSources';
import * as utils from '../common/utils';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as templates from '../templates/templates';

import { Project } from '../models/project';
import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';
import { promises as fs } from 'fs';
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


	public refreshProjectsTree() {
		this.projectTreeViewProvider.load(this.projects);
	}

	public async openProject(projectFile: vscode.Uri): Promise<Project> {
		for (const proj of this.projects) {
			if (proj.projectFilePath === projectFile.fsPath) {
				vscode.window.showInformationMessage(constants.projectAlreadyOpened(projectFile.fsPath));
				return proj;
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
				console.log(`No ${constants.dataSourcesFileName} file found.`);
			}
			else {
				throw err;
			}
		}

		this.refreshProjectsTree();

		return newProject;
	}

	public async createNewProject(newProjName: string, folderUri: vscode.Uri, projectGuid?: string): Promise<string> {
		if (projectGuid && !UUID.isUUID(projectGuid)) {
			throw new Error(`Specified GUID is invalid: '${projectGuid}'`);
		}

		const macroDict: Record<string, string> = {
			'PROJECT_NAME': newProjName,
			'PROJECT_GUID': projectGuid ?? UUID.generateUuid().toUpperCase()
		};

		let newProjFileContents = this.macroExpansion(templates.newSqlProjectTemplate, macroDict);

		let newProjFileName = newProjName;

		if (!newProjFileName.toLowerCase().endsWith(constants.sqlprojExtension)) {
			newProjFileName += constants.sqlprojExtension;
		}

		const newProjFilePath = path.join(folderUri.fsPath, newProjFileName);

		let fileExists = false;
		try {
			await fs.access(newProjFilePath);
			fileExists = true;
		}
		catch { } // file doesn't already exist

		if (fileExists) {
			throw new Error(constants.projectAlreadyExists(newProjFileName, folderUri.fsPath));
		}

		await fs.mkdir(path.dirname(newProjFilePath), { recursive: true });
		await fs.writeFile(newProjFilePath, newProjFileContents);

		return newProjFilePath;
	}

	public closeProject(treeNode: BaseProjectTreeItem) {
		const project = this.getProjectContextFromTreeNode(treeNode);
		this.projects = this.projects.filter((e) => { return e !== project; });
		this.refreshProjectsTree();
	}

	public async build(treeNode: BaseProjectTreeItem) {
		const project = this.getProjectContextFromTreeNode(treeNode);
		await vscode.window.showErrorMessage(`Build not yet implemented: ${project.projectFilePath}`); // TODO
	}

	public async deploy(treeNode: BaseProjectTreeItem) {
		const project = this.getProjectContextFromTreeNode(treeNode);
		await vscode.window.showErrorMessage(`Deploy not yet implemented: ${project.projectFilePath}`); // TODO
	}

	public async import(treeNode: BaseProjectTreeItem) {
		const project = this.getProjectContextFromTreeNode(treeNode);
		await vscode.window.showErrorMessage(`Import not yet implemented: ${project.projectFilePath}`); // TODO
	}

	public async addFolderPrompt(treeNode: BaseProjectTreeItem) {
		const project = this.getProjectContextFromTreeNode(treeNode);
		const newFolderName = await this.promptForNewObjectName(new templates.ProjectScriptType(templates.folder, constants.folderFriendlyName, ''), project);

		if (!newFolderName) {
			return; // user cancelled
		}

		const relativeFolderPath = this.prependContextPath(treeNode, newFolderName);

		await project.addFolderItem(relativeFolderPath);

		this.refreshProjectsTree();
	}

	public async addItemPrompt(treeNode: BaseProjectTreeItem, itemTypeName?: string) {
		const project = this.getProjectContextFromTreeNode(treeNode);

		if (!itemTypeName) {
			let itemFriendlyNames: string[] = [];

			for (const itemType of templates.projectScriptTypes()) {
				itemFriendlyNames.push(itemType.friendlyName);
			}

			itemTypeName = await vscode.window.showQuickPick(itemFriendlyNames, {
				canPickMany: false
			});

			if (!itemTypeName) {
				return; // user cancelled
			}
		}

		const itemType = templates.projectScriptTypeMap()[itemTypeName.toLocaleLowerCase()];
		const itemObjectName = await this.promptForNewObjectName(itemType, project);

		if (!itemObjectName) {
			return; // user cancelled
		}

		// TODO: file already exists?

		const newFileText = this.macroExpansion(itemType.templateScript, { 'OBJECT_NAME': itemObjectName });
		const relativeFilePath = this.prependContextPath(treeNode, itemObjectName + '.sql');

		const newEntry = await project.addScriptItem(relativeFilePath, newFileText);

		vscode.commands.executeCommand('vscode.open', newEntry.fsUri);

		this.refreshProjectsTree();
	}

	//#region Helper methods

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

	private getProjectContextFromTreeNode(treeNode: BaseProjectTreeItem): Project {
		if (!treeNode) {
			// TODO: prompt for which (currently-open) project when invoked via command pallet
			throw new Error('TODO: prompt for which project when invoked via command pallet');
		}

		if (treeNode.root instanceof ProjectRootTreeItem) {
			return (treeNode.root as ProjectRootTreeItem).project;
		}
		else {
			throw new Error('Unable to establish project context.  Command invoked from unexpected location: ' + treeNode.uri.path);
		}
	}

	private async promptForNewObjectName(itemType: templates.ProjectScriptType, _project: Project): Promise<string | undefined> {
		// TODO: ask project for suggested name that doesn't conflict
		const suggestedName = itemType.friendlyName.replace(new RegExp('\s', 'g'), '') + '1';

		const itemObjectName = await vscode.window.showInputBox({
			prompt: constants.newObjectNamePrompt(itemType.friendlyName),
			value: suggestedName,
		});

		return itemObjectName;
	}

	private prependContextPath(treeNode: BaseProjectTreeItem, objectName: string): string {
		if (treeNode instanceof FolderNode) {
			return path.join(utils.trimUri(treeNode.root.uri, treeNode.uri), objectName);
		}
		else {
			return objectName;
		}
	}

	//#endregion
}
