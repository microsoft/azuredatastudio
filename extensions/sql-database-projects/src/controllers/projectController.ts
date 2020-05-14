/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as constants from '../common/constants';
import * as dataSources from '../models/dataSources/dataSources';
import * as fs from 'fs';
import * as utils from '../common/utils';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as templates from '../templates/templates';

import { Uri, QuickPickItem } from 'vscode';
import { ApiWrapper } from '../common/apiWrapper';
import { Project } from '../models/project';
import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';
import { FolderNode } from '../models/tree/fileFolderTreeItem';
import { DeployDatabaseDialog } from '../dialogs/deployDatabaseDialog';
import { NetCoreTool, DotNetCommandOptions } from '../tools/netcoreTool';
import { BuildHelper } from '../tools/buildHelper';

/**
 * Controller for managing project lifecycle
 */
export class ProjectsController {
	private projectTreeViewProvider: SqlDatabaseProjectTreeViewProvider;
	private netCoreTool: NetCoreTool;
	private buildHelper: BuildHelper;

	projects: Project[] = [];

	constructor(private apiWrapper: ApiWrapper, projTreeViewProvider: SqlDatabaseProjectTreeViewProvider) {
		this.projectTreeViewProvider = projTreeViewProvider;
		this.netCoreTool = new NetCoreTool();
		this.buildHelper = new BuildHelper();
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

		const newProject = new Project(projectFile.fsPath);

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
			await fs.promises.access(newProjFilePath);
			fileExists = true;
		}
		catch { } // file doesn't already exist

		if (fileExists) {
			throw new Error(constants.projectAlreadyExists(newProjFileName, folderUri.fsPath));
		}

		await fs.promises.mkdir(path.dirname(newProjFilePath), { recursive: true });
		await fs.promises.writeFile(newProjFilePath, newProjFileContents);

		return newProjFilePath;
	}

	public closeProject(treeNode: BaseProjectTreeItem) {
		const project = this.getProjectContextFromTreeNode(treeNode);
		this.projects = this.projects.filter((e) => { return e !== project; });
		this.refreshProjectsTree();
	}

	public async buildProject(treeNode: BaseProjectTreeItem): Promise<void> {
		// Check mssql extension for project dlls (tracking issue #10273)
		await this.buildHelper.createBuildDirFolder();

		const project = this.getProjectContextFromTreeNode(treeNode);
		const options: DotNetCommandOptions = {
			commandTitle: 'Build',
			workingDirectory: project.projectFolderPath,
			argument: this.buildHelper.constructBuildArguments(project.projectFilePath, this.buildHelper.extensionBuildDirPath)
		};
		await this.netCoreTool.runDotnetCommand(options);
	}

	public deploy(treeNode: BaseProjectTreeItem): void {
		const project = this.getProjectContextFromTreeNode(treeNode);
		const deployDatabaseDialog = new DeployDatabaseDialog(this.apiWrapper, project);
		deployDatabaseDialog.openDialog();
	}

	public async schemaCompare(treeNode: BaseProjectTreeItem): Promise<void> {
		// check if schema compare extension is installed
		if (this.apiWrapper.getExtension(constants.schemaCompareExtensionId)) {
			// build project
			await this.buildProject(treeNode);

			// start schema compare with the dacpac produced from build
			const project = this.getProjectContextFromTreeNode(treeNode);
			const dacpacPath = path.join(project.projectFolderPath, 'bin', 'Debug', `${project.projectFileName}.dacpac`);

			// check that dacpac exists
			if (fs.existsSync(dacpacPath)) {
				this.apiWrapper.executeCommand('schemaCompare.start', dacpacPath);
			} else {
				this.apiWrapper.showErrorMessage(constants.buildDacpacNotFound);
			}
		} else {
			this.apiWrapper.showErrorMessage(constants.schemaCompareNotInstalled);
		}
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

	//#endregion
}
