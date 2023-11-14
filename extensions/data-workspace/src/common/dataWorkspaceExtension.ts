/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IExtension, IProjectType } from 'dataworkspace';
import { WorkspaceService } from '../services/workspaceService';
import { defaultProjectSaveLocation } from './projectLocationHelper';
import { openSpecificProjectNewProjectDialog } from '../dialogs/newProjectDialog';
import { isValidBasename, isValidBasenameErrorMessage, isValidFilenameCharacter, sanitizeStringForFilename } from './pathUtilsHelper';
import { noProjectProvidingExtensionsInstalled } from './constants';

export class DataWorkspaceExtension implements IExtension {
	constructor(private workspaceService: WorkspaceService) {
	}

	getProjectsInWorkspace(ext?: string, refreshFromDisk?: boolean): Promise<vscode.Uri[]> {
		return this.workspaceService.getProjectsInWorkspace(ext, refreshFromDisk);
	}

	addProjectsToWorkspace(projectFiles: vscode.Uri[]): Promise<void> {
		return this.workspaceService.addProjectsToWorkspace(projectFiles);
	}

	showProjectsView(): void {
		void vscode.commands.executeCommand('dataworkspace.views.main.focus');
	}

	refreshProjectsTree(): void {
		this.workspaceService.refreshProjectsTree();
	}

	get defaultProjectSaveLocation(): vscode.Uri | undefined {
		return defaultProjectSaveLocation();
	}

	validateWorkspace(): Promise<boolean> {
		return this.workspaceService.validateWorkspace();
	}

	openSpecificProjectNewProjectDialog(projectType: IProjectType): Promise<vscode.Uri | undefined> {
		if (!this.workspaceService.isProjectProviderAvailable) {
			void vscode.window.showErrorMessage(noProjectProvidingExtensionsInstalled);
		}

		return openSpecificProjectNewProjectDialog(projectType, this.workspaceService);
	}

	isValidFilenameCharacter(c: string): boolean {
		return isValidFilenameCharacter(c);
	}

	sanitizeStringForFilename(s: string): string {
		return sanitizeStringForFilename(s);
	}

	isValidBasename(name?: string): boolean {
		return isValidBasename(name);
	}

	isValidBasenameErrorMessage(name?: string): string | undefined {
		return isValidBasenameErrorMessage(name);
	}

}
