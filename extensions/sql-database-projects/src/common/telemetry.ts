/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AdsTelemetryReporter from '@microsoft/ads-extension-telemetry';

import { getPackageInfo } from './utils';

const packageInfo = getPackageInfo()!;

export const TelemetryReporter = new AdsTelemetryReporter(packageInfo.name, packageInfo.version, packageInfo.aiKey);


export enum TelemetryViews {
	ProjectController = 'ProjectController',
	SqlProjectPublishDialog = 'SqlProjectPublishDialog',
	ProjectTree = 'ProjectTree',
	SqlBindingsQuickPick = 'SqlBindingsQuickPick'
}

export enum TelemetryActions {
	createNewProject = 'createNewProject',
	addDatabaseReference = 'addDatabaseReference',
	runStreamingJobValidation = 'runStreamingJobValidation',
	generateScriptClicked = 'generateScriptClicked',
	deleteObjectFromProject = 'deleteObjectFromProject',
	editProjectFile = 'editProjectFile',
	addItemFromTree = 'addItemFromTree',
	excludeFromProject = 'excludeFromProject',
	projectSchemaCompareCommandInvoked = 'projectSchemaCompareCommandInvoked',
	publishProject = 'publishProject',
	build = 'build',
	updateProjectForRoundtrip = 'updateProjectForRoundtrip',
	changePlatformType = 'changePlatformType',
	updateSystemDatabaseReferencesInProjFile = 'updateSystemDatabaseReferencesInProjFile',
	startAddSqlBinding = 'startAddSqlBinding',
	finishAddSqlBinding = 'finishAddSqlBinding'
}
