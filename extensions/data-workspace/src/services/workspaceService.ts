/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as dataworkspace from 'dataworkspace';
import * as path from 'path';
import * as constants from '../common/constants';
import * as glob from 'fast-glob';
import { IWorkspaceService } from '../common/interfaces';
import { ProjectProviderRegistry } from '../common/projectProviderRegistry';
import Logger from '../common/logger';
import { TelemetryReporter, TelemetryViews, calculateRelativity, TelemetryActions } from '../common/telemetry';

const WorkspaceConfigurationName = 'dataworkspace';
const ProjectsConfigurationName = 'projects';
const TempProject = 'tempProject';

export class WorkspaceService implements IWorkspaceService {
	private _onDidWorkspaceProjectsChange: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	readonly onDidWorkspaceProjectsChange: vscode.Event<void> = this._onDidWorkspaceProjectsChange?.event;

	constructor(private _context: vscode.ExtensionContext) {
	}

	/**
	 * Load any temp project that needed to be loaded before the extension host was restarted
	 * which would happen if a workspace was created in order open or create a project
	 */
	async loadTempProjects(): Promise<void> {
		const tempProjects: string[] | undefined = this._context.globalState.get(TempProject) ?? undefined;

		if (tempProjects && vscode.workspace.workspaceFile) {
			// add project to workspace now that the workspace has been created and saved
			for (let project of tempProjects) {
				await this.addProjectsToWorkspace([vscode.Uri.file(<string>project)]);
			}
			await this._context.globalState.update(TempProject, undefined);
		}
	}

	/**
	 * Creates a new workspace in the same folder as the project. Because the extension host gets restarted when
	 * a new workspace is created and opened, the project needs to be saved as the temp project that will be loaded
	 * when the extension gets restarted
	 * @param projectFileFsPath project to add to the workspace
	 */
	async CreateNewWorkspaceForProject(projectFileFsPath: string, workspaceFile: vscode.Uri | undefined): Promise<void> {
		// save temp project
		await this._context.globalState.update(TempProject, [projectFileFsPath]);

		// create a new workspace
		const projectFolder = vscode.Uri.file(path.dirname(projectFileFsPath));
		await azdata.workspace.createWorkspace(projectFolder, workspaceFile);
	}

	get isProjectProviderAvailable(): boolean {
		for (const extension of vscode.extensions.all) {
			const projectTypes = extension.packageJSON.contributes && extension.packageJSON.contributes.projects as string[];
			if (projectTypes && projectTypes.length > 0) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Verify that a workspace is open or that if one isn't, it's ok to create a workspace
	 */
	async validateWorkspace(): Promise<boolean> {
		if (!vscode.workspace.workspaceFile) {
			const result = await vscode.window.showWarningMessage(constants.CreateWorkspaceConfirmation, constants.OkButtonText, constants.CancelButtonText);
			if (result === constants.OkButtonText) {
				return true;
			} else {
				return false;
			}
		} else {
			// workspace is open
			return true;
		}
	}

	/**
	 * Shows confirmation message that the extension host will be restarted and current workspace/file will be closed. If confirmed, the specified workspace will be entered.
	 * @param workspaceFile
	 */
	async enterWorkspace(workspaceFile: vscode.Uri): Promise<void> {
		const result = await vscode.window.showWarningMessage(constants.EnterWorkspaceConfirmation, constants.OkButtonText, constants.CancelButtonText);
		if (result === constants.OkButtonText) {
			await azdata.workspace.enterWorkspace(workspaceFile);
		} else {
			return;
		}
	}

	async addProjectsToWorkspace(projectFiles: vscode.Uri[], workspaceFilePath?: vscode.Uri): Promise<void> {
		if (!projectFiles || projectFiles.length === 0) {
			return;
		}

		// a workspace needs to be open to add projects
		if (!vscode.workspace.workspaceFile) {
			await this.CreateNewWorkspaceForProject(projectFiles[0].fsPath, workspaceFilePath);

			// this won't get hit since the extension host will get restarted, but helps with testing
			return;
		}

		const currentProjects: vscode.Uri[] = this.getProjectsInWorkspace();
		const newWorkspaceFolders: string[] = [];
		let newProjectFileAdded = false;
		for (const projectFile of projectFiles) {
			if (currentProjects.findIndex((p: vscode.Uri) => p.fsPath === projectFile.fsPath) === -1) {
				currentProjects.push(projectFile);
				newProjectFileAdded = true;

				TelemetryReporter.createActionEvent(TelemetryViews.WorkspaceTreePane, TelemetryActions.ProjectAddedToWorkspace)
					.withAdditionalProperties({
						workspaceProjectRelativity: calculateRelativity(projectFile.fsPath),
						projectType: path.extname(projectFile.fsPath)
					}).send();

				// if the relativePath and the original path is the same, that means the project file is not under
				// any workspace folders, we should add the parent folder of the project file to the workspace
				const relativePath = vscode.workspace.asRelativePath(projectFile, false);
				if (vscode.Uri.file(relativePath).fsPath === projectFile.fsPath) {
					newWorkspaceFolders.push(path.dirname(projectFile.path));
				}
			} else {
				vscode.window.showInformationMessage(constants.ProjectAlreadyOpened(projectFile.fsPath));
			}
		}

		if (newProjectFileAdded) {
			// Save the new set of projects to the workspace configuration.
			await this.setWorkspaceConfigurationValue(ProjectsConfigurationName, currentProjects.map(project => this.toRelativePath(project)));
			this._onDidWorkspaceProjectsChange.fire();
		}

		if (newWorkspaceFolders.length > 0) {
			// second parameter is null means don't remove any workspace folders
			vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders!.length, null, ...(newWorkspaceFolders.map(folder => ({ uri: vscode.Uri.file(folder) }))));
		}
	}

	async getAllProjectTypes(): Promise<dataworkspace.IProjectType[]> {
		await this.ensureProviderExtensionLoaded();
		const projectTypes: dataworkspace.IProjectType[] = [];
		ProjectProviderRegistry.providers.forEach(provider => {
			projectTypes.push(...provider.supportedProjectTypes);
		});
		return projectTypes;
	}

	getProjectsInWorkspace(ext?: string): vscode.Uri[] {
		let projects = vscode.workspace.workspaceFile ? this.getWorkspaceConfigurationValue<string[]>(ProjectsConfigurationName).map(project => this.toUri(project)) : [];

		// filter by specified extension
		if (ext) {
			projects = projects.filter(p => p.fsPath.toLowerCase().endsWith(ext.toLowerCase()));
		}

		return projects;
	}

	/**
	 * Check for projects that are in the workspace folders but have not been added to the workspace through the dialog or by editing the .code-workspace file
	 */
	async checkForProjectsNotAddedToWorkspace(): Promise<void> {
		const config = vscode.workspace.getConfiguration(constants.projectsConfigurationKey);

		// only check if the user hasn't selected not to show this prompt again
		if (!config[constants.showNotAddedProjectsMessageKey]) {
			return;
		}

		// look for any projects that haven't been added to the workspace
		const projectsInWorkspace = this.getProjectsInWorkspace();
		const workspaceFolders = vscode.workspace.workspaceFolders;

		if (!workspaceFolders) {
			return;
		}

		for (const folder of workspaceFolders) {
			const results = await this.getAllProjectsInWorkspaceFolder(folder);

			let containsNotAddedProject = false;
			for (const projFile of results) {
				// if any of the found projects aren't already in the workspace's projects, we can stop checking and show the info message
				if (!projectsInWorkspace.find(p => p.fsPath === projFile)) {
					containsNotAddedProject = true;
					break;
				}
			}

			if (containsNotAddedProject) {
				const result = await vscode.window.showInformationMessage(constants.WorkspaceContainsNotAddedProjects, constants.LaunchOpenExisitingDialog, constants.DoNotShowAgain);
				if (result === constants.LaunchOpenExisitingDialog) {
					// open settings
					await vscode.commands.executeCommand('projects.openExisting');
				} else if (result === constants.DoNotShowAgain) {
					await config.update(constants.showNotAddedProjectsMessageKey, false, true);
				}

				return;
			}
		}
	}

	async getAllProjectsInWorkspaceFolder(folder: vscode.WorkspaceFolder): Promise<string[]> {
		// get the unique supported project extensions
		const supportedProjectExtensions = [...new Set((await this.getAllProjectTypes()).map(p => { return p.projectFileExtension; }))];

		// path needs to use forward slashes for glob to work
		const escapedPath = glob.escapePath(folder.uri.fsPath.replace(/\\/g, '/'));

		// can filter for multiple file extensions using folder/**/*.{sqlproj,csproj} format, but this notation doesn't work if there's only one extension
		// so the filter needs to be in the format folder/**/*.sqlproj if there's only one supported projectextension
		const projFilter = supportedProjectExtensions.length > 1 ? path.posix.join(escapedPath, '**', `*.{${supportedProjectExtensions.toString()}}`) : path.posix.join(escapedPath, '**', `*.${supportedProjectExtensions[0]}`);

		return await glob(projFilter);
	}

	async getProjectProvider(projectFile: vscode.Uri): Promise<dataworkspace.IProjectProvider | undefined> {
		const projectType = path.extname(projectFile.path).replace(/\./g, '');
		let provider = ProjectProviderRegistry.getProviderByProjectExtension(projectType);
		if (!provider) {
			await this.ensureProviderExtensionLoaded(projectType);
		}
		return ProjectProviderRegistry.getProviderByProjectExtension(projectType);
	}

	async removeProject(projectFile: vscode.Uri): Promise<void> {
		if (vscode.workspace.workspaceFile) {
			const currentProjects: vscode.Uri[] = this.getProjectsInWorkspace();
			const projectIdx = currentProjects.findIndex((p: vscode.Uri) => p.fsPath === projectFile.fsPath);
			if (projectIdx !== -1) {
				currentProjects.splice(projectIdx, 1);

				TelemetryReporter.createActionEvent(TelemetryViews.WorkspaceTreePane, TelemetryActions.ProjectRemovedFromWorkspace)
					.withAdditionalProperties({
						projectType: path.extname(projectFile.fsPath)
					}).send();

				await this.setWorkspaceConfigurationValue(ProjectsConfigurationName, currentProjects.map(project => this.toRelativePath(project)));
				this._onDidWorkspaceProjectsChange.fire();
			}
		}
	}

	async createProject(name: string, location: vscode.Uri, projectTypeId: string, workspaceFile?: vscode.Uri): Promise<vscode.Uri> {
		const provider = ProjectProviderRegistry.getProviderByProjectType(projectTypeId);
		if (provider) {
			const projectFile = await provider.createProject(name, location, projectTypeId);
			this.addProjectsToWorkspace([projectFile], workspaceFile);
			this._onDidWorkspaceProjectsChange.fire();
			return projectFile;
		} else {
			throw new Error(constants.ProviderNotFoundForProjectTypeError(projectTypeId));
		}
	}

	/**
	 * Ensure the project provider extension for the specified project is loaded
	 * @param projectType The file extension of the project, if not specified, all project provider extensions will be loaded.
	 */
	private async ensureProviderExtensionLoaded(projectType: string | undefined = undefined): Promise<void> {
		const projType = projectType ? projectType.toUpperCase() : undefined;
		let extension: vscode.Extension<any>;
		for (extension of vscode.extensions.all) {
			const projectTypes = extension.packageJSON.contributes && extension.packageJSON.contributes.projects as string[];
			// Process only when this extension is contributing project providers
			if (projectTypes && projectTypes.length > 0) {
				if (projType) {
					if (projectTypes.findIndex((proj: string) => proj.toUpperCase() === projType) !== -1) {
						await this.handleProjectProviderExtension(extension);
						break;
					}
				} else {
					await this.handleProjectProviderExtension(extension);
				}
			}
		}
	}

	private async handleProjectProviderExtension(extension: vscode.Extension<any>): Promise<void> {
		try {
			if (!extension.isActive) {
				await extension.activate();
			}
		} catch (err) {
			Logger.error(constants.ExtensionActivationError(extension.id, err));
		}

		if (extension.isActive && extension.exports && !ProjectProviderRegistry.providers.includes(extension.exports)) {
			ProjectProviderRegistry.registerProvider(extension.exports, extension.id);
		}
	}

	getWorkspaceConfigurationValue<T>(configurationName: string): T {
		return vscode.workspace.getConfiguration(WorkspaceConfigurationName).get(configurationName) as T;
	}

	async setWorkspaceConfigurationValue(configurationName: string, value: any): Promise<void> {
		await vscode.workspace.getConfiguration(WorkspaceConfigurationName).update(configurationName, value, vscode.ConfigurationTarget.Workspace);
	}

	/**
	 * Gets the relative path to the workspace file
	 * @param filePath the absolute path
	 */
	private toRelativePath(filePath: vscode.Uri): string {
		return path.relative(path.dirname(vscode.workspace.workspaceFile!.path!), filePath.path);
	}

	/**
	 * Gets the Uri of the given relative path
	 * @param relativePath the relative path
	 */
	private toUri(relativePath: string): vscode.Uri {
		const fullPath = path.join(path.dirname(vscode.workspace.workspaceFile!.path!), relativePath);
		return vscode.Uri.file(fullPath);
	}
}
