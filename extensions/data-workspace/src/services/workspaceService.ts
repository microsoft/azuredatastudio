/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as dataworkspace from 'dataworkspace';
import * as path from 'path';
import { IWorkspaceService } from '../common/interfaces';
import { ProjectProviderRegistry } from '../common/projectProviderRegistry';
import Logger from '../common/logger';
import { ExtensionActivationErrorMessage } from '../common/constants';

const WorkspaceConfigurationName = 'dataworkspace';
const ProjectsConfigurationName = 'projects';

export class WorkspaceService implements IWorkspaceService {
	async addProjectsToWorkspace(projectFiles: vscode.Uri[]): Promise<void> {
		if (vscode.workspace.workspaceFile) {
			const currentProjects: vscode.Uri[] = await this.getProjectsInWorkspace();
			const newWorkspaceFolders: string[] = [];
			let newProjectFileAdded = false;
			for (const projectFile of projectFiles) {
				if (currentProjects.findIndex((p: vscode.Uri) => p.fsPath === projectFile.fsPath) === -1) {
					currentProjects.push(projectFile);
					newProjectFileAdded = true;

					// if the relativePath and the original path is the same, that means the project file is not under
					// any workspace folders, we should add the parent folder of the project file to the workspace
					const relativePath = vscode.workspace.asRelativePath(projectFile, false);
					if (vscode.Uri.file(relativePath).fsPath === projectFile.fsPath) {
						newWorkspaceFolders.push(path.dirname(projectFile.path));
					}
				}
			}

			if (newProjectFileAdded) {
				// Save the new set of projects to the workspace configuration.
				await this.setWorkspaceConfigurationValue(ProjectsConfigurationName, currentProjects.map(project => this.toRelativePath(project)));
			}

			if (newWorkspaceFolders.length > 0) {
				// second parameter is null means don't remove any workspace folders
				vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders!.length, null, ...(newWorkspaceFolders.map(folder => ({ uri: vscode.Uri.file(folder) }))));
			}
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

	async getProjectsInWorkspace(): Promise<vscode.Uri[]> {
		return vscode.workspace.workspaceFile ? this.getWorkspaceConfigurationValue<string[]>(ProjectsConfigurationName).map(project => this.toUri(project)) : [];
	}

	async getProjectProvider(projectFile: vscode.Uri): Promise<dataworkspace.IProjectProvider | undefined> {
		const projectType = path.extname(projectFile.path).replace(/\./g, '');
		let provider = ProjectProviderRegistry.getProviderByProjectType(projectType);
		if (!provider) {
			await this.ensureProviderExtensionLoaded(projectType);
		}
		return ProjectProviderRegistry.getProviderByProjectType(projectType);
	}

	/**
	 * Ensure the project provider extension for the specified project is loaded
	 * @param projectType The file extension of the project, if not specified, all project provider extensions will be loaded.
	 */
	private async ensureProviderExtensionLoaded(projectType: string | undefined = undefined): Promise<void> {
		const inactiveExtensions = vscode.extensions.all.filter(ext => !ext.isActive);
		const projType = projectType ? projectType.toUpperCase() : undefined;
		let extension: vscode.Extension<any>;
		for (extension of inactiveExtensions) {
			const projectTypes = extension.packageJSON.contributes && extension.packageJSON.contributes.projects as string[];
			// Process only when this extension is contributing project providers
			if (projectTypes && projectTypes.length > 0) {
				if (projType) {
					if (projectTypes.findIndex((proj: string) => proj.toUpperCase() === projType) !== -1) {
						await this.activateExtension(extension);
						break;
					}
				} else {
					await this.activateExtension(extension);
				}
			}
		}
	}

	private async activateExtension(extension: vscode.Extension<any>): Promise<void> {
		try {
			await extension.activate();
		} catch (err) {
			Logger.error(ExtensionActivationErrorMessage(extension.id, err));
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
