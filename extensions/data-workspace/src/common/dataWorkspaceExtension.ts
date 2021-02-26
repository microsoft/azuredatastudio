/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IExtension } from 'dataworkspace';
import { WorkspaceService } from '../services/workspaceService';
import { defaultProjectSaveLocation } from './projectLocationHelper';

export class DataWorkspaceExtension implements IExtension {
	constructor(private workspaceService: WorkspaceService) {
	}

	getProjectsInWorkspace(ext?: string): vscode.Uri[] {
		return this.workspaceService.getProjectsInWorkspace(ext);
	}

	addProjectsToWorkspace(projectFiles: vscode.Uri[], workspaceFilePath?: vscode.Uri): Promise<void> {
		return this.workspaceService.addProjectsToWorkspace(projectFiles, workspaceFilePath);
	}

	showProjectsView(): void {
		vscode.commands.executeCommand('dataworkspace.views.main.focus');
	}

	get defaultProjectSaveLocation(): vscode.Uri | undefined {
		return defaultProjectSaveLocation();
	}

	validateWorkspace(): Promise<boolean> {
		return this.workspaceService.validateWorkspace();
	}
}
