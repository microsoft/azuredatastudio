/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as dataworkspace from 'dataworkspace';
import { ProjectProviderRegistry } from './common/projectProviderRegistry';
import { WorkspaceTreeDataProvider } from './common/projectTreeDataProvider';
import { ProjectService } from './services/projectService';

export async function activate(context: vscode.ExtensionContext): Promise<dataworkspace.IExtension> {
	const projectService = new ProjectService();
	const workspaceTreeDataProvider = new WorkspaceTreeDataProvider(projectService);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('dataworkspace.views.main', workspaceTreeDataProvider));
	context.subscriptions.push(vscode.commands.registerCommand('projects.addProject', () => {
	}));

	context.subscriptions.push(vscode.commands.registerCommand('dataworkspace.refresh', () => {
		workspaceTreeDataProvider.refresh();
	}));

	return {
		registerProjectProvider: (provider: dataworkspace.IProjectProvider): vscode.Disposable => {
			return ProjectProviderRegistry.registerProvider(provider);
		}
	};
}

export function deactivate(): void {
}
