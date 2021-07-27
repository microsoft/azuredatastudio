/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IExtension, IProjectType } from 'dataworkspace';
import { WorkspaceService } from '../services/workspaceService';
import { defaultProjectSaveLocation } from './projectLocationHelper';
import { openSpecificProjectNewProjectDialog } from '../dialogs/newProjectDialog';

export class DataWorkspaceExtension implements IExtension {
	constructor(private workspaceService: WorkspaceService) {
	}

	getProjectsInWorkspace(ext?: string): Promise<vscode.Uri[]> {
		return this.workspaceService.getProjectsInWorkspace(ext);
	}

	addProjectsToWorkspace(projectFiles: vscode.Uri[]): Promise<void> {
		return this.workspaceService.addProjectsToWorkspace(projectFiles);
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

	openSpecificProjectNewProjectDialog(projectType: IProjectType): Promise<vscode.Uri | undefined> {
		return openSpecificProjectNewProjectDialog(projectType, this.workspaceService);
	}

}
