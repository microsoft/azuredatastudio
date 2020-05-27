/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from '../common/constants';
import * as dataSources from '../models/dataSources/dataSources';
import * as mssql from '../../../mssql';
import * as path from 'path';
import * as utils from '../common/utils';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as templates from '../templates/templates';

import { TaskExecutionMode } from 'azdata';
import { promises as fs } from 'fs';
import { Uri, QuickPickItem, extensions, Extension } from 'vscode';
import { ApiWrapper } from '../common/apiWrapper';
import { DeployDatabaseDialog } from '../dialogs/deployDatabaseDialog';
import { Project } from '../models/project';
import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';
import { FolderNode } from '../models/tree/fileFolderTreeItem';
import { IDeploymentProfile, IGenerateScriptProfile } from '../models/IDeploymentProfile';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';
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

			// Update for round tripping as needed
			await newProject.updateProjectForRoundTrip();

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
		const project = ProjectsController.getProjectFromContext(treeNode);
		this.projects = this.projects.filter((e) => { return e !== project; });
		this.refreshProjectsTree();
	}

	/**
	 * Builds a project, producing a dacpac
	 * @param treeNode a treeItem in a project's hierarchy, to be used to obtain a Project
	 * @returns path of the built dacpac
	 */
	public async buildProject(treeNode: BaseProjectTreeItem): Promise<string>;
	/**
	 * Builds a project, producing a dacpac
	 * @param project Project to be built
	 * @returns path of the built dacpac
	 */
	public async buildProject(project: Project): Promise<string>;
	public async buildProject(context: Project | BaseProjectTreeItem): Promise<string | undefined> {
		const project: Project = ProjectsController.getProjectFromContext(context);

		// Check mssql extension for project dlls (tracking issue #10273)
		await this.buildHelper.createBuildDirFolder();

		const options: DotNetCommandOptions = {
			commandTitle: 'Build',
			workingDirectory: project.projectFolderPath,
			argument: this.buildHelper.constructBuildArguments(project.projectFilePath, this.buildHelper.extensionBuildDirPath)
		};
		try {
			await this.netCoreTool.runDotnetCommand(options);

			return path.join(project.projectFolderPath, 'bin', 'Debug', `${project.projectFileName}.dacpac`);
		}
		catch (err) {
			this.apiWrapper.showErrorMessage(constants.projBuildFailed(utils.getErrorMessage(err)));
			return undefined;
		}
	}

	/**
	 * Builds and deploys a project
	 * @param treeNode a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public async deployProject(treeNode: BaseProjectTreeItem): Promise<DeployDatabaseDialog>;
	/**
	 * Builds and deploys a project
	 * @param project Project to be built and deployed
	 */
	public async deployProject(project: Project): Promise<DeployDatabaseDialog>;
	public async deployProject(context: Project | BaseProjectTreeItem): Promise<DeployDatabaseDialog> {
		const project: Project = ProjectsController.getProjectFromContext(context);
		let deployDatabaseDialog = this.getDeployDialog(project);

		deployDatabaseDialog.deploy = async (proj, prof) => await this.executionCallback(proj, prof);
		deployDatabaseDialog.generateScript = async (proj, prof) => await this.executionCallback(proj, prof);

		deployDatabaseDialog.openDialog();

		return deployDatabaseDialog;
	}

	public async executionCallback(project: Project, profile: IDeploymentProfile | IGenerateScriptProfile): Promise<mssql.DacFxResult | undefined> {
		const dacpacPath = await this.buildProject(project);

		if (!dacpacPath) {
			return undefined; // buildProject() handles displaying the error
		}

		const dacFxService = await ProjectsController.getDaxFxService();

		if (profile as IDeploymentProfile) {
			return await dacFxService.deployDacpac(dacpacPath, profile.databaseName, (<IDeploymentProfile>profile).upgradeExisting, profile.connectionUri, TaskExecutionMode.execute, profile.sqlCmdVariables);
		}
		else {
			return await dacFxService.generateDeployScript(dacpacPath, profile.databaseName, profile.connectionUri, TaskExecutionMode.execute, profile.sqlCmdVariables);
		}
	}

	public async schemaCompare(treeNode: BaseProjectTreeItem): Promise<void> {
		// check if schema compare extension is installed
		if (this.apiWrapper.getExtension(constants.schemaCompareExtensionId)) {
			// build project
			await this.buildProject(treeNode);

			// start schema compare with the dacpac produced from build
			const project = ProjectsController.getProjectFromContext(treeNode);
			const dacpacPath = path.join(project.projectFolderPath, 'bin', 'Debug', `${project.projectFileName}.dacpac`);

			// check that dacpac exists
			if (await utils.exists(dacpacPath)) {
				this.apiWrapper.executeCommand('schemaCompare.start', dacpacPath);
			} else {
				this.apiWrapper.showErrorMessage(constants.buildDacpacNotFound);
			}
		} else {
			this.apiWrapper.showErrorMessage(constants.schemaCompareNotInstalled);
		}
	}

	public async import(treeNode: BaseProjectTreeItem) {
		const project = ProjectsController.getProjectFromContext(treeNode);
		await this.apiWrapper.showErrorMessage(`Import not yet implemented: ${project.projectFilePath}`); // TODO
	}

	public async addFolderPrompt(treeNode: BaseProjectTreeItem) {
		const project = ProjectsController.getProjectFromContext(treeNode);
		const newFolderName = await this.promptForNewObjectName(new templates.ProjectScriptType(templates.folder, constants.folderFriendlyName, ''), project);

		if (!newFolderName) {
			return; // user cancelled
		}

		const relativeFolderPath = path.join(this.getRelativePath(treeNode), newFolderName);

		await project.addFolderItem(relativeFolderPath);

		this.refreshProjectsTree();
	}

	public async addItemPromptFromNode(treeNode: BaseProjectTreeItem, itemTypeName?: string) {
		await this.addItemPrompt(ProjectsController.getProjectFromContext(treeNode), this.getRelativePath(treeNode), itemTypeName);
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

	public getDeployDialog(project: Project): DeployDatabaseDialog {
		return new DeployDatabaseDialog(this.apiWrapper, project);
	}

	private static getProjectFromContext(context: Project | BaseProjectTreeItem) {
		if (context instanceof Project) {
			return context;
		}

		if (context.root instanceof ProjectRootTreeItem) {
			return (<ProjectRootTreeItem>context.root).project;
		}
		else {
			throw new Error(constants.unexpectedProjectContext(context.uri.path));
		}
	}

	private static async getDaxFxService(): Promise<mssql.IDacFxService> {
		const ext: Extension<any> = extensions.getExtension(mssql.extension.name)!;

		await ext.activate();
		return (ext.exports as mssql.IExtension).dacFx;
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
