/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { WorkspaceTreeDataProvider } from './common/workspaceTreeDataProvider';
import { WorkspaceService } from './services/workspaceService';
import { WorkspaceTreeItem } from './common/interfaces';
import { OpenProjectDialog } from './dialogs/openProjectDialog';
import { IconPathHelper } from './common/iconHelper';

export function activate(context: vscode.ExtensionContext): void {
	const workspaceService = new WorkspaceService();
	const workspaceTreeDataProvider = new WorkspaceTreeDataProvider(workspaceService);
	const openProjectDialog = new OpenProjectDialog();
	context.subscriptions.push(vscode.window.registerTreeDataProvider('dataworkspace.views.main', workspaceTreeDataProvider));
	context.subscriptions.push(vscode.commands.registerCommand('projects.addProject', async () => {
		if (vscode.workspace.workspaceFile) {
			openProjectDialog.openProjectFromFile(workspaceService);
		}

	}));

	context.subscriptions.push(vscode.commands.registerCommand('dataworkspace.refresh', () => {
		workspaceTreeDataProvider.refresh();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('projects.removeProject', async (treeItem: WorkspaceTreeItem) => {
		await workspaceService.removeProject(vscode.Uri.file(treeItem.element.project.projectFilePath));
	}));

	IconPathHelper.setExtensionContext(context);
}

export function deactivate(): void {
}
