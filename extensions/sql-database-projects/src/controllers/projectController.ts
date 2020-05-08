/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as path from 'path';
import * as constants from '../common/constants';
import * as dataSources from '../models/dataSources/dataSources';
import * as utils from '../common/utils';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as templates from '../templates/templates';
import * as mssql from '../../../mssql';

import { Uri, QuickPickItem, WorkspaceFolder, extensions } from 'vscode';
import { ApiWrapper } from '../common/apiWrapper';
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

	constructor(private apiWrapper: ApiWrapper, projTreeViewProvider: SqlDatabaseProjectTreeViewProvider) {
		this.projectTreeViewProvider = projTreeViewProvider;
	}


	public refreshProjectsTree() {
		this.projectTreeViewProvider.load(this.projects);
	}

	public async openProject(projectFile: Uri): Promise<Project> {
		for (const proj of this.projects) {
			if (proj.projectFilePath === projectFile.fsPath) {
				this.apiWrapper.showInformationMessage(constants.projectAlreadyOpened(projectFile.fsPath));
				return proj;
			}
		}

		const newProject = new Project(projectFile.fsPath, this.apiWrapper);

		try {
			// Read project file
			await newProject.readProjFile();
			this.projects.push(newProject);

			// Read datasources.json (if present)
			const dataSourcesFilePath = path.join(path.dirname(projectFile.fsPath), constants.dataSourcesFileName);

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

		return newProject;
	}

	public async createNewProject(newProjName: string, folderUri: Uri, projectGuid?: string): Promise<string> {
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
		await this.apiWrapper.showErrorMessage(`Build not yet implemented: ${project.projectFilePath}`); // TODO
	}

	public async deploy(treeNode: BaseProjectTreeItem) {
		const project = this.getProjectContextFromTreeNode(treeNode);
		await this.apiWrapper.showErrorMessage(`Deploy not yet implemented: ${project.projectFilePath}`); // TODO
	}

	public async import(treeNode: BaseProjectTreeItem) {
		const project = this.getProjectContextFromTreeNode(treeNode);
		await this.apiWrapper.showErrorMessage(`Import not yet implemented: ${project.projectFilePath}`); // TODO
	}

	public async addFolderPrompt(treeNode: BaseProjectTreeItem) {
		const project = this.getProjectContextFromTreeNode(treeNode);
		const newFolderName = await this.promptForNewObjectName(new templates.ProjectScriptType(templates.folder, constants.folderFriendlyName, ''), project);

		if (!newFolderName) {
			return; // user cancelled
		}

		const relativeFolderPath = path.join(this.getRelativePath(treeNode), newFolderName);

		await project.addFolderItem(relativeFolderPath);

		this.refreshProjectsTree();
	}

	public async addItemPromptFromNode(treeNode: BaseProjectTreeItem, itemTypeName?: string) {
		await this.addItemPrompt(this.getProjectContextFromTreeNode(treeNode), this.getRelativePath(treeNode), itemTypeName);
	}

	public async addItemPrompt(project: Project, relativePath: string, itemTypeName?: string) {
		if (!itemTypeName) {
			const items: QuickPickItem[] = [];

			for (const itemType of templates.projectScriptTypes()) {
				items.push({ label: itemType.friendlyName });
			}

			itemTypeName = (await this.apiWrapper.showQuickPick(items, {
				canPickMany: false
			}))?.label;

			if (!itemTypeName) {
				return; // user cancelled
			}
		}

		const itemType = templates.projectScriptTypeMap()[itemTypeName.toLocaleLowerCase()];
		let itemObjectName = await this.promptForNewObjectName(itemType, project);

		itemObjectName = itemObjectName?.trim();

		if (!itemObjectName) {
			return; // user cancelled
		}

		// TODO: file already exists?

		const newFileText = this.macroExpansion(itemType.templateScript, { 'OBJECT_NAME': itemObjectName });
		const relativeFilePath = path.join(relativePath, itemObjectName + '.sql');

		const newEntry = await project.addScriptItem(relativeFilePath, newFileText);

		this.apiWrapper.executeCommand('vscode.open', newEntry.fsUri);

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

		const itemObjectName = await this.apiWrapper.showInputBox({
			prompt: constants.newObjectNamePrompt(itemType.friendlyName),
			value: suggestedName,
		});

		return itemObjectName;
	}

	private getRelativePath(treeNode: BaseProjectTreeItem): string {
		return treeNode instanceof FolderNode ? utils.trimUri(treeNode.root.uri, treeNode.uri) : '';
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
			let newProjName = await this.apiWrapper.showInputBox({
				prompt: constants.newDatabaseProjectName,
				value: `DatabaseProject${model.database}`
			});

			if (!newProjName) {
				this.apiWrapper.showErrorMessage(constants.projectNameRequired);
				return;
			}
			model.projName = newProjName;

			// Get extractTarget
			// eslint-disable-next-line code-no-unexternalized-strings
			let extractTargetOptions: string[] = Object.keys(azdata.ExtractTarget).filter(k => typeof azdata.ExtractTarget[k as any] === "number");
			let extractTargetInput = await this.apiWrapper.showQuickPickString(extractTargetOptions.slice(1), {
				canPickMany: false,
				placeHolder: constants.extractTargetInput
			});
			let extractTarget: azdata.ExtractTarget;
			if (!extractTargetInput) {
				// TODO: Default value of SchemaObjectType to be used or cancel out?
				this.apiWrapper.showErrorMessage(constants.extractTargetDefault);
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
				selectionResult = await this.apiWrapper.showOpenDialog({
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
					openLabel: constants.selectFileFolder,
					defaultUri: this.apiWrapper.workspaceFolders() ? (this.apiWrapper.workspaceFolders() as WorkspaceFolder[])[0].uri : undefined
				});
				newProjUri = (selectionResult as Uri[])[0];
				newProjFolderUri = newProjUri;
			} else {
				// Get filename
				selectionResult = await this.apiWrapper.showSaveDialog(
					{
						defaultUri: this.apiWrapper.workspaceFolders() ? (this.apiWrapper.workspaceFolders() as WorkspaceFolder[])[0].uri : undefined,
						saveLabel: constants.selectFileFolder,
						filters: {
							'Text files': ['sql'],
							'All files': ['*']
						}
					}
				);
				newProjUri = selectionResult as unknown as Uri;
				newProjFolderUri = utils.trimFileName(newProjUri);
			}
			if (!selectionResult) {
				this.apiWrapper.showErrorMessage(constants.projectLocationRequired);
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
			const newProjFilePath = await this.createNewProject(newProjName as string, newProjFolderUri as Uri);
			const project = await this.openProject(Uri.file(newProjFilePath));

			//Create a list of all the files and directories to be added to project
			let fileFolderList: string[] = await this.generateList(model.filePath);

			// Add generated file structure to the project
			await project.addToProject(fileFolderList);

			//Refresh project to show the added files
			this.refreshProjectsTree();
		}
		catch (err) {
			this.apiWrapper.showErrorMessage(utils.getErrorMessage(err));
		}
	}

	private async importApiCall(model: ImportDataModel): Promise<void> {
		let ext = extensions.getExtension(mssql.extension.name);

		if (ext === undefined) {
			this.apiWrapper.showErrorMessage('VSCode extension undefined');
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
				await this.apiWrapper.showErrorMessage(constants.cannotResolvePath(absolutePath));
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
