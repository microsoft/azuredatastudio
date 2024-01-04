/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AdsTelemetryReporter from '@microsoft/ads-extension-telemetry';

import { getPackageInfo } from './utils';

const packageInfo = getPackageInfo()!;

export const TelemetryReporter = new AdsTelemetryReporter<TelemetryViews, TelemetryActions>(packageInfo.name, packageInfo.version, packageInfo.aiKey);


export enum TelemetryViews {
	ProjectController = 'ProjectController',
	SqlProjectPublishDialog = 'SqlProjectPublishDialog',
	ProjectTree = 'ProjectTree',
	PublishOptionsDialog = 'PublishOptionsDialog'
}

export enum TelemetryActions {
	createNewProject = 'createNewProject',
	addDatabaseReference = 'addDatabaseReference',
	runStreamingJobValidation = 'runStreamingJobValidation',
	generateScriptClicked = 'generateScriptClicked',
	deleteObjectFromProject = 'deleteObjectFromProject',
	editProjectFile = 'editProjectFile',
	addItemFromTree = 'addItemFromTree',
	addExistingItem = 'addExistingItem',
	excludeFromProject = 'excludeFromProject',
	projectSchemaCompareCommandInvoked = 'projectSchemaCompareCommandInvoked',
	publishProject = 'publishProject',
	build = 'build',
	updateProjectForRoundtrip = 'updateProjectForRoundtrip',
	changePlatformType = 'changePlatformType',
	createProjectFromDatabase = 'createProjectFromDatabase',
	updateProjectFromDatabase = 'updateProjectFromDatabase',
	publishToContainer = 'publishToContainer',
	publishToNewAzureServer = 'publishToNewAzureServer',
	generateProjectFromOpenApiSpec = 'generateProjectFromOpenApiSpec',
	publishOptionsOpened = 'publishOptionsOpened',
	resetOptions = 'resetOptions',
	optionsChanged = 'optionsChanged',
	profileLoaded = 'profileLoaded',
	profileSaved = 'profileSaved',
	SchemaComparisonFinished = 'SchemaComparisonFinished',
	SchemaComparisonStarted = 'SchemaComparisonStarted',
	rename = "rename",
	move = "move"
}
