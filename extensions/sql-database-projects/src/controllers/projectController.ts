/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from '../common/constants';
import * as mssql from '../../../mssql';
import * as os from 'os';
import * as path from 'path';
import * as utils from '../common/utils';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as templates from '../templates/templates';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as dataworkspace from 'dataworkspace';

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
import { CreateProjectFromDatabaseDialog } from '../dialogs/createProjectFromDatabaseDialog';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';

/**
 * Controller for managing lifecycle of projects
 */
export class ProjectsController {
	private netCoreTool: NetCoreTool;
	private buildHelper: BuildHelper;

	projFileWatchers = new Map<string, vscode.FileSystemWatcher>();

	constructor() {
		this.netCoreTool = new NetCoreTool();
		this.buildHelper = new BuildHelper();
	}

	public refreshProjectsTree(workspaceTreeItem: dataworkspace.WorkspaceTreeItem): void {
		(workspaceTreeItem.treeDataProvider as SqlDatabaseProjectTreeViewProvider).notifyTreeDataChanged();
	}

	/**
	 * Creates a new folder with the project name in the specified location, and places the new .sqlproj inside it
	 * @param newProjName
	 * @param folderUri
	 * @param projectGuid
	 */
	public async createNewProject(creationParams: NewProjectParams): Promise<string> {
		TelemetryReporter.createActionEvent(TelemetryViews.ProjectController, TelemetryActions.createNewProject)
			.withAdditionalProperties({ template: creationParams.projectTypeId })
			.send();

		if (creationParams.projectGuid && !UUID.isUUID(creationParams.projectGuid)) {
			throw new Error(`Specified GUID is invalid: '${creationParams.projectGuid}'`);
		}

		const macroDict: Record<string, string> = {
			'PROJECT_NAME': creationParams.newProjName,
			'PROJECT_GUID': creationParams.projectGuid ?? UUID.generateUuid().toUpperCase()
		};

		let newProjFileContents = templates.macroExpansion(templates.newSqlProjectTemplate, macroDict);

		let newProjFileName = creationParams.newProjName;

		if (!newProjFileName.toLowerCase().endsWith(constants.sqlprojExtension)) {
			newProjFileName += constants.sqlprojExtension;
		}

		const newProjFilePath = path.join(creationParams.folderUri.fsPath, path.parse(newProjFileName).name, newProjFileName);

		if (await utils.exists(newProjFilePath)) {
			throw new Error(constants.projectAlreadyExists(newProjFileName, path.parse(newProjFilePath).dir));
		}

		await fs.mkdir(path.dirname(newProjFilePath), { recursive: true });
		await fs.writeFile(newProjFilePath, newProjFileContents);

		await this.addTemplateFiles(newProjFilePath, creationParams.projectTypeId);

		return newProjFilePath;
	}

	/**
	 * Builds a project, producing a dacpac
	 * @param treeNode a treeItem in a project's hierarchy, to be used to obtain a Project
	 * @returns path of the built dacpac
	 */
	public async buildProject(treeNode: dataworkspace.WorkspaceTreeItem): Promise<string>;
	/**
	 * Builds a project, producing a dacpac
	 * @param project Project to be built
	 * @returns path of the built dacpac
	 */
	public async buildProject(project: Project): Promise<string>;
	public async buildProject(context: Project | dataworkspace.WorkspaceTreeItem): Promise<string> {
		const project: Project = this.getProjectFromContext(context);

		const startTime = new Date();

		// Check mssql extension for project dlls (tracking issue #10273)
		await this.buildHelper.createBuildDirFolder();

		const options: DotNetCommandOptions = {
			commandTitle: 'Build',
			workingDirectory: project.projectFolderPath,
			argument: this.buildHelper.constructBuildArguments(project.projectFilePath, this.buildHelper.extensionBuildDirPath)
		};

		try {
			await this.netCoreTool.runDotnetCommand(options);

			TelemetryReporter.createActionEvent(TelemetryViews.ProjectController, TelemetryActions.build)
				.withAdditionalMeasurements({ duration: new Date().getMilliseconds() - startTime.getMilliseconds() })
				.send();

			return project.dacpacOutputPath;
		} catch (err) {
			TelemetryReporter.createErrorEvent(TelemetryViews.ProjectController, TelemetryActions.build)
				.withAdditionalMeasurements({ duration: new Date().getMilliseconds() - startTime.getMilliseconds() })
				.send();

			vscode.window.showErrorMessage(constants.projBuildFailed(utils.getErrorMessage(err)));
			return '';
		}
	}

	/**
	 * Builds and publishes a project
	 * @param treeNode a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public publishProject(treeNode: dataworkspace.WorkspaceTreeItem): PublishDatabaseDialog;
	/**
	 * Builds and publishes a project
	 * @param project Project to be built and published
	 */
	public publishProject(project: Project): PublishDatabaseDialog;
	public publishProject(context: Project | dataworkspace.WorkspaceTreeItem): PublishDatabaseDialog {
		const project: Project = this.getProjectFromContext(context);
		let publishDatabaseDialog = this.getPublishDialog(project);

		publishDatabaseDialog.publish = async (proj, prof) => await this.publishProjectCallback(proj, prof);
		publishDatabaseDialog.generateScript = async (proj, prof) => await this.publishProjectCallback(proj, prof);
		publishDatabaseDialog.readPublishProfile = async (profileUri) => await this.readPublishProfileCallback(profileUri);

		publishDatabaseDialog.openDialog();

		return publishDatabaseDialog;
	}

	public async publishProjectCallback(project: Project, settings: IPublishSettings | IGenerateScriptSettings): Promise<mssql.DacFxResult | undefined> {
		const telemetryProps: Record<string, string> = {};
		const telemetryMeasures: Record<string, number> = {};
		const buildStartTime = new Date().getMilliseconds();

		const dacpacPath = await this.buildProject(project);

		const buildEndTime = new Date().getMilliseconds();
		telemetryMeasures.buildDuration = buildEndTime - buildStartTime;
		telemetryProps.buildSucceeded = (dacpacPath !== '').toString();

		if (!dacpacPath) {
			TelemetryReporter.createErrorEvent(TelemetryViews.ProjectController, TelemetryActions.publishProject)
				.withAdditionalProperties(telemetryProps)
				.withAdditionalMeasurements(telemetryMeasures)
				.send();

			return undefined; // buildProject() handles displaying the error
		}

		// copy dacpac to temp location before publishing
		const tempPath = path.join(os.tmpdir(), `${path.parse(dacpacPath).name}_${new Date().getTime()}${constants.sqlprojExtension}`);
		await fs.copyFile(dacpacPath, tempPath);

		const dacFxService = await this.getDaxFxService();

		let result: mssql.DacFxResult;
		telemetryProps.profileUsed = (settings.profileUsed ?? false).toString();
		const actionStartTime = new Date().getMilliseconds();

		try {
			if ((<IPublishSettings>settings).upgradeExisting) {
				telemetryProps.publishAction = 'deploy';
				result = await dacFxService.deployDacpac(tempPath, settings.databaseName, (<IPublishSettings>settings).upgradeExisting, settings.connectionUri, azdata.TaskExecutionMode.execute, settings.sqlCmdVariables, settings.deploymentOptions);
			}
			else {
				telemetryProps.publishAction = 'generateScript';
				result = await dacFxService.generateDeployScript(tempPath, settings.databaseName, settings.connectionUri, azdata.TaskExecutionMode.script, settings.sqlCmdVariables, settings.deploymentOptions);
			}
		} catch (err) {
			const actionEndTime = new Date().getMilliseconds();
			telemetryProps.actionDuration = (actionEndTime - actionStartTime).toString();
			telemetryProps.totalDuration = (actionEndTime - buildStartTime).toString();

			TelemetryReporter.createErrorEvent(TelemetryViews.ProjectController, TelemetryActions.publishProject)
				.withAdditionalProperties(telemetryProps)
				.send();

			throw err;
		}

		const actionEndTime = new Date().getMilliseconds();
		telemetryProps.actionDuration = (actionEndTime - actionStartTime).toString();
		telemetryProps.totalDuration = (actionEndTime - buildStartTime).toString();

		TelemetryReporter.createActionEvent(TelemetryViews.ProjectController, TelemetryActions.publishProject)
			.withAdditionalProperties(telemetryProps)
			.send();

		return result;
	}

	public async readPublishProfileCallback(profileUri: vscode.Uri): Promise<PublishProfile> {
		try {
			const dacFxService = await this.getDaxFxService();
			const profile = await load(profileUri, dacFxService);
			return profile;
		} catch (e) {
			vscode.window.showErrorMessage(constants.profileReadError);
			throw e;
		}
	}

	public async schemaCompare(treeNode: dataworkspace.WorkspaceTreeItem): Promise<void> {
		try {
			// check if schema compare extension is installed
			if (vscode.extensions.getExtension(constants.schemaCompareExtensionId)) {
				// build project
				const dacpacPath = await this.buildProject(treeNode);

				// check that dacpac exists
				if (await utils.exists(dacpacPath)) {
					TelemetryReporter.sendActionEvent(TelemetryViews.ProjectController, TelemetryActions.projectSchemaCompareCommandInvoked);
					await vscode.commands.executeCommand(constants.schemaCompareStartCommand, dacpacPath);
				} else {
					throw new Error(constants.buildFailedCannotStartSchemaCompare);
				}
			} else {
				throw new Error(constants.schemaCompareNotInstalled);
			}
		} catch (err) {
			const props: Record<string, string> = {};
			const message = utils.getErrorMessage(err);

			if (message === constants.buildFailedCannotStartSchemaCompare || message === constants.schemaCompareNotInstalled) {
				props.errorMessage = message;
			}

			TelemetryReporter.createErrorEvent(TelemetryViews.ProjectController, TelemetryActions.projectSchemaCompareCommandInvoked)
				.withAdditionalProperties(props)
				.send();

			vscode.window.showErrorMessage(utils.getErrorMessage(err));
		}
	}

	public async addFolderPrompt(treeNode: dataworkspace.WorkspaceTreeItem): Promise<void> {
		const project = this.getProjectFromContext(treeNode);
		const relativePathToParent = this.getRelativePath(treeNode.element);
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
			this.refreshProjectsTree(treeNode);
		} catch (err) {
			vscode.window.showErrorMessage(utils.getErrorMessage(err));
		}
	}

	public isReservedFolder(absoluteFolderPath: string, projectFolderPath: string): boolean {
		const sameName = reservedProjectFolders.find(f => f === path.parse(absoluteFolderPath).name) !== undefined;
		const sameLocation = path.parse(absoluteFolderPath).dir === projectFolderPath;
		return sameName && sameLocation;
	}

	public async addItemPromptFromNode(treeNode: dataworkspace.WorkspaceTreeItem, itemTypeName?: string): Promise<void> {
		await this.addItemPrompt(this.getProjectFromContext(treeNode), this.getRelativePath(treeNode.element), itemTypeName, treeNode.treeDataProvider as SqlDatabaseProjectTreeViewProvider);
	}

	public async addItemPrompt(project: Project, relativePath: string, itemTypeName?: string, treeDataProvider?: SqlDatabaseProjectTreeViewProvider): Promise<void> {
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

		const itemType = templates.get(itemTypeName);
		const absolutePathToParent = path.join(project.projectFolderPath, relativePath);
		let itemObjectName = await this.promptForNewObjectName(itemType, project, absolutePathToParent, constants.sqlFileExtension);

		itemObjectName = itemObjectName?.trim();

		if (!itemObjectName) {
			return; // user cancelled
		}

		const newFileText = templates.macroExpansion(itemType.templateScript, { 'OBJECT_NAME': itemObjectName });
		const relativeFilePath = path.join(relativePath, itemObjectName + constants.sqlFileExtension);

		const telemetryProps: Record<string, string> = { itemType: itemType.type };
		const telemetryMeasurements: Record<string, number> = {};

		if (itemType.type === templates.preDeployScript) {
			telemetryMeasurements.numPredeployScripts = project.preDeployScripts.length;
		} else if (itemType.type === templates.postDeployScript) {
			telemetryMeasurements.numPostdeployScripts = project.postDeployScripts.length;
		}

		try {
			const newEntry = await project.addScriptItem(relativeFilePath, newFileText, itemType.type);

			TelemetryReporter.createActionEvent(TelemetryViews.ProjectTree, TelemetryActions.addItemFromTree)
				.withAdditionalProperties(telemetryProps)
				.withAdditionalMeasurements(telemetryMeasurements)
				.send();

			await vscode.commands.executeCommand(constants.vscodeOpenCommand, newEntry.fsUri);
			treeDataProvider?.notifyTreeDataChanged();
		} catch (err) {
			vscode.window.showErrorMessage(utils.getErrorMessage(err));

			TelemetryReporter.createErrorEvent(TelemetryViews.ProjectTree, TelemetryActions.addItemFromTree)
				.withAdditionalProperties(telemetryProps)
				.withAdditionalMeasurements(telemetryMeasurements)
				.send();
		}
	}

	public async exclude(context: dataworkspace.WorkspaceTreeItem): Promise<void> {
		const node = context.element as BaseProjectTreeItem;
		const project = this.getProjectFromContext(node);

		const fileEntry = this.getFileProjectEntry(project, node);

		if (fileEntry) {
			TelemetryReporter.sendActionEvent(TelemetryViews.ProjectTree, TelemetryActions.excludeFromProject);
			await project.exclude(fileEntry);
		} else {
			TelemetryReporter.sendErrorEvent(TelemetryViews.ProjectTree, TelemetryActions.excludeFromProject);
			vscode.window.showErrorMessage(constants.unableToPerformAction(constants.excludeAction, node.uri.path));
		}

		this.refreshProjectsTree(context);
	}

	public async delete(context: dataworkspace.WorkspaceTreeItem): Promise<void> {
		const node = context.element as BaseProjectTreeItem;
		const project = this.getProjectFromContext(node);

		let confirmationPrompt;
		if (node instanceof DatabaseReferenceTreeItem) {
			confirmationPrompt = constants.deleteReferenceConfirmation(node.friendlyName);
		} else if (node instanceof FolderNode) {
			confirmationPrompt = constants.deleteConfirmationContents(node.friendlyName);
		} else {
			confirmationPrompt = constants.deleteConfirmation(node.friendlyName);
		}

		const response = await vscode.window.showWarningMessage(confirmationPrompt, { modal: true }, constants.yesString);

		if (response !== constants.yesString) {
			return;
		}

		let success = false;

		if (node instanceof DatabaseReferenceTreeItem) {
			const databaseReference = this.getDatabaseReference(project, node);

			if (databaseReference) {
				await project.deleteDatabaseReference(databaseReference);
				success = true;
			}
		} else if (node instanceof FileNode || FolderNode) {
			const fileEntry = this.getFileProjectEntry(project, node);

			if (fileEntry) {
				await project.deleteFileFolder(fileEntry);
				success = true;
			}
		}

		if (success) {
			TelemetryReporter.createActionEvent(TelemetryViews.ProjectTree, TelemetryActions.deleteObjectFromProject)
				.withAdditionalProperties({ objectType: node.constructor.name })
				.send();

			this.refreshProjectsTree(context);
		} else {
			TelemetryReporter.createErrorEvent(TelemetryViews.ProjectTree, TelemetryActions.deleteObjectFromProject)
				.withAdditionalProperties({ objectType: node.constructor.name })
				.send();

			vscode.window.showErrorMessage(constants.unableToPerformAction(constants.deleteAction, node.uri.path));
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
	public async openContainingFolder(context: dataworkspace.WorkspaceTreeItem): Promise<void> {
		const project = this.getProjectFromContext(context);
		await vscode.commands.executeCommand(constants.revealFileInOsCommand, vscode.Uri.file(project.projectFilePath));
	}

	/**
	 * Opens the .sqlproj file for the given project. Upon update of file, prompts user to
	 * reload their project.
	 * @param context a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public async editProjectFile(context: dataworkspace.WorkspaceTreeItem): Promise<void> {
		const project = this.getProjectFromContext(context);

		try {
			await vscode.commands.executeCommand(constants.vscodeOpenCommand, vscode.Uri.file(project.projectFilePath));

			TelemetryReporter.sendActionEvent(TelemetryViews.ProjectTree, TelemetryActions.editProjectFile);

			const projFileWatcher: vscode.FileSystemWatcher = vscode.workspace.createFileSystemWatcher(project.projectFilePath);
			this.projFileWatchers.set(project.projectFilePath, projFileWatcher);

			projFileWatcher.onDidChange(async () => {
				const result = await vscode.window.showInformationMessage(constants.reloadProject, constants.yesString, constants.noString);

				if (result === constants.yesString) {
					this.reloadProject(context);
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
	public async reloadProject(context: dataworkspace.WorkspaceTreeItem): Promise<void> {
		const project = this.getProjectFromContext(context);
		if (project) {
			// won't open any newly referenced projects, but otherwise matches the behavior of reopening the project
			await project.readProjFile();
			this.refreshProjectsTree(context);
		} else {
			throw new Error(constants.invalidProjectReload);
		}
	}

	/**
	 * Changes the project's DSP to the selected target platform
	 * @param context a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public async changeTargetPlatform(context: Project | dataworkspace.WorkspaceTreeItem): Promise<void> {
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
	public async addDatabaseReference(context: Project | dataworkspace.WorkspaceTreeItem): Promise<AddDatabaseReferenceDialog> {
		const project = this.getProjectFromContext(context);

		const addDatabaseReferenceDialog = this.getAddDatabaseReferenceDialog(project);
		addDatabaseReferenceDialog.addReference = async (proj, prof) => await this.addDatabaseReferenceCallback(proj, prof, context as dataworkspace.WorkspaceTreeItem);

		addDatabaseReferenceDialog.openDialog();

		return addDatabaseReferenceDialog;
	}

	/**
	 * Adds a database reference to a project, after selections have been made in the dialog
	 * @param project project to which to add the database reference
	 * @param settings settings for the database reference
	 * @param context a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public async addDatabaseReferenceCallback(project: Project, settings: ISystemDatabaseReferenceSettings | IDacpacReferenceSettings | IProjectReferenceSettings, context: dataworkspace.WorkspaceTreeItem): Promise<void> {
		try {
			if ((<IProjectReferenceSettings>settings).projectName !== undefined) {
				// get project path and guid
				const projectReferenceSettings = settings as IProjectReferenceSettings;
				const workspaceProjects = utils.getSqlProjectsInWorkspace();
				const referencedProject = await Project.openProject(workspaceProjects.filter(p => path.parse(p.fsPath).name === projectReferenceSettings.projectName)[0].fsPath);
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

			this.refreshProjectsTree(context);
		} catch (err) {
			vscode.window.showErrorMessage(utils.getErrorMessage(err));
		}
	}

	/**
	 * Validates the contents of an external streaming job's query against the last-built dacpac.
	 * If no dacpac exists at the output path, one will be built first.
	 * @param node a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public async validateExternalStreamingJob(node: dataworkspace.WorkspaceTreeItem): Promise<mssql.ValidateStreamingJobResult> {
		const project: Project = this.getProjectFromContext(node);

		let dacpacPath: string = project.dacpacOutputPath;
		const preExistingDacpac = await utils.exists(dacpacPath);

		const telemetryProps: Record<string, string> = { preExistingDacpac: preExistingDacpac.toString() };


		if (!preExistingDacpac) {
			dacpacPath = await this.buildProject(project);
		}

		const streamingJobDefinition: string = (await fs.readFile(node.element.fileSystemUri.fsPath)).toString();

		const dacFxService = await this.getDaxFxService();
		const actionStartTime = new Date().getMilliseconds();

		const result: mssql.ValidateStreamingJobResult = await dacFxService.validateStreamingJob(dacpacPath, streamingJobDefinition);

		const duration = new Date().getMilliseconds() - actionStartTime;
		telemetryProps.success = result.success.toString();

		if (result.success) {
			vscode.window.showInformationMessage(constants.externalStreamingJobValidationPassed);
		}
		else {
			vscode.window.showErrorMessage(result.errorMessage);
		}

		TelemetryReporter.createActionEvent(TelemetryViews.ProjectTree, TelemetryActions.runStreamingJobValidation)
			.withAdditionalProperties(telemetryProps)
			.withAdditionalMeasurements({ duration: duration })
			.send();

		return result;
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

	private async addTemplateFiles(newProjFilePath: string, projectTypeId: string): Promise<void> {
		if (projectTypeId === constants.emptySqlDatabaseProjectTypeId || newProjFilePath === '') {
			return;
		}

		if (projectTypeId === constants.edgeSqlDatabaseProjectTypeId) {
			const project = await Project.openProject(newProjFilePath);

			await this.createFileFromTemplate(project, templates.get(templates.table), 'DataTable.sql', { 'OBJECT_NAME': 'DataTable' });
			await this.createFileFromTemplate(project, templates.get(templates.dataSource), 'EdgeHubInputDataSource.sql', { 'OBJECT_NAME': 'EdgeHubInputDataSource', 'LOCATION': 'edgehub://' });
			await this.createFileFromTemplate(project, templates.get(templates.dataSource), 'SqlOutputDataSource.sql', { 'OBJECT_NAME': 'SqlOutputDataSource', 'LOCATION': 'sqlserver://tcp:.,1433' });
			await this.createFileFromTemplate(project, templates.get(templates.fileFormat), 'StreamFileFormat.sql', { 'OBJECT_NAME': 'StreamFileFormat' });
			await this.createFileFromTemplate(project, templates.get(templates.externalStream), 'EdgeHubInputStream.sql', { 'OBJECT_NAME': 'EdgeHubInputStream', 'DATA_SOURCE_NAME': 'EdgeHubInputDataSource', 'LOCATION': 'input', 'OPTIONS': ',\n\tFILE_FORMAT = StreamFileFormat' });
			await this.createFileFromTemplate(project, templates.get(templates.externalStream), 'SqlOutputStream.sql', { 'OBJECT_NAME': 'SqlOutputStream', 'DATA_SOURCE_NAME': 'SqlOutputDataSource', 'LOCATION': 'TSQLStreaming.dbo.DataTable', 'OPTIONS': '' });
			await this.createFileFromTemplate(project, templates.get(templates.externalStreamingJob), 'EdgeStreamingJob.sql', { 'OBJECT_NAME': 'EdgeStreamingJob' });
		}
	}

	private async createFileFromTemplate(project: Project, itemType: templates.ProjectScriptType, relativePath: string, expansionMacros: Record<string, string>): Promise<void> {
		const newFileText = templates.macroExpansion(itemType.templateScript, expansionMacros);
		await project.addScriptItem(relativePath, newFileText, itemType.type);
	}

	private getProjectFromContext(context: Project | BaseProjectTreeItem | dataworkspace.WorkspaceTreeItem): Project {
		if ('element' in context) {
			return context.element.root.project;
		}

		if (context instanceof Project) {
			return context;
		}

		if (context.root instanceof ProjectRootTreeItem) {
			return (<ProjectRootTreeItem>context.root).project;
		} else {
			throw new Error(constants.unexpectedProjectContext(context.uri.path));
		}
	}

	public async getDaxFxService(): Promise<mssql.IDacFxService> {
		const ext: vscode.Extension<any> = vscode.extensions.getExtension(mssql.extension.name)!;

		await ext.activate();
		return (ext.exports as mssql.IExtension).dacFx;
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
	 * Creates a new SQL database project from the existing database,
	 * prompting the user for a name, file path location and extract target
	 */
	public async createProjectFromDatabase(context: azdata.IConnectionProfile | any): Promise<CreateProjectFromDatabaseDialog> {
		const profile = this.getConnectionProfileFromContext(context);
		let createProjectFromDatabaseDialog = this.getCreateProjectFromDatabaseDialog(profile);

		createProjectFromDatabaseDialog.createProjectFromDatabaseCallback = async (model) => await this.createProjectFromDatabaseCallback(model);

		await createProjectFromDatabaseDialog.openDialog();

		return createProjectFromDatabaseDialog;
	}

	public getCreateProjectFromDatabaseDialog(profile: azdata.IConnectionProfile | undefined): CreateProjectFromDatabaseDialog {
		return new CreateProjectFromDatabaseDialog(profile);
	}

	public async createProjectFromDatabaseCallback(model: ImportDataModel) {
		try {
			const workspaceApi = utils.getDataWorkspaceExtensionApi();

			const validateWorkspace = await workspaceApi.validateWorkspace();
			if (validateWorkspace) {
				const newProjFolderUri = model.filePath;

				const newProjFilePath = await this.createNewProject({
					newProjName: model.projName,
					folderUri: vscode.Uri.file(newProjFolderUri),
					projectTypeId: constants.emptySqlDatabaseProjectTypeId
				});

				model.filePath = path.dirname(newProjFilePath);
				this.setFilePath(model);

				const project = await Project.openProject(newProjFilePath);
				await this.createProjectFromDatabaseApiCall(model); // Call ExtractAPI in DacFx Service
				let fileFolderList: vscode.Uri[] = model.extractTarget === mssql.ExtractTarget.file ? [vscode.Uri.file(model.filePath)] : await this.generateList(model.filePath); // Create a list of all the files and directories to be added to project

				await project.addToProject(fileFolderList); // Add generated file structure to the project

				// add project to workspace
				workspaceApi.showProjectsView();
				await workspaceApi.addProjectsToWorkspace([vscode.Uri.file(newProjFilePath)], model.newWorkspaceFilePath);
			}
		} catch (err) {
			vscode.window.showErrorMessage(utils.getErrorMessage(err));
		}
	}

	public setFilePath(model: ImportDataModel) {
		if (model.extractTarget === mssql.ExtractTarget.file) {
			model.filePath = path.join(model.filePath, `${model.projName}.sql`); // File extractTarget specifies the exact file rather than the containing folder
		}
	}

	private getConnectionProfileFromContext(context: azdata.IConnectionProfile | any): azdata.IConnectionProfile | undefined {
		if (!context) {
			return undefined;
		}

		// depending on where import new project is launched from, the connection profile could be passed as just
		// the profile or it could be wrapped in another object
		return (<any>context).connectionProfile ? (<any>context).connectionProfile : context;
	}

	public async createProjectFromDatabaseApiCall(model: ImportDataModel): Promise<void> {
		let ext = vscode.extensions.getExtension(mssql.extension.name)!;

		const service = (await ext.activate() as mssql.IExtension).dacFx;
		const ownerUri = await azdata.connection.getUriForConnection(model.serverId);

		await service.createProjectFromDatabase(model.database, model.filePath, model.projName, model.version, ownerUri, model.extractTarget, azdata.TaskExecutionMode.execute);

		// TODO: Check for success; throw error
	}

	/**
	 * Generate a flat list of all files and folder under a folder.
	 */
	public async generateList(absolutePath: string): Promise<vscode.Uri[]> {
		let fileFolderList: vscode.Uri[] = [];

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
					fileFolderList.push(vscode.Uri.file(filepath));
					(await fs
						.readdir(filepath))
						.forEach((f: string) => files.push(path.join(filepath, f)));
				}
				else if (stat.isFile()) {
					fileFolderList.push(vscode.Uri.file(filepath));
				}
			}

		} while (files.length !== 0);

		return fileFolderList;
	}

	//#endregion
}

export interface NewProjectParams {
	newProjName: string;
	folderUri: vscode.Uri;
	projectTypeId: string;
	projectGuid?: string;
}
