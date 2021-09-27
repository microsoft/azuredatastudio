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
import { Deferred } from '../common/promise';
import { getAzdataApi } from '../common/utils';

const WorkspaceConfigurationName = 'dataworkspace';
const ExcludedProjectsConfigurationName = 'excludedProjects';

export class WorkspaceService implements IWorkspaceService {
	private _onDidWorkspaceProjectsChange: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	readonly onDidWorkspaceProjectsChange: vscode.Event<void> = this._onDidWorkspaceProjectsChange?.event;

	private openedProjects: vscode.Uri[] | undefined = undefined;

	constructor() {
		this.getProjectsInWorkspace(undefined, true).catch(err => console.error('Error initializing projects in workspace ', err));
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
	 * Verify that a workspace is open or that if one isn't and we're running in ADS, it's ok to create a workspace and restart ADS
	 */
	async validateWorkspace(): Promise<boolean> {
		if (getAzdataApi() && (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0)) {
			const result = await vscode.window.showWarningMessage(constants.RestartConfirmation, { modal: true }, constants.OkButtonText);
			if (result === constants.OkButtonText) {
				return true;
			} else {
				return false;
			}
		} else {
			// workspace is open or we're running in VS Code. VS Code doesn't require reloading the window when creating a workspace or
			// adding the first item to an open workspace and so this check is unnecessary there.
			return true;
		}
	}

	public async addProjectsToWorkspace(projectFiles: vscode.Uri[]): Promise<void> {
		// 1. Include new workspace folders if any of the new projects' locations aren't already included

		const newWorkspaceFolders: string[] = [];

		for (const projectFile of projectFiles) {
			const relativePath = vscode.workspace.asRelativePath(projectFile, false);

			if (relativePath === undefined || vscode.Uri.file(relativePath).fsPath === projectFile.fsPath) {
				newWorkspaceFolders.push(path.dirname(projectFile.path));
			}
		}

		if (newWorkspaceFolders.length > 0) {
			// Add to the end of the workspace folders to avoid a restart of the extension host if we can
			vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders?.length || 0, undefined, ...(newWorkspaceFolders.map(folder => ({ uri: vscode.Uri.file(folder) }))));
		}

		// 2. Compare projcets being added against prior (cached) list of projects in the workspace

		const previousProjects: string[] = (await this.getProjectsInWorkspace(undefined, false)).map(p => p.path);
		let newProjectAdded: boolean = false;
		const projectsAlreadyOpen: string[] = [];

		for (const projectFile of projectFiles) {
			if (previousProjects.includes(projectFile.path)) {
				projectsAlreadyOpen.push(projectFile.fsPath);
				void vscode.window.showInformationMessage(constants.ProjectAlreadyOpened(projectFile.fsPath));
			}
			else {
				newProjectAdded = true;

				TelemetryReporter.createActionEvent(TelemetryViews.WorkspaceTreePane, TelemetryActions.ProjectAddedToWorkspace)
					.withAdditionalProperties({
						projectType: path.extname(projectFile.fsPath)
					}).send();
			}
		}

		// 3. Check if the project was previously excluded and remove it from the list of excluded projects if it was
		const excludedProjects = this.getWorkspaceConfigurationValue<string[]>(ExcludedProjectsConfigurationName);
		const updatedExcludedProjects = excludedProjects.filter(excludedProj => !projectFiles.find(newProj => vscode.workspace.asRelativePath(newProj) === excludedProj));
		if (excludedProjects.length !== updatedExcludedProjects.length) {
			await this.setWorkspaceConfigurationValue(ExcludedProjectsConfigurationName, updatedExcludedProjects);
		}

		// 4. If any new projects are detected, fire event to refresh projects tree
		if (newProjectAdded) {
			this._onDidWorkspaceProjectsChange.fire();
		}
	}

	public async getAllProjectTypes(): Promise<dataworkspace.IProjectType[]> {
		await this.ensureProviderExtensionLoaded();
		const projectTypes: dataworkspace.IProjectType[] = [];
		ProjectProviderRegistry.providers.forEach(provider => {
			projectTypes.push(...provider.supportedProjectTypes);
		});
		return projectTypes;
	}

	private getProjectsPromise: Deferred<void> | undefined = undefined;

	/**
	 * Returns all the projects in the workspace
	 * @param ext project extension to filter on. If this is passed in, this will only return projects with this file extension
	 * @param refreshFromDisk whether to rescan the folder for project files, or return the cached version. Defaults to false.
	 * @returns array of file URIs for projects
	 */
	public async getProjectsInWorkspace(ext?: string, refreshFromDisk: boolean = false): Promise<vscode.Uri[]> {

		if (refreshFromDisk || this.openedProjects === undefined) { // always check if nothing cached
			await this.refreshProjectsFromDisk();
		}

		if (this.openedProjects === undefined) {
			throw new Error(constants.openedProjectsUndefinedAfterRefresh);
		}

		// remove excluded projects specified in workspace file
		const excludedProjects = this.getWorkspaceConfigurationValue<string[]>(ExcludedProjectsConfigurationName);
		this.openedProjects = this.openedProjects.filter(project => !excludedProjects.find(excludedProject => excludedProject === vscode.workspace.asRelativePath(project)));

		// filter by specified extension
		if (ext) {
			return this.openedProjects.filter(p => p.fsPath.toLowerCase().endsWith(ext.toLowerCase()));
		} else {
			return this.openedProjects;
		}
	}

	private async refreshProjectsFromDisk(): Promise<void> {
		// Only allow one disk scan to be happening at a time
		if (this.getProjectsPromise) {
			return this.getProjectsPromise.promise;
		}

		this.getProjectsPromise = new Deferred();

		try {
			const projectPromises = vscode.workspace.workspaceFolders?.map(f => this.getAllProjectsInFolder(f.uri)) ?? [];
			this.openedProjects = (await Promise.all(projectPromises)).reduce((prev, curr) => prev.concat(curr), []);
			this.getProjectsPromise.resolve();
		} catch (err) {
			this.getProjectsPromise.reject(err);
			throw err;
		} finally {
			this.getProjectsPromise = undefined;
		}
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
			void vscode.commands.executeCommand('git.showOutput');
			const repositoryPath = await vscode.window.withProgress(
				opts,
				(progress, token) => gitApi.clone(url!, { parentPath: localClonePath!, progress, recursive: true }, token)
			);

			// get all the project files in the cloned repo and add them to workspace
			const repoProjects = (await this.getAllProjectsInFolder(vscode.Uri.file(repositoryPath)));
			await this.addProjectsToWorkspace(repoProjects);
		} catch (e) {
			void vscode.window.showErrorMessage(constants.gitCloneError);
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

	/**
	 * Adds the specified project to list of projects to hide in projects viewlet. This list is kept track of in the workspace file
	 * @param projectFile uri of project to remove from projects viewlet
	 */
	async removeProject(projectFile: vscode.Uri): Promise<void> {
		if (vscode.workspace.workspaceFile) {
			TelemetryReporter.createActionEvent(TelemetryViews.WorkspaceTreePane, TelemetryActions.ProjectRemovedFromWorkspace)
				.withAdditionalProperties({
					projectType: path.extname(projectFile.fsPath)
				}).send();

			let excludedProjects = this.getWorkspaceConfigurationValue<string[]>(ExcludedProjectsConfigurationName);
			excludedProjects.push(vscode.workspace.asRelativePath(projectFile.fsPath));
			await this.setWorkspaceConfigurationValue(ExcludedProjectsConfigurationName, [...new Set(excludedProjects)]);
			this._onDidWorkspaceProjectsChange.fire();
		}
	}

	getWorkspaceConfigurationValue<T>(configurationName: string): T {
		return vscode.workspace.getConfiguration(WorkspaceConfigurationName).get(configurationName) as T;
	}

	async setWorkspaceConfigurationValue(configurationName: string, value: any): Promise<void> {
		await vscode.workspace.getConfiguration(WorkspaceConfigurationName).update(configurationName, value, vscode.ConfigurationTarget.Workspace);
	}
}
