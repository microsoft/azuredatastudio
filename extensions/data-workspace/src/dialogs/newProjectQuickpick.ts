/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../common/constants';
import { directoryExist, showInfoMessageWithLearnMoreLink } from '../common/utils';
import { defaultProjectSaveLocation } from '../common/projectLocationHelper';
import { WorkspaceService } from '../services/workspaceService';
import { isValidBasenameErrorMessage } from '../common/pathUtilsHelper';

/**
 * Create flow for a New Project using only VS Code-native APIs such as QuickPick
 */
export async function createNewProjectWithQuickpick(workspaceService: WorkspaceService): Promise<void> {
	// Refresh list of project types
	const projectTypes = (await workspaceService.getAllProjectTypes()).map(projType => {
		return {
			label: projType.displayName,
			description: projType.description,
			id: projType.id,
			targetPlatforms: projType.targetPlatforms,
			defaultTargetPlatform: projType.defaultTargetPlatform,
			sdkOption: projType.sdkStyleOption,
			sdkLearnMoreUrl: projType.sdkStyleLearnMoreUrl,
			learnMoreUrl: projType.learnMoreUrl
		} as vscode.QuickPickItem & { id: string, sdkOption?: boolean, targetPlatforms?: string[], defaultTargetPlatform?: string, sdkLearnMoreUrl?: string, learnMoreUrl?: string };
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
				return isValidBasenameErrorMessage(value);
			},
			ignoreFocusOut: true
		});
	if (!projectName) {
		return;
	}

	const defaultProjectSaveLoc = defaultProjectSaveLocation();
	const browseProjectLocationOptions = [constants.BrowseEllipsisWithIcon];

	// if there's an open folder, add it for easier access. If there are multiple folders in the workspace, default to the first one
	if (vscode.workspace.workspaceFolders) {
		browseProjectLocationOptions.unshift(vscode.workspace.workspaceFolders[0].uri.fsPath);
	}

	// add default project save location if it's been set
	if (defaultProjectSaveLoc) {
		browseProjectLocationOptions.unshift(defaultProjectSaveLoc.fsPath);
	}

	// 3. Prompt for Project location
	// We validate that the folder doesn't already exist, and if it does keep prompting them to pick a new one
	let projectLocation = '';
	let browseProjectLocationTitle = constants.SelectProjectLocation;
	while (true) {
		const browseProjectLocation = await vscode.window.showQuickPick(
			browseProjectLocationOptions,
			{ title: browseProjectLocationTitle, ignoreFocusOut: true });
		if (!browseProjectLocation) {
			// User cancelled
			return undefined;
		}
		if (browseProjectLocation === constants.BrowseEllipsisWithIcon) {
			const locations = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: constants.Select,
				title: constants.SelectProjectLocation,
				defaultUri: defaultProjectSaveLoc
			});
			if (!locations) {
				// User cancelled out of open dialog - let them choose location again
				browseProjectLocationTitle = constants.SelectProjectLocation;
				continue;
			}
			projectLocation = locations[0].fsPath;
		} else {
			projectLocation = browseProjectLocation;
		}
		const locationExists = await directoryExist(path.join(projectLocation, projectName));
		if (!locationExists) {
			// Have a valid location so exit out now
			break;
		}
		// Otherwise show the browse quick pick again with the title updated with the error
		browseProjectLocationTitle = constants.ProjectDirectoryAlreadyExistErrorShort(projectName);
		continue;
	}

	let targetPlatform;
	if (projectType.targetPlatforms) {
		// 4. Target platform of the project
		let targetPlatforms: vscode.QuickPickItem[] = projectType.targetPlatforms.map(targetPlatform => { return { label: targetPlatform }; });

		if (projectType.defaultTargetPlatform) {
			// move the default target platform to be the first one in the list
			const defaultIndex = targetPlatforms.findIndex(i => i.label === projectType.defaultTargetPlatform);
			if (defaultIndex > -1) {
				targetPlatforms.splice(defaultIndex, 1);
			}

			// add default next to the default target platform
			targetPlatforms.unshift({ label: projectType.defaultTargetPlatform, description: constants.Default });
		}

		const selectedTargetPlatform = await vscode.window.showQuickPick(targetPlatforms, { title: constants.SelectTargetPlatform, ignoreFocusOut: true });
		if (!selectedTargetPlatform) {
			// User cancelled
			return;
		}

		targetPlatform = selectedTargetPlatform.label;
	}

	let sdkStyle;
	if (projectType.sdkOption) {
		// 5. SDK-style project or not
		const sdkLearnMoreButton: vscode.QuickInputButton = {
			iconPath: new vscode.ThemeIcon('link-external'),
			tooltip: constants.LearnMore
		};
		const quickPick = vscode.window.createQuickPick();
		quickPick.items = [{ label: constants.YesRecommended }, { label: constants.No }];
		quickPick.title = constants.SdkStyleProject;
		quickPick.ignoreFocusOut = true;
		const disposables: vscode.Disposable[] = [];

		try {
			if (projectType.sdkLearnMoreUrl) {
				// add button to open sdkLearnMoreUrl if it was provided
				quickPick.buttons = [sdkLearnMoreButton];
				quickPick.placeholder = constants.SdkLearnMorePlaceholder;
			}

			let sdkStylePromise = new Promise<boolean | undefined>((resolve) => {
				disposables.push(
					quickPick.onDidHide(() => {
						resolve(undefined);
					}),
					quickPick.onDidChangeSelection((item) => {
						resolve(item[0].label === constants.YesRecommended);
					}));

				if (projectType.sdkLearnMoreUrl) {
					disposables.push(quickPick.onDidTriggerButton(async () => {
						await vscode.env.openExternal(vscode.Uri.parse(projectType.sdkLearnMoreUrl!));
					}));
				}
			});

			quickPick.show();
			sdkStyle = await sdkStylePromise;
			quickPick.hide();
		} finally {
			disposables.forEach(d => d.dispose());
		}

		if (sdkStyle === undefined) {
			// User cancelled
			return;
		}
	}

	// 8. Configure Sql project default build or not
	let configureDefaultBuild = await vscode.window.showQuickPick(
		[constants.Yes, constants.No],
		{ title: constants.confirmCreateProjectWithBuildTaskDialogName, ignoreFocusOut: true }
	);

	if (!configureDefaultBuild) {
		// User cancelled
		return;
	}
	await workspaceService.createProject(projectName, vscode.Uri.file(projectLocation), projectType.id, targetPlatform, sdkStyle, configureDefaultBuild === constants.Yes);

	// Add info message with 'learn more' button if project type has a link
	// for user to learn more about the project type
	if (projectType.learnMoreUrl && projectType.defaultTargetPlatform) {
		void showInfoMessageWithLearnMoreLink(constants.LocalDevInfo(projectType.defaultTargetPlatform), projectType.learnMoreUrl);
	}
}
