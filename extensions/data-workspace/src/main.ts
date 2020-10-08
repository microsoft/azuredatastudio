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
import { IWorkspaceService } from './common/interfaces';

let treeDataProviderDisposable: vscode.Disposable | undefined = undefined;

export function activate(context: vscode.ExtensionContext): Promise<IExtension> {
	const workspaceService = new WorkspaceService();
	const workspaceTreeDataProvider = new WorkspaceTreeDataProvider(workspaceService);
	const dataWorkspaceExtension = new DataWorkspaceExtension(workspaceService);
	context.subscriptions.push(vscode.extensions.onDidChange(() => {
		setTreeDataProvider(context, workspaceService, workspaceTreeDataProvider);
	}));
	setTreeDataProvider(context, workspaceService, workspaceTreeDataProvider);
	context.subscriptions.push(vscode.commands.registerCommand('projects.newProject', async () => {
		if (vscode.workspace.workspaceFile) {
			const dialog = new NewProjectDialog(workspaceService);
			dialog.open();
		} else {
			dataWorkspaceExtension.showWorkspaceRequiredNotification();
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('projects.openProject', async () => {
		if (vscode.workspace.workspaceFile) {
			const dialog = new OpenProjectDialog(workspaceService, context);
			dialog.open();
		} else {
			dataWorkspaceExtension.showWorkspaceRequiredNotification();
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('dataworkspace.refresh', () => {
		workspaceTreeDataProvider.refresh();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('projects.removeProject', async (treeItem: WorkspaceTreeItem) => {
		await workspaceService.removeProject(vscode.Uri.file(treeItem.element.project.projectFilePath));
	}));
	return Promise.resolve(dataWorkspaceExtension);
}

function setTreeDataProvider(context: vscode.ExtensionContext, workspaceService: IWorkspaceService, treeDataProvider: WorkspaceTreeDataProvider): void {
	const isProjectProviderAvailable = workspaceService.isProjectProviderAvailable;
	vscode.commands.executeCommand('setContext', 'isProjectProviderAvailable', isProjectProviderAvailable);
	if (isProjectProviderAvailable) {
		if (treeDataProviderDisposable) {
			treeDataProviderDisposable.dispose();
			const idx = context.subscriptions.findIndex(x => x === treeDataProviderDisposable);
			if (idx !== -1) {
				context.subscriptions.splice(idx, 1);
			}
		}
		treeDataProviderDisposable = vscode.window.registerTreeDataProvider('dataworkspace.views.main', treeDataProvider);
		context.subscriptions.push(treeDataProviderDisposable);
	}
}

export function deactivate(): void {
}
