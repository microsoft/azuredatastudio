/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as dataworkspace from 'dataworkspace';
import * as path from 'path';
import * as git from '../../../git/src/api/git';
import * as constants from '../common/constants';
import * as glob from 'fast-glob';
import { IWorkspaceService } from '../common/interfaces';
import { ProjectProviderRegistry } from '../common/projectProviderRegistry';
import Logger from '../common/logger';
import { TelemetryReporter, TelemetryViews, TelemetryActions } from '../common/telemetry';

export class WorkspaceService implements IWorkspaceService {
	private _onDidWorkspaceProjectsChange: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	readonly onDidWorkspaceProjectsChange: vscode.Event<void> = this._onDidWorkspaceProjectsChange?.event;

	constructor() { }

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
	 * Verify that a workspace is open or that if one isn't, it's ok to create a workspace and restart ADS
	 */
	async validateWorkspace(): Promise<boolean> {
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			const result = await vscode.window.showWarningMessage(constants.RestartConfirmation, { modal: true }, constants.OkButtonText);
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

	async addProjectsToWorkspace(projectFiles: vscode.Uri[]): Promise<void> {
		if (!projectFiles || projectFiles.length === 0) {
			return;
		}

		const currentProjects: vscode.Uri[] = await this.getProjectsInWorkspace();
		const newWorkspaceFolders: string[] = [];
		let newProjectFileAdded = false;
		for (const projectFile of projectFiles) {
			if (currentProjects.findIndex((p: vscode.Uri) => p.fsPath === projectFile.fsPath) === -1) {
				currentProjects.push(projectFile);
				newProjectFileAdded = true;

				TelemetryReporter.createActionEvent(TelemetryViews.WorkspaceTreePane, TelemetryActions.ProjectAddedToWorkspace)
					.withAdditionalProperties({
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
			this._onDidWorkspaceProjectsChange.fire();
		}

		if (newWorkspaceFolders.length > 0) {
			// Add to the end of the workspace folders to avoid a restart of the extension host if we can
			vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders?.length || 0, undefined, ...(newWorkspaceFolders.map(folder => ({ uri: vscode.Uri.file(folder) }))));
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

	async getProjectsInWorkspace(ext?: string): Promise<vscode.Uri[]> {
		const projectPromises = vscode.workspace.workspaceFolders?.map(f => this.getAllProjectsInFolder(f.uri));
		if (!projectPromises) {
			return [];
		}
		let projects = (await Promise.all(projectPromises)).reduce((prev, curr) => prev.concat(curr), []);

		// filter by specified extension
		if (ext) {
			projects = projects.filter(p => p.fsPath.toLowerCase().endsWith(ext.toLowerCase()));
		}

		return projects;
	}

	/**
	 * Returns an array of all the supported projects in the folder
	 * @param folder folder to look look for projects
	 * @returns array of file URIs for supported projects
	 */
	async getAllProjectsInFolder(folder: vscode.Uri): Promise<vscode.Uri[]> {
		// get the unique supported project extensions
		const supportedProjectExtensions = [...new Set((await this.getAllProjectTypes()).map(p => { return p.projectFileExtension; }))];

		// path needs to use forward slashes for glob to work
		const escapedPath = glob.escapePath(folder.fsPath.replace(/\\/g, '/'));

		// can filter for multiple file extensions using folder/**/*.{sqlproj,csproj} format, but this notation doesn't work if there's only one extension
		// so the filter needs to be in the format folder/**/*.sqlproj if there's only one supported projectextension
		const projFilter = supportedProjectExtensions.length > 1 ? path.posix.join(escapedPath, '**', `*.{${supportedProjectExtensions.toString()}}`) : path.posix.join(escapedPath, '**', `*.${supportedProjectExtensions[0]}`);

		// glob will return an array of file paths with forward slashes, so they need to be converted back if on windows
		return (await glob(projFilter)).map(p => vscode.Uri.file(path.resolve(p)));
	}

	async getProjectProvider(projectFile: vscode.Uri): Promise<dataworkspace.IProjectProvider | undefined> {
		const projectType = path.extname(projectFile.path).replace(/\./g, '');
		let provider = ProjectProviderRegistry.getProviderByProjectExtension(projectType);
		if (!provider) {
			await this.ensureProviderExtensionLoaded(projectType);
		}
		return ProjectProviderRegistry.getProviderByProjectExtension(projectType);
	}

	async createProject(name: string, location: vscode.Uri, projectTypeId: string, projectTargetVersion?: string): Promise<vscode.Uri> {
		const provider = ProjectProviderRegistry.getProviderByProjectType(projectTypeId);
		if (provider) {
			const projectFile = await provider.createProject(name, location, projectTypeId, projectTargetVersion);
			await this.addProjectsToWorkspace([projectFile]);
			this._onDidWorkspaceProjectsChange.fire();
			return projectFile;
		} else {
			throw new Error(constants.ProviderNotFoundForProjectTypeError(projectTypeId));
		}
	}

	async gitCloneProject(url: string, localClonePath: string): Promise<void> {
		const gitApi: git.API = (<git.GitExtension>vscode.extensions.getExtension('vscode.git')!.exports).getAPI(1);
		const opts = {
			location: vscode.ProgressLocation.Notification,
			title: constants.gitCloneMessage(url),
			cancellable: true
		};

		try {
			// show git output channel
			vscode.commands.executeCommand('git.showOutput');
			const repositoryPath = await vscode.window.withProgress(
				opts,
				(progress, token) => gitApi.clone(url!, { parentPath: localClonePath!, progress, recursive: true }, token)
			);

			// get all the project files in the cloned repo and add them to workspace
			const repoProjects = (await this.getAllProjectsInFolder(vscode.Uri.file(repositoryPath)));
			this.addProjectsToWorkspace(repoProjects);
		} catch (e) {
			vscode.window.showErrorMessage(constants.gitCloneError);
			console.error(e);
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
}
