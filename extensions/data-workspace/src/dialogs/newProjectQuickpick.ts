/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../common/constants';
import { directoryExist } from '../common/utils';
import { defaultProjectSaveLocation } from '../common/projectLocationHelper';
import { WorkspaceService } from '../services/workspaceService';

/**
 * Create flow for a New Project using only VS Code-native APIs such as QuickPick
 */
export async function createNewProjectWithQuickpick(workspaceService: WorkspaceService): Promise<void> {
	// Refresh list of project types
	const projectTypes = (await workspaceService.getAllProjectTypes()).map(projType => {
		return {
			label: projType.displayName,
			description: projType.description,
			id: projType.id
		} as vscode.QuickPickItem & { id: string };
	});

	// 1. Prompt for project type
	const projectType = await vscode.window.showQuickPick(projectTypes, { title: constants.SelectProjectType, ignoreFocusOut: true });
	if (!projectType) {
		return;
	}

	// 2. Prompt for project name
	const projectName = await vscode.window.showInputBox(
		{
			title: constants.EnterProjectName,
			validateInput: (value) => {
				return value ? undefined : constants.NameCannotBeEmpty;
			},
			ignoreFocusOut: true
		});
	if (!projectName) {
		return;
	}

	// 3. Prompt for Project location
	// Show quick pick with just browse option to give user context about what the file dialog is for (since that doesn't always have a title)
	const browseProjectLocation = await vscode.window.showQuickPick(
		[constants.BrowseEllipsisWithIcon],
		{ title: constants.SelectProjectLocation, ignoreFocusOut: true });
	if (!browseProjectLocation) {
		return;
	}
	// We validate that the folder doesn't already exist, and if it does keep prompting them to pick a new one
	let valid = false;
	let projectLocation = '';
	while (!valid) {
		const locations = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: constants.Select,
			title: constants.SelectProjectLocation,
			defaultUri: defaultProjectSaveLocation()
		});
		if (!locations) {
			return;
		}
		projectLocation = locations[0].fsPath;
		const exists = await directoryExist(path.join(projectLocation, projectName));
		if (exists) {
			// Show the browse quick pick again with the title updated with the error
			const browseProjectLocation = await vscode.window.showQuickPick(
				[constants.BrowseEllipsisWithIcon],
				{ title: constants.ProjectDirectoryAlreadyExistErrorShort(projectName), ignoreFocusOut: true });
			if (!browseProjectLocation) {
				return;
			}
		} else {
			valid = true;
		}
	}

	await workspaceService.createProject(projectName, vscode.Uri.file(projectLocation), projectType.id, undefined);
}
