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
import * as azdata from 'azdata';
import * as mssql from '../../../mssql';

import { Project } from '../models/project';
import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';
import { promises as fs } from 'fs';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';
import { FolderNode } from '../models/tree/fileFolderTreeItem';
import { ImportDataModel } from '../models/api/import';

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
			throw new Error('"Add item" command invoked from unexpected location: ' + treeNode.uri.path);
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

	/**
	 * Imports a new SQL database project from the existing database,
	 * prompting the user for a name, file path location and extract target
	 */
	public async importNewDatabaseProject(context: any): Promise<void> {
		let model = <ImportDataModel>{};

		try {
			let profile = context ? <azdata.IConnectionProfile>context.connectionProfile : undefined;
			if (profile) {
				model.serverId = profile.id;
				model.database = profile.databaseName;
			}

			// Get project name
			let newProjName = await vscode.window.showInputBox({
				prompt: constants.newDatabaseProjectName,
				value: `DatabaseProject${model.database}`
			});

			if (!newProjName) {
				vscode.window.showErrorMessage(constants.projectNameRequired);
				return;
			}
			model.projName = newProjName;

			// Get extractTarget
			// eslint-disable-next-line code-no-unexternalized-strings
			let extractTargetOptions: string[] = Object.keys(azdata.ExtractTarget).filter(k => typeof azdata.ExtractTarget[k as any] === "number");
			let extractTargetInput = await vscode.window.showQuickPick(extractTargetOptions.slice(1), {
				canPickMany: false,
				placeHolder: constants.extractTargetInput
			});
			let extractTarget: azdata.ExtractTarget;
			if (!extractTargetInput) {
				// TODO: Default value of SchemaObjectType to be used or cancel out?
				vscode.window.showErrorMessage(constants.extractTargetDefault);
				extractTarget = azdata.ExtractTarget.SchemaObjectType;
			} else {
				extractTarget = azdata.ExtractTarget[extractTargetInput as keyof typeof azdata.ExtractTarget];
			}
			model.extractTarget = extractTarget;

			// Get folder location for project creation
			let selectionResult;
			let newProjFolderUri;
			let newProjUri;
			if (extractTarget !== 1) {
				selectionResult = await vscode.window.showOpenDialog({
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
					openLabel: constants.selectFileFolder,
					defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined
				});
				newProjUri = (selectionResult as vscode.Uri[])[0];
				newProjFolderUri = newProjUri;
			} else {
				// Get filename
				selectionResult = await vscode.window.showSaveDialog(
					{
						defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined,
						saveLabel: constants.selectFileFolder,
						filters: {
							'Text files': ['sql'],
							'All files': ['*']
						}
					}
				);
				newProjUri = selectionResult as vscode.Uri;
				newProjFolderUri = utils.trimFileName(newProjUri);
			}
			if (!selectionResult) {
				vscode.window.showErrorMessage(constants.projectLocationRequired);
				return;
			}

			// TODO: what if the selected folder is outside the workspace?
			console.log(newProjUri.fsPath);
			model.filePath = newProjUri.fsPath;

			//Set model version
			model.version = '1.0.0.0';

			// Call ExtractAPI in DacFx Service
			await this.importApiCall(model);
			// TODO: Check for success

			// Create and open new project
			const newProjFilePath = await this.createNewProject(newProjName as string, newProjFolderUri as vscode.Uri);
			const project = await this.openProject(vscode.Uri.file(newProjFilePath));

			//Create a list of all the files and directories to be added to project
			let fileFolderList: string[] = await this.generateList(model.filePath);

			// Add generated file structure to the project
			await project.addToProject(fileFolderList);

			//Refresh project to show the added files
			this.refreshProjectsTree();
		}
		catch (err) {
			vscode.window.showErrorMessage(utils.getErrorMessage(err));
		}
	}

	private async importApiCall(model: ImportDataModel): Promise<void> {
		let ext = vscode.extensions.getExtension(mssql.extension.name);

		if (ext === undefined) {
			vscode.window.showErrorMessage('VSCode extension undefined');
			return;
		}

		const service = (ext.exports as mssql.IExtension).dacFx;
		const ownerUri = await azdata.connection.getUriForConnection(model.serverId);

		await service.importDatabaseProject(model.database, model.filePath, model.projName, model.version, ownerUri, model.extractTarget, azdata.TaskExecutionMode.execute);
	}

	private async generateList(absolutePath: string): Promise<string[]> {
		let fileFolderList: string[] = [];

		if (!utils.exists(absolutePath)) {
			if (utils.exists(absolutePath + constants.sqlFileExtension)) {
				absolutePath += constants.sqlFileExtension;
			} else {
				await vscode.window.showErrorMessage(constants.cannotResolvePath(absolutePath));
				return fileFolderList;
			}
		}

		const files = [absolutePath];
		do {
			const filepath = files.pop();

			if (filepath) {
				const stat = await fs.stat(filepath);

				if (stat.isDirectory()) {
					fileFolderList.push(filepath);
					(await fs
						.readdir(filepath))
						.forEach((f: string) => files.push(path.join(filepath, f)));
				}
				else if (stat.isFile()) {
					fileFolderList.push(filepath);
				}
			}

		} while (files.length !== 0);

		return fileFolderList;
	}

	//#endregion
}
