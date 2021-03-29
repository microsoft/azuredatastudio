/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AdsTelemetryReporter from '@microsoft/ads-extension-telemetry';
import * as path from 'path';
import * as utils from './utils';
import * as vscode from 'vscode';

const packageJson = require('../../package.json');

let packageInfo = utils.getPackageInfo(packageJson)!;

export const TelemetryReporter = new AdsTelemetryReporter(packageInfo.name, packageInfo.version, packageInfo.aiKey);

export function calculateRelativity(projectPath: string, workspacePath?: string): string {
	workspacePath = workspacePath ?? vscode.workspace.workspaceFile?.fsPath;

	if (!workspacePath) {
		return 'noWorkspace';
	}

	const relativePath = path.relative(path.dirname(projectPath), path.dirname(workspacePath));

	if (relativePath.length === 0) { // no path difference
		return 'sameFolder';
	}

	const pathParts = relativePath.split(path.sep);

	if (pathParts.every(x => x === '..')) {
		return 'directAncestor';
	}

	return 'other'; // sibling, cousin, descendant, etc.
}


export enum TelemetryViews {
	WorkspaceTreePane = 'WorkspaceTreePane',
	OpenExistingDialog = 'OpenExistingDialog',
	NewProjectDialog = 'NewProjectDialog',
	ProviderRegistration = 'ProviderRegistration'
}

export enum TelemetryActions {
	ProviderRegistered = 'ProviderRegistered',
	ProjectAddedToWorkspace = 'ProjectAddedToWorkspace',
	ProjectRemovedFromWorkspace = 'ProjectRemovedFromWorkspace',
	OpeningProject = 'OpeningProject',
	NewProjectDialogLaunched = 'NewProjectDialogLaunched',
	OpeningWorkspace = 'OpeningWorkspace',
	OpenExistingDialogLaunched = 'OpenExistingDialogLaunched',
	NewProjectDialogCompleted = 'NewProjectDialogCompleted',
	GitClone = 'GitClone'
}
