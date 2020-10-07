/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IExtension } from 'dataworkspace';
import { WorkspaceService } from '../services/workspaceService';
import { CreateWorkspace, OpenWorkspace, WorkspaceRequiredMessage } from './constants';

export class DataWorkspaceExtension implements IExtension {
	constructor(private workspaceService: WorkspaceService) {
	}

	getProjectsInWorkspace(): vscode.Uri[] {
		return this.workspaceService.getProjectsInWorkspace();
	}

	addProjectsToWorkspace(projectFiles: vscode.Uri[]): Promise<void> {
		return this.workspaceService.addProjectsToWorkspace(projectFiles);
	}

	showProjectsView(): void {
		vscode.commands.executeCommand('dataworkspace.views.main.focus');
	}

	async showWorkspaceRequiredNotification(): Promise<void> {
		const result = await vscode.window.showErrorMessage(WorkspaceRequiredMessage, CreateWorkspace, OpenWorkspace);
		if (result === CreateWorkspace) {
			vscode.commands.executeCommand('workbench.action.saveWorkspaceAs');
		} else if (result === OpenWorkspace) {
			vscode.commands.executeCommand('workbench.action.openWorkspace');
		}
	}
}
