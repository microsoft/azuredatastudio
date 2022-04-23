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
import type * as azdataType from 'azdata';
import * as dataworkspace from 'dataworkspace';
import type * as mssqlVscode from 'vscode-mssql';

import { promises as fs } from 'fs';
import { PublishDatabaseDialog } from '../dialogs/publishDatabaseDialog';
import { Project, reservedProjectFolders, FileProjectEntry, SqlProjectReferenceProjectEntry, IDatabaseReferenceProjectEntry } from '../models/project';
import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';
import { FolderNode, FileNode } from '../models/tree/fileFolderTreeItem';
import { IDeploySettings } from '../models/IDeploySettings';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';
import { ImportDataModel } from '../models/api/import';
import { NetCoreTool, DotNetError } from '../tools/netcoreTool';
import { ShellCommandOptions } from '../tools/shellExecutionHelper';
import { BuildHelper } from '../tools/buildHelper';
import { readPublishProfile } from '../models/publishProfile/publishProfile';
import { AddDatabaseReferenceDialog } from '../dialogs/addDatabaseReferenceDialog';
import { ISystemDatabaseReferenceSettings, IDacpacReferenceSettings, IProjectReferenceSettings } from '../models/IDatabaseReferenceSettings';
import { DatabaseReferenceTreeItem } from '../models/tree/databaseReferencesTreeItem';
import { CreateProjectFromDatabaseDialog } from '../dialogs/createProjectFromDatabaseDialog';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';
import { IconPathHelper } from '../common/iconHelper';
import { DashboardData, PublishData, Status } from '../models/dashboardData/dashboardData';
import { launchPublishDatabaseQuickpick } from '../dialogs/publishDatabaseQuickpick';
import { launchPublishToDockerContainerQuickpick } from '../dialogs/deployDatabaseQuickpick';
import { DeployService } from '../models/deploy/deployService';
import { SqlTargetPlatform } from 'sqldbproj';
import { AutorestHelper } from '../tools/autorestHelper';
import { createNewProjectFromDatabaseWithQuickpick } from '../dialogs/createProjectFromDatabaseQuickpick';
import { addDatabaseReferenceQuickpick } from '../dialogs/addDatabaseReferenceQuickpick';

const maxTableLength = 10;

/**
 * This is a duplicate of the TaskExecutionMode from azdata.d.ts/vscode-mssql.d.ts, which is needed
 * for using when running in VS Code since we don't have an actual implementation of the enum at runtime
 * (unlike azdata which is injected by the extension host). Even specifying it as a const enum in the
 * typings file currently doesn't work as the TypeScript compiler doesn't currently inline const enum
 * values imported as "import type" https://github.com/microsoft/TypeScript/issues/40344
 */
export enum TaskExecutionMode {
	execute = 0,
	script = 1,
	executeAndScript = 2
}

export type AddDatabaseReferenceSettings = ISystemDatabaseReferenceSettings | IDacpacReferenceSettings | IProjectReferenceSettings;

/**
 * Controller for managing lifecycle of projects
 */
export class ProjectsController {
	private netCoreTool: NetCoreTool;
	private buildHelper: BuildHelper;
	private buildInfo: DashboardData[] = [];
	private publishInfo: PublishData[] = [];
	private deployService: DeployService;
	private autorestHelper: AutorestHelper;

	projFileWatchers = new Map<string, vscode.FileSystemWatcher>();

	constructor(private _outputChannel: vscode.OutputChannel) {
		this.netCoreTool = new NetCoreTool(this._outputChannel);
		this.buildHelper = new BuildHelper();
		this.deployService = new DeployService(this._outputChannel);
		this.autorestHelper = new AutorestHelper(this._outputChannel);
	}

	public getDashboardPublishData(projectFile: string): (string | dataworkspace.IconCellValue)[][] {
		const infoRows: (string | dataworkspace.IconCellValue)[][] = [];

		for (let i = this.publishInfo.length - 1; i >= 0; i--) {
			if (this.publishInfo[i].projectFile === projectFile) {
				let icon: azdataType.IconPath;
				let text: string;
				if (this.publishInfo[i].status === Status.success) {
					icon = IconPathHelper.success;
					text = constants.Success;
				} else if (this.publishInfo[i].status === Status.failed) {
					icon = IconPathHelper.error;
					text = constants.Failed;
				} else {
					icon = IconPathHelper.inProgress;
					text = constants.InProgress;
				}

				let infoRow: (string | dataworkspace.IconCellValue)[] = [{ text: text, icon: icon },
				this.publishInfo[i].startDate,
				this.publishInfo[i].timeToCompleteAction,
				this.publishInfo[i].target,
				this.publishInfo[i].targetServer,
				this.publishInfo[i].targetDatabase];
				infoRows.push(infoRow);
			}
		}

		return infoRows;
	}

	public getDashboardBuildData(projectFile: string): (string | dataworkspace.IconCellValue)[][] {
		const infoRows: (string | dataworkspace.IconCellValue)[][] = [];

		for (let i = this.buildInfo.length - 1; i >= 0; i--) {
			if (this.buildInfo[i].projectFile === projectFile) {
				let icon: azdataType.IconPath;
				let text: string;
				if (this.buildInfo[i].status === Status.success) {
					icon = IconPathHelper.success;
					text = constants.Success;
				} else if (this.buildInfo[i].status === Status.failed) {
					icon = IconPathHelper.error;
					text = constants.Failed;
				} else {
					icon = IconPathHelper.inProgress;
					text = constants.InProgress;
				}

				let infoRow: (string | dataworkspace.IconCellValue)[] = [{ text: text, icon: icon },
				this.buildInfo[i].startDate,
				this.buildInfo[i].timeToCompleteAction,
				this.buildInfo[i].target];
				infoRows.push(infoRow);
			}
		}

		return infoRows;
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
			throw new Error(constants.invalidGuid(creationParams.projectGuid));
		}

		if (creationParams.targetPlatform && !constants.targetPlatformToVersion.get(creationParams.targetPlatform)) {
			throw new Error(constants.invalidTargetPlatform(creationParams.targetPlatform, Array.from(constants.targetPlatformToVersion.keys())));
		}

		const macroDict: Record<string, string> = {
			'PROJECT_NAME': creationParams.newProjName,
			'PROJECT_GUID': creationParams.projectGuid ?? UUID.generateUuid().toUpperCase(),
			'PROJECT_DSP': creationParams.targetPlatform ? constants.targetPlatformToVersion.get(creationParams.targetPlatform)! : constants.defaultDSP
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
		const currentBuildTimeInfo = `${startTime.toLocaleDateString()} ${constants.at} ${startTime.toLocaleTimeString()}`;

		let buildInfoNew = new DashboardData(project.projectFilePath, Status.inProgress, project.getProjectTargetVersion(), currentBuildTimeInfo);
		this.buildInfo.push(buildInfoNew);

		if (this.buildInfo.length - 1 === maxTableLength) {
			this.buildInfo.shift();		// Remove the first element to maintain the length
		}

		// Check mssql extension for project dlls (tracking issue #10273)
		await this.buildHelper.createBuildDirFolder();

		const options: ShellCommandOptions = {
			commandTitle: 'Build',
			workingDirectory: project.projectFolderPath,
			argument: this.buildHelper.constructBuildArguments(project.projectFilePath, this.buildHelper.extensionBuildDirPath)
		};

		try {
			await this.netCoreTool.runDotnetCommand(options);
			const timeToBuild = new Date().getTime() - startTime.getTime();

			const currentBuildIndex = this.buildInfo.findIndex(b => b.startDate === currentBuildTimeInfo);
			this.buildInfo[currentBuildIndex].status = Status.success;
			this.buildInfo[currentBuildIndex].timeToCompleteAction = utils.timeConversion(timeToBuild);

			TelemetryReporter.createActionEvent(TelemetryViews.ProjectController, TelemetryActions.build)
				.withAdditionalMeasurements({ duration: timeToBuild })
				.send();

			return project.dacpacOutputPath;
		} catch (err) {
			const timeToFailureBuild = new Date().getTime() - startTime.getTime();

			const currentBuildIndex = this.buildInfo.findIndex(b => b.startDate === currentBuildTimeInfo);
			this.buildInfo[currentBuildIndex].status = Status.failed;
			this.buildInfo[currentBuildIndex].timeToCompleteAction = utils.timeConversion(timeToFailureBuild);

			TelemetryReporter.createErrorEvent(TelemetryViews.ProjectController, TelemetryActions.build)
				.withAdditionalMeasurements({ duration: timeToFailureBuild })
				.send();

			const message = utils.getErrorMessage(err);
			if (err instanceof DotNetError) {
				void vscode.window.showErrorMessage(message);
			} else {
				void vscode.window.showErrorMessage(constants.projBuildFailed(message));
			}
			return '';
		}
	}

	/**
	 * Publishes a project to docker container
	 * @param treeNode a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public async publishToDockerContainer(context: Project | dataworkspace.WorkspaceTreeItem): Promise<void> {
		const project: Project = this.getProjectFromContext(context);
		try {
			let deployProfile = await launchPublishToDockerContainerQuickpick(project);
			if (deployProfile && deployProfile.deploySettings) {
				let connectionUri: string | undefined;
				if (deployProfile.localDbSetting) {
					void utils.showInfoMessageWithOutputChannel(constants.publishingProjectMessage, this._outputChannel);
					connectionUri = await this.deployService.deploy(deployProfile, project);
					if (connectionUri) {
						deployProfile.deploySettings.connectionUri = connectionUri;
					}
				}
				if (deployProfile.deploySettings.connectionUri) {
					const publishResult = await this.publishOrScriptProject(project, deployProfile.deploySettings, true);
					if (publishResult && publishResult.success) {
						if (deployProfile.localDbSetting) {
							await this.deployService.getConnection(deployProfile.localDbSetting, true, deployProfile.localDbSetting.dbName);
						}
						void vscode.window.showInformationMessage(constants.publishProjectSucceed);
					} else {
						void utils.showErrorMessageWithOutputChannel(constants.publishToContainerFailed, publishResult?.errorMessage || '', this._outputChannel);
					}
				} else {
					void utils.showErrorMessageWithOutputChannel(constants.publishToContainerFailed, constants.deployProjectFailedMessage, this._outputChannel);
				}
			}
		} catch (error) {
			void utils.showErrorMessageWithOutputChannel(constants.publishToContainerFailed, error, this._outputChannel);
		}
		return;
	}

	/**
	 * Builds and publishes a project
	 * @param treeNode a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public async publishProject(treeNode: dataworkspace.WorkspaceTreeItem): Promise<void>;
	/**
	 * Builds and publishes a project
	 * @param project Project to be built and published
	 */
	public async publishProject(project: Project): Promise<void>;
	public async publishProject(context: Project | dataworkspace.WorkspaceTreeItem): Promise<void> {
		const project: Project = this.getProjectFromContext(context);
		if (utils.getAzdataApi()) {
			let publishDatabaseDialog = this.getPublishDialog(project);

			publishDatabaseDialog.publish = async (proj, prof) => this.publishOrScriptProject(proj, prof, true);
			publishDatabaseDialog.generateScript = async (proj, prof) => this.publishOrScriptProject(proj, prof, false);
			publishDatabaseDialog.readPublishProfile = async (profileUri) => readPublishProfile(profileUri);

			publishDatabaseDialog.openDialog();

			return publishDatabaseDialog.waitForClose();
		} else {
			return launchPublishDatabaseQuickpick(project, this);
		}
	}

	/**
	 * Builds and either deploys or generates a deployment script for the specified project.
	 * @param project The project to deploy
	 * @param settings The settings used to configure the deployment
	 * @param publish Whether to publish the deployment or just generate a script
	 * @returns The DacFx result of the deployment
	 */
	public async publishOrScriptProject(project: Project, settings: IDeploySettings, publish: boolean): Promise<mssql.DacFxResult | undefined> {
		const telemetryProps: Record<string, string> = {};
		const telemetryMeasures: Record<string, number> = {};
		const buildStartTime = new Date().getTime();
		const dacpacPath = await this.buildProject(project);
		const buildEndTime = new Date().getTime();
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
		const dacFxService = await utils.getDacFxService();

		let result: mssql.DacFxResult;
		telemetryProps.profileUsed = (settings.profileUsed ?? false).toString();
		const currentDate = new Date();
		const actionStartTime = currentDate.getTime();
		const currentPublishTimeInfo = `${currentDate.toLocaleDateString()} ${constants.at} ${currentDate.toLocaleTimeString()}`;

		let publishInfoNew = new PublishData(project.projectFilePath, Status.inProgress, project.getProjectTargetVersion(), currentPublishTimeInfo, settings.databaseName, settings.serverName);
		this.publishInfo.push(publishInfoNew);

		if (this.publishInfo.length - 1 === maxTableLength) {
			this.publishInfo.shift();	// Remove the first element to maintain the length
		}

		try {
			const azdataApi = utils.getAzdataApi();
			if (publish) {
				telemetryProps.publishAction = 'deploy';
				if (azdataApi) {
					result = await (dacFxService as mssql.IDacFxService).deployDacpac(tempPath, settings.databaseName, true, settings.connectionUri, azdataApi.TaskExecutionMode.execute, settings.sqlCmdVariables, settings.deploymentOptions as mssql.DeploymentOptions);
				} else {
					// Have to cast to unknown first to get around compiler error since the mssqlVscode doesn't exist as an actual module at runtime
					result = await (dacFxService as mssqlVscode.IDacFxService).deployDacpac(tempPath, settings.databaseName, true, settings.connectionUri, TaskExecutionMode.execute as unknown as mssqlVscode.TaskExecutionMode, settings.sqlCmdVariables, settings.deploymentOptions as mssqlVscode.DeploymentOptions);
				}

			} else {
				telemetryProps.publishAction = 'generateScript';
				if (azdataApi) {
					result = await (dacFxService as mssql.IDacFxService).generateDeployScript(tempPath, settings.databaseName, settings.connectionUri, azdataApi.TaskExecutionMode.script, settings.sqlCmdVariables, settings.deploymentOptions as mssql.DeploymentOptions);
				} else {
					// Have to cast to unknown first to get around compiler error since the mssqlVscode doesn't exist as an actual module at runtime
					result = await (dacFxService as mssqlVscode.IDacFxService).generateDeployScript(tempPath, settings.databaseName, settings.connectionUri, TaskExecutionMode.script as unknown as mssqlVscode.TaskExecutionMode, settings.sqlCmdVariables, settings.deploymentOptions as mssqlVscode.DeploymentOptions);
				}

			}
		} catch (err) {
			const actionEndTime = new Date().getTime();
			const timeToFailurePublish = actionEndTime - actionStartTime;
			telemetryProps.actionDuration = timeToFailurePublish.toString();
			telemetryProps.totalDuration = (actionEndTime - buildStartTime).toString();

			TelemetryReporter.createErrorEvent(TelemetryViews.ProjectController, TelemetryActions.publishProject)
				.withAdditionalProperties(telemetryProps)
				.send();

			const currentPublishIndex = this.publishInfo.findIndex(d => d.startDate === currentPublishTimeInfo);
			this.publishInfo[currentPublishIndex].status = Status.failed;
			this.publishInfo[currentPublishIndex].timeToCompleteAction = utils.timeConversion(timeToFailurePublish);
			throw err;
		}
		const actionEndTime = new Date().getTime();
		const timeToPublish = actionEndTime - actionStartTime;
		telemetryProps.actionDuration = timeToPublish.toString();
		telemetryProps.totalDuration = (actionEndTime - buildStartTime).toString();

		const currentPublishIndex = this.publishInfo.findIndex(d => d.startDate === currentPublishTimeInfo);
		this.publishInfo[currentPublishIndex].status = result.success ? Status.success : Status.failed;
		this.publishInfo[currentPublishIndex].timeToCompleteAction = utils.timeConversion(timeToPublish);

		TelemetryReporter.createActionEvent(TelemetryViews.ProjectController, TelemetryActions.publishProject)
			.withAdditionalProperties(telemetryProps)
			.send();

		return result;
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

			void vscode.window.showErrorMessage(utils.getErrorMessage(err));
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
			void vscode.window.showErrorMessage(utils.getErrorMessage(err));
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
			void vscode.window.showErrorMessage(utils.getErrorMessage(err));

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
			void vscode.window.showErrorMessage(constants.unableToPerformAction(constants.excludeAction, node.projectUri.path));
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

			void vscode.window.showErrorMessage(constants.unableToPerformAction(constants.deleteAction, node.projectUri.path));
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
		return project.files.find(x => utils.getPlatformSafeFileEntryPath(x.relativePath) === utils.getPlatformSafeFileEntryPath(utils.trimUri(context.root.projectUri, context.projectUri)));
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
					return this.reloadProject(context);
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
			void vscode.window.showErrorMessage(utils.getErrorMessage(err));
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
			void vscode.window.showInformationMessage(constants.currentTargetPlatform(project.projectFileName, constants.getTargetPlatformFromVersion(project.getProjectTargetVersion())));
		}
	}

	/**
	 * Adds a database reference to the project
	 * @param context a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public async addDatabaseReference(context: Project | dataworkspace.WorkspaceTreeItem): Promise<AddDatabaseReferenceDialog | undefined> {
		const project = this.getProjectFromContext(context);

		if (utils.getAzdataApi()) {
			const addDatabaseReferenceDialog = this.getAddDatabaseReferenceDialog(project);
			addDatabaseReferenceDialog.addReference = async (proj, settings) => await this.addDatabaseReferenceCallback(proj, settings, context as dataworkspace.WorkspaceTreeItem);

			await addDatabaseReferenceDialog.openDialog();
			return addDatabaseReferenceDialog;
		} else {
			const settings = await addDatabaseReferenceQuickpick(project);
			if (settings) {
				await this.addDatabaseReferenceCallback(project, settings, context as dataworkspace.WorkspaceTreeItem);
			}
			return undefined;
		}



	}

	/**
	 * Adds a database reference to a project, after selections have been made in the dialog
	 * @param project project to which to add the database reference
	 * @param settings settings for the database reference
	 * @param context a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public async addDatabaseReferenceCallback(project: Project, settings: AddDatabaseReferenceSettings, context: dataworkspace.WorkspaceTreeItem): Promise<void> {
		try {
			if ((<IProjectReferenceSettings>settings).projectName !== undefined) {
				// get project path and guid
				const projectReferenceSettings = settings as IProjectReferenceSettings;
				const workspaceProjects = await utils.getSqlProjectsInWorkspace();
				const referencedProject = await Project.openProject(workspaceProjects.filter(p => path.parse(p.fsPath).name === projectReferenceSettings.projectName)[0].fsPath);
				const relativePath = path.relative(project.projectFolderPath, referencedProject?.projectFilePath!);
				projectReferenceSettings.projectRelativePath = vscode.Uri.file(relativePath);
				projectReferenceSettings.projectGuid = referencedProject?.projectGuid!;

				const projectReferences = referencedProject?.databaseReferences.filter(r => r instanceof SqlProjectReferenceProjectEntry) ?? [];

				// check for cirular dependency
				for (let r of projectReferences) {
					if ((<SqlProjectReferenceProjectEntry>r).projectName === project.projectFileName) {
						void vscode.window.showErrorMessage(constants.cantAddCircularProjectReference(referencedProject?.projectFileName!));
						return;
					}
				}

				await project.addProjectReference(projectReferenceSettings);
			} else if ((<ISystemDatabaseReferenceSettings>settings).systemDb !== undefined) {
				await project.addSystemDatabaseReference(<ISystemDatabaseReferenceSettings>settings);
			} else {
				// update dacpacFileLocation to relative path to project file
				const dacpacRefSettings = settings as IDacpacReferenceSettings;
				dacpacRefSettings.dacpacFileLocation = vscode.Uri.file(path.relative(project.projectFolderPath, dacpacRefSettings.dacpacFileLocation.fsPath));
				await project.addDatabaseReference(dacpacRefSettings);
			}

			this.refreshProjectsTree(context);
		} catch (err) {
			void vscode.window.showErrorMessage(utils.getErrorMessage(err));
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

		const dacFxService = await utils.getDacFxService();
		const actionStartTime = new Date().getTime();

		const result: mssql.ValidateStreamingJobResult = await dacFxService.validateStreamingJob(dacpacPath, streamingJobDefinition);

		const duration = new Date().getTime() - actionStartTime;
		telemetryProps.success = result.success.toString();

		if (result.success) {
			void vscode.window.showInformationMessage(constants.externalStreamingJobValidationPassed);
		}
		else {
			void vscode.window.showErrorMessage(result.errorMessage);
		}

		TelemetryReporter.createActionEvent(TelemetryViews.ProjectTree, TelemetryActions.runStreamingJobValidation)
			.withAdditionalProperties(telemetryProps)
			.withAdditionalMeasurements({ duration: duration })
			.send();

		return result;
	}

	public async selectAutorestSpecFile(): Promise<string | undefined> {
		let quickpickSelection = await vscode.window.showQuickPick(
			[constants.browseEllipsisWithIcon],
			{ title: constants.selectSpecFile, ignoreFocusOut: true });
		if (!quickpickSelection) {
			return;
		}

		const filters: { [name: string]: string[] } = {};
		filters[constants.specSelectionText] = constants.openApiSpecFileExtensions;

		let uris = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			openLabel: constants.selectString,
			filters: filters,
			title: constants.selectSpecFile
		});

		if (!uris) {
			return;
		}

		return uris[0].fsPath;
	}

	/**
	 * @returns \{ newProjectFolder: 'C:\Source\MyProject',
	 * 			outputFolder: 'C:\Source',
	 * 			projectName: 'MyProject'}
	 */
	public async selectAutorestProjectLocation(projectName: string): Promise<{ newProjectFolder: string, outputFolder: string, projectName: string } | undefined> {
		let valid = false;
		let newProjectFolder: string = '';
		let outputFolder: string = '';

		let quickpickSelection = await vscode.window.showQuickPick(
			[constants.browseEllipsisWithIcon],
			{ title: constants.selectProjectLocation, ignoreFocusOut: true });
		if (!quickpickSelection) {
			return;
		}

		while (!valid) {
			const folders = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: constants.selectString,
				defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
				title: constants.selectProjectLocation
			});

			if (!folders) {
				return;
			}

			outputFolder = folders[0].fsPath;

			newProjectFolder = path.join(outputFolder, projectName);

			if (await utils.exists(newProjectFolder)) {

				quickpickSelection = await vscode.window.showQuickPick(
					[constants.browseEllipsisWithIcon],
					{ title: constants.folderAlreadyExistsChooseNewLocation(newProjectFolder), ignoreFocusOut: true });
				if (!quickpickSelection) {
					return;
				}
			} else {
				valid = true;
			}
		}

		return { newProjectFolder, outputFolder, projectName };
	}

	public async generateAutorestFiles(specPath: string, newProjectFolder: string): Promise<string | undefined> {
		await fs.mkdir(newProjectFolder, { recursive: true });

		return vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: constants.generatingProjectFromAutorest(path.basename(specPath)),
				cancellable: false
			}, async (_progress, _token) => {
				return this.autorestHelper.generateAutorestFiles(specPath, newProjectFolder);
			});
	}

	public async openProjectInWorkspace(projectFilePath: string): Promise<void> {
		const workspaceApi = utils.getDataWorkspaceExtensionApi();
		await workspaceApi.validateWorkspace();
		await workspaceApi.addProjectsToWorkspace([vscode.Uri.file(projectFilePath)]);

		workspaceApi.showProjectsView();
	}

	public async promptForAutorestProjectName(defaultName?: string): Promise<string | undefined> {
		let name: string | undefined = await vscode.window.showInputBox({
			ignoreFocusOut: true,
			prompt: constants.autorestProjectName,
			value: defaultName,
			validateInput: (value) => {
				return value.trim() ? undefined : constants.nameMustNotBeEmpty;
			}
		});

		if (name === undefined) {
			return; // cancelled by user
		}

		name = name.trim();

		return name;
	}

	public async generateProjectFromOpenApiSpec(): Promise<Project | undefined> {
		try {
			// 1. select spec file
			const specPath: string | undefined = await this.selectAutorestSpecFile();
			if (!specPath) {
				return;
			}

			// 2. prompt for project name
			const projectName = await this.promptForAutorestProjectName(path.basename(specPath, path.extname(specPath)));
			if (!projectName) {
				return;
			}

			// 3. select location, make new folder
			const projectInfo = await this.selectAutorestProjectLocation(projectName!);
			if (!projectInfo) {
				return;
			}

			// 4. run AutoRest to generate .sql files
			const result = await this.generateAutorestFiles(specPath, projectInfo.newProjectFolder);
			if (!result) { // user canceled operation when choosing how to run autorest
				return;
			}

			const fileFolderList: vscode.Uri[] | undefined = await this.getSqlFileList(projectInfo.newProjectFolder);

			if (!fileFolderList || fileFolderList.length === 0) {
				void vscode.window.showInformationMessage(constants.noSqlFilesGenerated);
				this._outputChannel.show();
				return;
			}

			// 5. create new SQL project
			const newProjFilePath = await this.createNewProject({
				newProjName: projectInfo.projectName,
				folderUri: vscode.Uri.file(projectInfo.outputFolder),
				projectTypeId: constants.emptySqlDatabaseProjectTypeId
			});

			const project = await Project.openProject(newProjFilePath);

			// 6. add generated files to SQL project
			await project.addToProject(fileFolderList.filter(f => !f.fsPath.endsWith(constants.autorestPostDeploymentScriptName))); // Add generated file structure to the project

			const postDeploymentScript: vscode.Uri | undefined = this.findPostDeploymentScript(fileFolderList);

			if (postDeploymentScript) {
				await project.addScriptItem(path.relative(project.projectFolderPath, postDeploymentScript.fsPath), undefined, templates.postDeployScript);
			}

			// 7. add project to workspace and open
			await this.openProjectInWorkspace(newProjFilePath);

			return project;
		} catch (err) {
			void vscode.window.showErrorMessage(constants.generatingProjectFailed(utils.getErrorMessage(err)));
			this._outputChannel.show();
			return;
		}
	}

	private findPostDeploymentScript(files: vscode.Uri[]): vscode.Uri | undefined {
		// Locate the post-deployment script generated by autorest, if one exists.
		// It's only generated if enums are present in spec, b/c the enum values need to be inserted into the generated table.
		// Because autorest is executed via command rather than API, we can't easily "receive" the name of the script,
		// so we're stuck just matching on a file name.
		const results = files.filter(f => f.fsPath.endsWith(constants.autorestPostDeploymentScriptName));

		switch (results.length) {
			case 0:
				return undefined;
			case 1:
				return results[0];
			default:
				throw new Error(constants.multipleMostDeploymentScripts(results.length));
		}
	}

	private async getSqlFileList(folder: string): Promise<vscode.Uri[] | undefined> {
		if (!(await utils.exists(folder))) {
			return undefined;
		}

		const entries = await fs.readdir(folder, { withFileTypes: true });

		const folders = entries.filter(dir => dir.isDirectory()).map(dir => path.join(folder, dir.name));
		const files = entries.filter(file => !file.isDirectory() && path.extname(file.name) === constants.sqlFileExtension).map(file => vscode.Uri.file(path.join(folder, file.name)));

		for (const folder of folders) {
			files.push(...(await this.getSqlFileList(folder) ?? []));
		}

		return files;
	}

	//#region Helper methods

	public getPublishDialog(project: Project): PublishDatabaseDialog {
		return new PublishDatabaseDialog(project);
	}

	public getAddDatabaseReferenceDialog(project: Project): AddDatabaseReferenceDialog {
		return new AddDatabaseReferenceDialog(project);
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
			throw new Error(constants.unexpectedProjectContext(context.projectUri.path));
		}
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
			ignoreFocusOut: true,
		});

		return itemObjectName;
	}

	private getRelativePath(treeNode: BaseProjectTreeItem): string {
		return treeNode instanceof FolderNode ? utils.trimUri(treeNode.root.projectUri, treeNode.projectUri) : '';
	}

	/**
	 * Creates a new SQL database project from the existing database,
	 * prompting the user for a name, file path location and extract target
	 */
	public async createProjectFromDatabase(context: azdataType.IConnectionProfile | mssqlVscode.ITreeNodeInfo | undefined): Promise<CreateProjectFromDatabaseDialog | undefined> {
		const profile = this.getConnectionProfileFromContext(context);
		if (utils.getAzdataApi()) {
			let createProjectFromDatabaseDialog = this.getCreateProjectFromDatabaseDialog(profile as azdataType.IConnectionProfile);

			createProjectFromDatabaseDialog.createProjectFromDatabaseCallback = async (model) => await this.createProjectFromDatabaseCallback(model);

			await createProjectFromDatabaseDialog.openDialog();

			return createProjectFromDatabaseDialog;
		} else {
			if (context) {
				// The profile we get from VS Code is for the overall server connection and isn't updated based on the database node
				// the command was launched from like it is in ADS. So get the actual database name from the MSSQL extension and
				// update the connection info here.
				const treeNodeContext = context as mssqlVscode.ITreeNodeInfo;
				const databaseName = (await utils.getVscodeMssqlApi()).getDatabaseNameFromTreeNode(treeNodeContext);
				(profile as mssqlVscode.IConnectionInfo).database = databaseName;
			}
			const model = await createNewProjectFromDatabaseWithQuickpick(profile as mssqlVscode.IConnectionInfo);
			if (model) {
				await this.createProjectFromDatabaseCallback(model);
			}
			return undefined;
		}

	}

	public getCreateProjectFromDatabaseDialog(profile: azdataType.IConnectionProfile | undefined): CreateProjectFromDatabaseDialog {
		return new CreateProjectFromDatabaseDialog(profile);
	}

	public async createProjectFromDatabaseCallback(model: ImportDataModel) {
		try {
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
			const workspaceApi = utils.getDataWorkspaceExtensionApi();
			workspaceApi.showProjectsView();
			await workspaceApi.addProjectsToWorkspace([vscode.Uri.file(newProjFilePath)]);
		} catch (err) {
			void vscode.window.showErrorMessage(utils.getErrorMessage(err));
		}
	}

	public setFilePath(model: ImportDataModel) {
		if (model.extractTarget === mssql.ExtractTarget.file) {
			model.filePath = path.join(model.filePath, `${model.projName}.sql`); // File extractTarget specifies the exact file rather than the containing folder
		}
	}

	private getConnectionProfileFromContext(context: azdataType.IConnectionProfile | mssqlVscode.ITreeNodeInfo | undefined): azdataType.IConnectionProfile | mssqlVscode.IConnectionInfo | undefined {
		if (!context) {
			return undefined;
		}

		// depending on where import new project is launched from, the connection profile could be passed as just
		// the profile or it could be wrapped in another object
		return (<any>context)?.connectionProfile ?? (context as mssqlVscode.ITreeNodeInfo).connectionInfo ?? context;
	}

	public async createProjectFromDatabaseApiCall(model: ImportDataModel): Promise<void> {
		const service = await utils.getDacFxService();
		const azdataApi = utils.getAzdataApi();

		if (azdataApi) {
			await (service as mssql.IDacFxService).createProjectFromDatabase(model.database, model.filePath, model.projName, model.version, model.connectionUri, model.extractTarget as mssql.ExtractTarget, azdataApi.TaskExecutionMode.execute);
		} else {
			await (service as mssqlVscode.IDacFxService).createProjectFromDatabase(model.database, model.filePath, model.projName, model.version, model.connectionUri, model.extractTarget as mssqlVscode.ExtractTarget, TaskExecutionMode.execute as unknown as mssqlVscode.TaskExecutionMode);
		}
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
				void vscode.window.showErrorMessage(constants.cannotResolvePath(absolutePath));
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
	targetPlatform?: SqlTargetPlatform;
}
