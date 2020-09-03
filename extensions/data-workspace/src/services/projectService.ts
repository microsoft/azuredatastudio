/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as dataworkspace from 'dataworkspace';
import * as path from 'path';
import { IProjectService } from '../common/interfaces';
import { ProjectProviderRegistry } from '../common/projectProviderRegistry';

const WorkspaceConfigurationName = 'dataworkspace';
const ProjectsConfigurationName = 'projects';

export class ProjectService implements IProjectService {
	async getProjectTypes(): Promise<dataworkspace.IProjectType[]> {
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
		await this.ensureProviderExtensionLoaded(path.extname(projectFilePath));
		const providers = ProjectProviderRegistry.providers;
		for (let i = 0; i < providers.length; i++) {
			if (providers[i].supportedProjectTypes.findIndex(pt => projectFilePath.toUpperCase().endsWith(pt.projectFileExtension.toUpperCase())) !== -1) {
				return providers[i];
			}
		}
		return undefined;
	}

	/**
	 * Ensure the project provider extension for the specified project is loaded
	 * @param projectExtension The file extension of the project, if not specified, all project provider extensions will be loaded.
	 */
	private async ensureProviderExtensionLoaded(projectExtension: string | undefined = undefined): Promise<void> {
		const inactiveExtensions = vscode.extensions.all.filter(ext => !ext.isActive);
		for (let index = 0; index < inactiveExtensions.length; index++) {
			const extension = inactiveExtensions[index];
			const projectTypes = extension.packageJSON.contributes && extension.packageJSON.contributes.projects as string[];
			if (projectTypes && projectTypes.length > 0) {
				if (projectExtension) {
					if (projectTypes.findIndex(proj => proj.toUpperCase() === projectExtension?.toUpperCase())) {
						await extension.activate();
						break;
					}
				} else {
					await extension.activate();
				}
			}
		}
	}
}
