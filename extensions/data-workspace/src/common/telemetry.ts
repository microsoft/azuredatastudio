/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AdsTelemetryReporter from '@microsoft/ads-extension-telemetry';
import * as utils from './utils';

const packageJson = require('../../package.json');

let packageInfo = utils.getPackageInfo(packageJson)!;

export const TelemetryReporter = new AdsTelemetryReporter<TelemetryViews, TelemetryActions>(packageInfo.name, packageInfo.version, packageInfo.aiKey);


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
	OpenExistingDialogLaunched = 'OpenExistingDialogLaunched',
	NewProjectDialogCompleted = 'NewProjectDialogCompleted',
	GitClone = 'GitClone',
	ProjectsLoaded = 'ProjectsLoaded'
}
