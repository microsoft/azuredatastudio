/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from '../common/constants';
import * as dataSources from '../models/dataSources/dataSources';
import * as mssql from '../../../mssql';
import * as os from 'os';
import * as path from 'path';
import * as utils from '../common/utils';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as templates from '../templates/templates';
import * as newProjectTool from '../tools/newProjectTool';
import * as vscode from 'vscode';
import * as azdata from 'azdata';

import { promises as fs } from 'fs';
import { PublishDatabaseDialog } from '../dialogs/publishDatabaseDialog';
import { Project, reservedProjectFolders, FileProjectEntry, SqlProjectReferenceProjectEntry, IDatabaseReferenceProjectEntry } from '../models/project';
import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';
import { FolderNode, FileNode } from '../models/tree/fileFolderTreeItem';
import { IPublishSettings, IGenerateScriptSettings } from '../models/IPublishSettings';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';
import { ImportDataModel } from '../models/api/import';
import { NetCoreTool, DotNetCommandOptions } from '../tools/netcoreTool';
import { BuildHelper } from '../tools/buildHelper';
import { PublishProfile, load } from '../models/publishProfile/publishProfile';
import { AddDatabaseReferenceDialog } from '../dialogs/addDatabaseReferenceDialog';
import { ISystemDatabaseReferenceSettings, IDacpacReferenceSettings, IProjectReferenceSettings } from '../models/IDatabaseReferenceSettings';
import { DatabaseReferenceTreeItem } from '../models/tree/databaseReferencesTreeItem';
import { WorkspaceTreeItem } from 'dataworkspace';

/**
 * Controller for managing project lifecycle
 */
export class ProjectsController {
	private projectTreeViewProvider: SqlDatabaseProjectTreeViewProvider;
	private netCoreTool: NetCoreTool;
	private buildHelper: BuildHelper;

	projects: Project[] = [];
	projFileWatchers = new Map<string, vscode.FileSystemWatcher>();

	constructor(projTreeViewProvider: SqlDatabaseProjectTreeViewProvider) {
		this.projectTreeViewProvider = projTreeViewProvider;
		this.netCoreTool = new NetCoreTool();
		this.buildHelper = new BuildHelper();
	}

	public refreshProjectsTree() {
		this.projectTreeViewProvider.load(this.projects);
	}

	public async openProject(projectFile: vscode.Uri, focusProject: boolean = true, isReferencedProject: boolean = false): Promise<Project> {
		for (const proj of this.projects) {
			if (proj.projectFilePath === projectFile.fsPath) {
				if (!isReferencedProject) {
					vscode.window.showInformationMessage(constants.projectAlreadyOpened(projectFile.fsPath));
					return proj;
				} else {
					throw new Error(constants.projectAlreadyOpened(projectFile.fsPath));
				}
			}
		}

		let newProject: Project;

		try {
			// Read project file
			newProject = await Project.openProject(projectFile.fsPath);
			this.projects.push(newProject);

			// open any reference projects (don't need to worry about circular dependencies because those aren't allowed)
			const referencedProjects = newProject.databaseReferences.filter(r => r instanceof SqlProjectReferenceProjectEntry);
			for (const proj of referencedProjects) {
				const projUri = vscode.Uri.file(path.join(newProject.projectFolderPath, proj.fsUri.fsPath));
				try {
					await this.openProject(projUri, false, true);
				} catch (e) {
				}
			}

			// Update for round tripping as needed
			await this.updateProjectForRoundTrip(newProject);

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

			if (focusProject) {
				await this.focusProject(newProject);
			}
		}
		catch (err) {
			// if the project didnt load - remove it from the list of open projects
			this.projects = this.projects.filter((e) => { return e !== newProject; });

			throw err;
		}

		return newProject!;
	}

	public async focusProject(project?: Project): Promise<void> {
		if (project && this.projects.includes(project)) {
			await this.projectTreeViewProvider.focus(project);
			await vscode.commands.executeCommand(constants.sqlDatabaseProjectsViewFocusCommand);
		}
	}

	/**
	 * Creates a new folder with the project name in the specified location, and places the new .sqlproj inside it
	 * @param newProjName
	 * @param folderUri
	 * @param projectGuid
	 */
	public async createNewProject(newProjName: string, folderUri: vscode.Uri, makeOwnFolder: boolean, projectGuid?: string): Promise<string> {
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

		const newProjFilePath = makeOwnFolder ? path.join(folderUri.fsPath, path.parse(newProjFileName).name, newProjFileName) : path.join(folderUri.fsPath, newProjFileName);

		let fileExists = false;
		try {
			await fs.access(newProjFilePath);
			fileExists = true;
		}
		catch { } // file doesn't already exist

		if (fileExists) {
			throw new Error(constants.projectAlreadyExists(newProjFileName, path.parse(newProjFilePath).dir));
		}

		await fs.mkdir(path.dirname(newProjFilePath), { recursive: true });
		await fs.writeFile(newProjFilePath, newProjFileContents);

		return newProjFilePath;
	}

	public closeProject(treeNode: BaseProjectTreeItem) {
		const project = this.getProjectFromContext(treeNode);
		this.projects = this.projects.filter((e) => { return e !== project; });

		if (this.projFileWatchers.has(project.projectFilePath)) {
			this.projFileWatchers.get(project.projectFilePath)!.dispose();
			this.projFileWatchers.delete(project.projectFilePath);
		}

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
	public async buildProject(context: Project | BaseProjectTreeItem | WorkspaceTreeItem): Promise<string | undefined> {
		const project: Project = this.getProjectFromContext(context);

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
			vscode.window.showErrorMessage(constants.projBuildFailed(utils.getErrorMessage(err)));
			return undefined;
		}
	}

	/**
	 * Builds and publishes a project
	 * @param treeNode a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public publishProject(treeNode: BaseProjectTreeItem): PublishDatabaseDialog;
	/**
	 * Builds and publishes a project
	 * @param project Project to be built and published
	 */
	public publishProject(project: Project): PublishDatabaseDialog;
	public publishProject(context: Project | BaseProjectTreeItem): PublishDatabaseDialog {
		const project: Project = this.getProjectFromContext(context);
		let publishDatabaseDialog = this.getPublishDialog(project);

		publishDatabaseDialog.publish = async (proj, prof) => await this.executionCallback(proj, prof);
		publishDatabaseDialog.generateScript = async (proj, prof) => await this.executionCallback(proj, prof);
		publishDatabaseDialog.readPublishProfile = async (profileUri) => await this.readPublishProfileCallback(profileUri);

		publishDatabaseDialog.openDialog();

		return publishDatabaseDialog;
	}

	public async executionCallback(project: Project, settings: IPublishSettings | IGenerateScriptSettings): Promise<mssql.DacFxResult | undefined> {
		const dacpacPath = await this.buildProject(project);

		if (!dacpacPath) {
			return undefined; // buildProject() handles displaying the error
		}

		// copy dacpac to temp location before publishing
		const tempPath = path.join(os.tmpdir(), `${path.parse(dacpacPath).name}_${new Date().getTime()}${constants.sqlprojExtension}`);
		await fs.copyFile(dacpacPath, tempPath);

		const dacFxService = await this.getDaxFxService();

		if ((<IPublishSettings>settings).upgradeExisting) {
			return await dacFxService.deployDacpac(tempPath, settings.databaseName, (<IPublishSettings>settings).upgradeExisting, settings.connectionUri, azdata.TaskExecutionMode.execute, settings.sqlCmdVariables, settings.deploymentOptions);
		}
		else {
			return await dacFxService.generateDeployScript(tempPath, settings.databaseName, settings.connectionUri, azdata.TaskExecutionMode.script, settings.sqlCmdVariables, settings.deploymentOptions);
		}
	}

	public async readPublishProfileCallback(profileUri: vscode.Uri): Promise<PublishProfile> {
		try {
			const dacFxService = await this.getDaxFxService();
			const profile = await load(profileUri, dacFxService);
			return profile;
		}
		catch (e) {
			vscode.window.showErrorMessage(constants.profileReadError);
			throw e;
		}
	}

	public async schemaCompare(treeNode: BaseProjectTreeItem): Promise<void> {
		// check if schema compare extension is installed
		if (vscode.extensions.getExtension(constants.schemaCompareExtensionId)) {
			// build project
			await this.buildProject(treeNode);

			// start schema compare with the dacpac produced from build
			const project = this.getProjectFromContext(treeNode);
			const dacpacPath = path.join(project.projectFolderPath, 'bin', 'Debug', `${project.projectFileName}.dacpac`);

			// check that dacpac exists
			if (await utils.exists(dacpacPath)) {
				await vscode.commands.executeCommand(constants.schemaCompareStartCommand, dacpacPath);
			} else {
				vscode.window.showErrorMessage(constants.buildDacpacNotFound);
			}
		} else {
			vscode.window.showErrorMessage(constants.schemaCompareNotInstalled);
		}
	}

	public async addFolderPrompt(treeNode: BaseProjectTreeItem) {
		const project = this.getProjectFromContext(treeNode);
		const relativePathToParent = this.getRelativePath(treeNode);
		const absolutePathToParent = path.join(project.projectFolderPath, relativePathToParent);
		const newFolderName = await this.promptForNewObjectName(new templates.ProjectScriptType(templates.folder, constants.folderFriendlyName, ''),
			project, absolutePathToParent);

		if (!newFolderName) {
			return; // user cancelled
		}

		const relativeFolderPath = path.join(relativePathToParent, newFolderName);

		try {
			// check if folder already exists or is a reserved folder
			const absoluteFolderPath = path.join(absolutePathToParent, newFolderName);
			const folderExists = await utils.exists(absoluteFolderPath);

			if (folderExists || this.isReservedFolder(absoluteFolderPath, project.projectFolderPath)) {
				throw new Error(constants.folderAlreadyExists(path.parse(absoluteFolderPath).name));
			}

			await project.addFolderItem(relativeFolderPath);
			this.refreshProjectsTree();
		} catch (err) {
			vscode.window.showErrorMessage(utils.getErrorMessage(err));
		}
	}

	public isReservedFolder(absoluteFolderPath: string, projectFolderPath: string): boolean {
		const sameName = reservedProjectFolders.find(f => f === path.parse(absoluteFolderPath).name) !== undefined;
		const sameLocation = path.parse(absoluteFolderPath).dir === projectFolderPath;
		return sameName && sameLocation;
	}

	public async addItemPromptFromNode(treeNode: BaseProjectTreeItem, itemTypeName?: string) {
		await this.addItemPrompt(this.getProjectFromContext(treeNode), this.getRelativePath(treeNode), itemTypeName);
	}

	public async addItemPrompt(project: Project, relativePath: string, itemTypeName?: string) {
		if (!itemTypeName) {
			const items: vscode.QuickPickItem[] = [];

			for (const itemType of templates.projectScriptTypes()) {
				items.push({ label: itemType.friendlyName });
			}

			itemTypeName = (await vscode.window.showQuickPick(items, {
				canPickMany: false
			}))?.label;

			if (!itemTypeName) {
				return; // user cancelled
			}
		}

		const itemType = templates.projectScriptTypeMap()[itemTypeName.toLocaleLowerCase()];
		const absolutePathToParent = path.join(project.projectFolderPath, relativePath);
		let itemObjectName = await this.promptForNewObjectName(itemType, project, absolutePathToParent, constants.sqlFileExtension);

		itemObjectName = itemObjectName?.trim();

		if (!itemObjectName) {
			return; // user cancelled
		}

		const newFileText = this.macroExpansion(itemType.templateScript, { 'OBJECT_NAME': itemObjectName });
		const relativeFilePath = path.join(relativePath, itemObjectName + constants.sqlFileExtension);

		try {
			// check if file already exists
			const absoluteFilePath = path.join(project.projectFolderPath, relativeFilePath);
			const fileExists = await utils.exists(absoluteFilePath);

			if (fileExists) {
				throw new Error(constants.fileAlreadyExists(path.parse(absoluteFilePath).name));
			}

			const newEntry = await project.addScriptItem(relativeFilePath, newFileText, itemType.type);

			await vscode.commands.executeCommand(constants.vscodeOpenCommand, newEntry.fsUri);

			this.refreshProjectsTree();
		} catch (err) {
			vscode.window.showErrorMessage(utils.getErrorMessage(err));
		}
	}

	public async exclude(context: FileNode | FolderNode): Promise<void> {
		const project = this.getProjectFromContext(context);

		const fileEntry = this.getFileProjectEntry(project, context);

		if (fileEntry) {
			await project.exclude(fileEntry);
		} else {
			vscode.window.showErrorMessage(constants.unableToPerformAction(constants.excludeAction, context.uri.path));
		}

		this.refreshProjectsTree();
	}

	public async delete(context: BaseProjectTreeItem): Promise<void> {
		const project = this.getProjectFromContext(context);

		let confirmationPrompt;
		if (context instanceof DatabaseReferenceTreeItem) {
			confirmationPrompt = constants.deleteReferenceConfirmation(context.friendlyName);
		} else if (context instanceof FolderNode) {
			confirmationPrompt = constants.deleteConfirmationContents(context.friendlyName);
		} else {
			confirmationPrompt = constants.deleteConfirmation(context.friendlyName);
		}

		const response = await vscode.window.showWarningMessage(confirmationPrompt, { modal: true }, constants.yesString);

		if (response !== constants.yesString) {
			return;
		}

		let success = false;

		if (context instanceof DatabaseReferenceTreeItem) {
			const databaseReference = this.getDatabaseReference(project, context);

			if (databaseReference) {
				await project.deleteDatabaseReference(databaseReference);
				success = true;
			}
		} else if (context instanceof FileNode || FolderNode) {
			const fileEntry = this.getFileProjectEntry(project, context);

			if (fileEntry) {
				await project.deleteFileFolder(fileEntry);
				success = true;
			}
		}

		if (success) {
			this.refreshProjectsTree();
		} else {
			vscode.window.showErrorMessage(constants.unableToPerformAction(constants.deleteAction, context.uri.path));
		}
	}

	private getFileProjectEntry(project: Project, context: BaseProjectTreeItem): FileProjectEntry | undefined {
		const root = context.root as ProjectRootTreeItem;
		const fileOrFolder = context as FileNode ? context as FileNode : context as FolderNode;

		if (root && fileOrFolder) {
			// use relative path and not tree paths for files and folder
			const allFileEntries = project.files.concat(project.preDeployScripts).concat(project.postDeployScripts).concat(project.noneDeployScripts);
			return allFileEntries.find(x => utils.getPlatformSafeFileEntryPath(x.relativePath) === utils.getPlatformSafeFileEntryPath(utils.trimUri(root.fileSystemUri, fileOrFolder.fileSystemUri)));
		}
		return project.files.find(x => utils.getPlatformSafeFileEntryPath(x.relativePath) === utils.getPlatformSafeFileEntryPath(utils.trimUri(context.root.uri, context.uri)));
	}

	private getDatabaseReference(project: Project, context: BaseProjectTreeItem): IDatabaseReferenceProjectEntry | undefined {
		const root = context.root as ProjectRootTreeItem;
		const databaseReference = context as DatabaseReferenceTreeItem;

		if (root && databaseReference) {
			return project.databaseReferences.find(r => r.databaseName === databaseReference.treeItem.label);
		}

		return undefined;
	}

	/**
	 * Opens the folder containing the project
	 * @param context a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public async openContainingFolder(context: BaseProjectTreeItem): Promise<void> {
		const project = this.getProjectFromContext(context);
		await vscode.commands.executeCommand(constants.revealFileInOsCommand, vscode.Uri.file(project.projectFilePath));
	}

	/**
	 * Opens the .sqlproj file for the given project. Upon update of file, prompts user to
	 * reload their project.
	 * @param context a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public async editProjectFile(context: BaseProjectTreeItem): Promise<void> {
		const project = this.getProjectFromContext(context);

		try {
			await vscode.commands.executeCommand(constants.vscodeOpenCommand, vscode.Uri.file(project.projectFilePath));
			const projFileWatcher: vscode.FileSystemWatcher = vscode.workspace.createFileSystemWatcher(project.projectFilePath);
			this.projFileWatchers.set(project.projectFilePath, projFileWatcher);

			projFileWatcher.onDidChange(async (projectFileUri: vscode.Uri) => {
				const result = await vscode.window.showInformationMessage(constants.reloadProject, constants.yesString, constants.noString);

				if (result === constants.yesString) {
					this.reloadProject(projectFileUri);
				}
			});

			// stop watching for changes to the sqlproj after it's closed
			const closeSqlproj = vscode.workspace.onDidCloseTextDocument((d) => {
				if (this.projFileWatchers.has(d.uri.fsPath)) {
					this.projFileWatchers.get(d.uri.fsPath)!.dispose();
					this.projFileWatchers.delete(d.uri.fsPath);
					closeSqlproj.dispose();
				}
			});
		} catch (err) {
			vscode.window.showErrorMessage(utils.getErrorMessage(err));
		}
	}

	/**
	 * Reloads the given project. Throws an error if given project is not a valid open project.
	 * @param projectFileUri the uri of the project to be reloaded
	 */
	public async reloadProject(projectFileUri: vscode.Uri) {
		const project = this.projects.find((e) => e.projectFilePath === projectFileUri.fsPath);
		if (project) {
			// won't open any newly referenced projects, but otherwise matches the behavior of reopening the project
			await project.readProjFile();
			this.refreshProjectsTree();
		} else {
			throw new Error(constants.invalidProjectReload);
		}
	}

	/**
	 * Changes the project's DSP to the selected target platform
	 * @param context a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public async changeTargetPlatform(context: Project | BaseProjectTreeItem): Promise<void> {
		const project = this.getProjectFromContext(context);
		const selectedTargetPlatform = (await vscode.window.showQuickPick((Array.from(constants.targetPlatformToVersion.keys())).map(version => { return { label: version }; }),
			{
				canPickMany: false,
				placeHolder: constants.selectTargetPlatform(constants.getTargetPlatformFromVersion(project.getProjectTargetVersion()))
			}))?.label;

		if (selectedTargetPlatform) {
			await project.changeTargetPlatform(constants.targetPlatformToVersion.get(selectedTargetPlatform)!);
			vscode.window.showInformationMessage(constants.currentTargetPlatform(project.projectFileName, constants.getTargetPlatformFromVersion(project.getProjectTargetVersion())));
		}
	}

	/**
	 * Adds a database reference to the project
	 * @param context a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public async addDatabaseReference(context: Project | BaseProjectTreeItem): Promise<AddDatabaseReferenceDialog> {
		const project = this.getProjectFromContext(context);

		const addDatabaseReferenceDialog = this.getAddDatabaseReferenceDialog(project);
		addDatabaseReferenceDialog.addReference = async (proj, prof) => await this.addDatabaseReferenceCallback(proj, prof);

		addDatabaseReferenceDialog.openDialog();

		return addDatabaseReferenceDialog;
	}

	public async addDatabaseReferenceCallback(project: Project, settings: ISystemDatabaseReferenceSettings | IDacpacReferenceSettings | IProjectReferenceSettings): Promise<void> {
		try {
			if ((<IProjectReferenceSettings>settings).projectName !== undefined) {
				// get project path and guid
				const projectReferenceSettings = settings as IProjectReferenceSettings;
				const referencedProject = this.projects.find(p => p.projectFileName === projectReferenceSettings.projectName);
				const relativePath = path.relative(project.projectFolderPath, referencedProject?.projectFilePath!);
				projectReferenceSettings.projectRelativePath = vscode.Uri.file(relativePath);
				projectReferenceSettings.projectGuid = referencedProject?.projectGuid!;

				const projectReferences = referencedProject?.databaseReferences.filter(r => r instanceof SqlProjectReferenceProjectEntry) ?? [];

				// check for cirular dependency
				for (let r of projectReferences) {
					if ((<SqlProjectReferenceProjectEntry>r).projectName === project.projectFileName) {
						vscode.window.showErrorMessage(constants.cantAddCircularProjectReference(referencedProject?.projectFileName!));
						return;
					}
				}

				await project.addProjectReference(projectReferenceSettings);
			} else if ((<ISystemDatabaseReferenceSettings>settings).systemDb !== undefined) {
				await project.addSystemDatabaseReference(<ISystemDatabaseReferenceSettings>settings);
			} else {
				await project.addDatabaseReference(<IDacpacReferenceSettings>settings);
			}

			this.refreshProjectsTree();
		} catch (err) {
			vscode.window.showErrorMessage(utils.getErrorMessage(err));
		}
	}

	//#region Helper methods

	public getPublishDialog(project: Project): PublishDatabaseDialog {
		return new PublishDatabaseDialog(project);
	}

	public getAddDatabaseReferenceDialog(project: Project): AddDatabaseReferenceDialog {
		return new AddDatabaseReferenceDialog(project);
	}

	public async updateProjectForRoundTrip(project: Project) {
		if (project.importedTargets.includes(constants.NetCoreTargets) && !project.containsSSDTOnlySystemDatabaseReferences()) {
			return;
		}

		if (!project.importedTargets.includes(constants.NetCoreTargets)) {
			const result = await vscode.window.showWarningMessage(constants.updateProjectForRoundTrip, constants.yesString, constants.noString);
			if (result === constants.yesString) {
				await project.updateProjectForRoundTrip();
				await project.updateSystemDatabaseReferencesInProjFile();
			}
		} else if (project.containsSSDTOnlySystemDatabaseReferences()) {
			const result = await vscode.window.showWarningMessage(constants.updateProjectDatabaseReferencesForRoundTrip, constants.yesString, constants.noString);
			if (result === constants.yesString) {
				await project.updateSystemDatabaseReferencesInProjFile();
			}
		}
	}

	private getProjectFromContext(context: Project | BaseProjectTreeItem | WorkspaceTreeItem): Project {
		if ('element' in context) {
			return context.element.project;
		}

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

	public async getDaxFxService(): Promise<mssql.IDacFxService> {
		const ext: vscode.Extension<any> = vscode.extensions.getExtension(mssql.extension.name)!;

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

	private async promptForNewObjectName(itemType: templates.ProjectScriptType, _project: Project, folderPath: string, fileExtension?: string): Promise<string | undefined> {
		const suggestedName = itemType.friendlyName.replace(/\s+/g, '');
		let counter: number = 0;

		do {
			counter++;
		} while (counter < Number.MAX_SAFE_INTEGER
			&& await utils.exists(path.join(folderPath, `${suggestedName}${counter}${(fileExtension ?? '')}`)));

		const itemObjectName = await vscode.window.showInputBox({
			prompt: constants.newObjectNamePrompt(itemType.friendlyName),
			value: `${suggestedName}${counter}`,
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
	public async importNewDatabaseProject(context: azdata.IConnectionProfile | any): Promise<void> {

		// TODO: Refactor code
		try {
			const model: ImportDataModel | undefined = await this.getModelFromContext(context);

			if (!model) {
				return; // cancelled by user
			}
			model.projName = await this.getProjectName(model.database);
			let newProjFolderUri = (await this.getFolderLocation()).fsPath;
			model.extractTarget = await this.getExtractTarget();
			model.version = '1.0.0.0';

			newProjectTool.updateSaveLocationSetting();

			const newProjFilePath = await this.createNewProject(model.projName, vscode.Uri.file(newProjFolderUri), true);
			model.filePath = path.dirname(newProjFilePath);

			if (model.extractTarget === mssql.ExtractTarget.file) {
				model.filePath = path.join(model.filePath, model.projName + '.sql'); // File extractTarget specifies the exact file rather than the containing folder
			}

			const project = await Project.openProject(newProjFilePath);
			await this.importApiCall(model); // Call ExtractAPI in DacFx Service
			let fileFolderList: string[] = model.extractTarget === mssql.ExtractTarget.file ? [model.filePath] : await this.generateList(model.filePath); // Create a list of all the files and directories to be added to project

			await project.addToProject(fileFolderList); // Add generated file structure to the project
			await this.openProject(vscode.Uri.file(newProjFilePath));
		}
		catch (err) {
			vscode.window.showErrorMessage(utils.getErrorMessage(err));
		}
	}

	public async getModelFromContext(context: any): Promise<ImportDataModel | undefined> {
		let model = <ImportDataModel>{};

		let profile = this.getConnectionProfileFromContext(context);
		let connectionId, database;
		//TODO: Prompt for new connection addition and get database information if context information isn't provided.

		if (profile) {
			database = profile.databaseName;
			connectionId = profile.id;
		}
		else {
			const connection = await azdata.connection.openConnectionDialog();

			if (!connection) {
				return undefined;
			}

			connectionId = connection.connectionId;

			// use database that was connected to
			if (connection.options['database']) {
				database = connection.options['database'];
			}
		}

		// choose database if connection was to a server or master
		if (!database || database === constants.master) {
			const databaseList = await azdata.connection.listDatabases(connectionId);
			database = (await vscode.window.showQuickPick(databaseList.map(dbName => { return { label: dbName }; }),
				{
					canPickMany: false,
					placeHolder: constants.extractDatabaseSelection
				}))?.label;

			if (!database) {
				throw new Error(constants.databaseSelectionRequired);
			}
		}

		model.database = database;
		model.serverId = connectionId;

		return model;
	}

	private getConnectionProfileFromContext(context: azdata.IConnectionProfile | any): azdata.IConnectionProfile | undefined {
		if (!context) {
			return undefined;
		}

		// depending on where import new project is launched from, the connection profile could be passed as just
		// the profile or it could be wrapped in another object
		return (<any>context).connectionProfile ? (<any>context).connectionProfile : context;
	}

	private async getProjectName(dbName: string): Promise<string> {
		let projName = await vscode.window.showInputBox({
			prompt: constants.newDatabaseProjectName,
			value: newProjectTool.defaultProjectNameFromDb(dbName)
		});

		projName = projName?.trim();

		if (!projName) {
			throw new Error(constants.projectNameRequired);
		}

		return projName;
	}

	private mapExtractTargetEnum(inputTarget: any): mssql.ExtractTarget {
		if (inputTarget) {
			switch (inputTarget) {
				case constants.file: return mssql.ExtractTarget['file'];
				case constants.flat: return mssql.ExtractTarget['flat'];
				case constants.objectType: return mssql.ExtractTarget['objectType'];
				case constants.schema: return mssql.ExtractTarget['schema'];
				case constants.schemaObjectType: return mssql.ExtractTarget['schemaObjectType'];
				default: throw new Error(constants.invalidInput(inputTarget));
			}
		} else {
			throw new Error(constants.extractTargetRequired);
		}
	}

	private async getExtractTarget(): Promise<mssql.ExtractTarget> {
		let extractTarget: mssql.ExtractTarget;

		let extractTargetOptions: vscode.QuickPickItem[] = [];

		let keys = [constants.file, constants.flat, constants.objectType, constants.schema, constants.schemaObjectType];

		// TODO: Create a wrapper class to handle the mapping
		keys.forEach((targetOption: string) => {
			extractTargetOptions.push({ label: targetOption });
		});

		let input = await vscode.window.showQuickPick(extractTargetOptions, {
			canPickMany: false,
			placeHolder: constants.extractTargetInput
		});
		let extractTargetInput = input?.label;

		extractTarget = this.mapExtractTargetEnum(extractTargetInput);

		return extractTarget;
	}

	private async getFolderLocation(): Promise<vscode.Uri> {
		let projUri: vscode.Uri;

		const selectionResult = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: constants.selectString,
			defaultUri: newProjectTool.defaultProjectSaveLocation()
		});

		if (selectionResult) {
			projUri = (selectionResult as vscode.Uri[])[0];
		}
		else {
			throw new Error(constants.projectLocationRequired);
		}

		return projUri;
	}

	public async importApiCall(model: ImportDataModel): Promise<void> {
		let ext = vscode.extensions.getExtension(mssql.extension.name)!;

		const service = (await ext.activate() as mssql.IExtension).dacFx;
		const ownerUri = await azdata.connection.getUriForConnection(model.serverId);

		await service.importDatabaseProject(model.database, model.filePath, model.projName, model.version, ownerUri, model.extractTarget, azdata.TaskExecutionMode.execute);

		// TODO: Check for success; throw error
	}

	/**
	 * Generate a flat list of all files and folder under a folder.
	 */
	public async generateList(absolutePath: string): Promise<string[]> {
		let fileFolderList: string[] = [];

		if (!await utils.exists(absolutePath)) {
			if (await utils.exists(absolutePath + constants.sqlFileExtension)) {
				absolutePath += constants.sqlFileExtension;
			} else {
				vscode.window.showErrorMessage(constants.cannotResolvePath(absolutePath));
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
