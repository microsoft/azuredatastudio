/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceTreeDataProvider } from './common/workspaceTreeDataProvider';
import { WorkspaceService } from './services/workspaceService';
import { AllProjectTypes, SelectProjectFileActionName } from './common/constants';
import { WorkspaceTreeItem, IExtension } from 'dataworkspace';
import { DataWorkspaceExtension } from './common/dataWorkspaceExtension';

export function activate(context: vscode.ExtensionContext): Promise<IExtension> {
	const workspaceService = new WorkspaceService();
	const workspaceTreeDataProvider = new WorkspaceTreeDataProvider(workspaceService);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('dataworkspace.views.main', workspaceTreeDataProvider));
	context.subscriptions.push(vscode.commands.registerCommand('projects.addProject', async (uri: vscode.Uri) => {
		// To Sakshi - You can replace the implementation with your complete dialog implementation
		// but all the code here should be reusable by you
		if (vscode.workspace.workspaceFile) {
			if (uri) {
				await workspaceService.addProjectsToWorkspace([uri]);
			} else {
				const filters: { [name: string]: string[] } = {};
				const projectTypes = await workspaceService.getAllProjectTypes();
				filters[AllProjectTypes] = projectTypes.map(type => type.projectFileExtension);
				projectTypes.forEach(type => {
					filters[type.displayName] = [type.projectFileExtension];
				});
				let fileUris = await vscode.window.showOpenDialog({
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri: vscode.Uri.file(path.dirname(vscode.workspace.workspaceFile.path)),
					openLabel: SelectProjectFileActionName,
					filters: filters
				});
				if (!fileUris || fileUris.length === 0) {
					return;
				}
				await workspaceService.addProjectsToWorkspace(fileUris);
			}
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('dataworkspace.refresh', () => {
		workspaceTreeDataProvider.refresh();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('projects.removeProject', async (treeItem: WorkspaceTreeItem) => {
		await workspaceService.removeProject(vscode.Uri.file(treeItem.element.project.projectFilePath));
	}));

	const dataWorkspaceExtension = new DataWorkspaceExtension(workspaceService);
	return Promise.resolve(dataWorkspaceExtension);
}

export function deactivate(): void {
}
