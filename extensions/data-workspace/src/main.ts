/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { WorkspaceTreeDataProvider } from './common/workspaceTreeDataProvider';
import { WorkspaceService } from './services/workspaceService';
import { WorkspaceTreeItem, IExtension } from 'dataworkspace';
import { DataWorkspaceExtension } from './common/dataWorkspaceExtension';
import { NewProjectDialog } from './dialogs/newProjectDialog';
import { OpenProjectDialog } from './dialogs/openProjectDialog';

export function activate(context: vscode.ExtensionContext): Promise<IExtension> {
	const workspaceService = new WorkspaceService(context);
	const workspaceTreeDataProvider = new WorkspaceTreeDataProvider(workspaceService);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('dataworkspace.views.main', workspaceTreeDataProvider));
	context.subscriptions.push(vscode.commands.registerCommand('projects.newProject', async () => {
		const dialog = new NewProjectDialog(workspaceService);
		dialog.open();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('projects.openProject', async () => {
		const dialog = new OpenProjectDialog(workspaceService, context);
		dialog.open();
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
