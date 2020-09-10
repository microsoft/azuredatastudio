/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as dataworkspace from 'dataworkspace';
import * as path from 'path';
import { IWorkspaceService } from '../common/interfaces';
import { ProjectProviderRegistry } from '../common/projectProviderRegistry';
import * as nls from 'vscode-nls';
import Logger from '../common/logger';

const localize = nls.loadMessageBundle();
const WorkspaceConfigurationName = 'dataworkspace';
const ProjectsConfigurationName = 'projects';

export class WorkspaceService implements IWorkspaceService {
	async getAllProjectTypes(): Promise<dataworkspace.IProjectType[]> {
		await this.ensureProviderExtensionLoaded();
		const projectTypes: dataworkspace.IProjectType[] = [];
		ProjectProviderRegistry.providers.forEach(provider => {
			projectTypes.push(...provider.supportedProjectTypes);
		});
		return projectTypes;
	}

	async getProjectsInWorkspace(): Promise<string[]> {
		if (vscode.workspace.workspaceFile) {
			const projects = <string[]>vscode.workspace.getConfiguration(WorkspaceConfigurationName).get(ProjectsConfigurationName);
			return projects.map(project => path.isAbsolute(project) ? project : path.join(vscode.workspace.rootPath!, project));
		}
		return [];
	}

	async getProjectProvider(projectFilePath: string): Promise<dataworkspace.IProjectProvider | undefined> {
		const projectType = path.extname(projectFilePath);
		let provider = ProjectProviderRegistry.getProviderByProjectType(projectType);
		if (!provider) {
			await this.ensureProviderExtensionLoaded(projectType);
		}
		return ProjectProviderRegistry.getProviderByProjectType(projectType);
	}

	/**
	 * Ensure the project provider extension for the specified project is loaded
	 * @param projectExtension The file extension of the project, if not specified, all project provider extensions will be loaded.
	 */
	private async ensureProviderExtensionLoaded(projectExtension: string | undefined = undefined): Promise<void> {
		const inactiveExtensions = vscode.extensions.all.filter(ext => !ext.isActive);
		const projectType = projectExtension ? projectExtension.toUpperCase() : undefined;
		let extension: vscode.Extension<any>;
		for (extension of inactiveExtensions) {
			const projectTypes = extension.packageJSON.contributes && extension.packageJSON.contributes.projects as string[];
			// Process only when this extension is contributing project providers
			if (projectTypes && projectTypes.length > 0) {
				if (projectType) {
					if (projectTypes.findIndex((proj: string) => proj.toUpperCase() === projectType) !== -1) {
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
			Logger.error(localize('activateExtensionFailed', "Failed to load the project provider extension '{0}'. Error message: {1}", extension.id, err.message ?? err));
		}
	}
}
