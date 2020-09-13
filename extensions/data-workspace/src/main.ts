/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as dataworkspace from 'dataworkspace';
import { WorkspaceTreeDataProvider } from './common/workspaceTreeDataProvider';
import { WorkspaceService } from './services/workspaceService';
import { DataWorkspaceExtension } from './dataWorkspaceExtension';
import { SelectProjectFileActionName } from './common/constants';

export async function activate(context: vscode.ExtensionContext): Promise<dataworkspace.IExtension> {
	const workspaceService = new WorkspaceService();
	const workspaceTreeDataProvider = new WorkspaceTreeDataProvider(workspaceService);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('dataworkspace.views.main', workspaceTreeDataProvider));
	context.subscriptions.push(vscode.commands.registerCommand('projects.addProject', async () => {
		// To Sakshi - You can replace the implementation with your complete dialog implementation
		// but all the code here should be reusable by you
		if (vscode.workspace.workspaceFile) {
			const filter: { [name: string]: string[] } = {};
			const projectTypes = await workspaceService.getAllProjectTypes();
			projectTypes.forEach(type => {
				filter[type.displayName] = projectTypes.map(projectType => projectType.projectFileExtension);
			});
			let fileUris = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				defaultUri: vscode.Uri.file(path.dirname(vscode.workspace.workspaceFile.path)),
				openLabel: SelectProjectFileActionName,
				filters: filter
			});
			if (!fileUris || fileUris.length === 0) {
				return;
			}
			await workspaceService.addProjectsToWorkspace(fileUris);
			workspaceTreeDataProvider.refresh();
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('dataworkspace.refresh', () => {
		workspaceTreeDataProvider.refresh();
	}));

	return new DataWorkspaceExtension();
}

export function deactivate(): void {
}
