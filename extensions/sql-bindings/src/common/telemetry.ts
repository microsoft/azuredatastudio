/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import AdsTelemetryReporter from '@microsoft/ads-extension-telemetry';
import { getPackageInfo } from './utils';

const packageInfo = getPackageInfo()!;

export const TelemetryReporter = new AdsTelemetryReporter<TelemetryViews, TelemetryActions | CreateAzureFunctionStep>(packageInfo.name, packageInfo.version, packageInfo.aiKey);

export enum TelemetryViews {
	SqlBindingsQuickPick = 'SqlBindingsQuickPick',
	CreateAzureFunctionWithSqlBinding = 'CreateAzureFunctionWithSqlBinding',
	AzureFunctionsUtils = 'AzureFunctionsUtils',
}

export enum TelemetryActions {
	// Create Azure Function with Sql Binding from Table
	startCreateAzureFunctionWithSqlBinding = 'startCreateAzureFunctionWithSqlBinding',
	finishCreateAzureFunctionWithSqlBinding = 'finishCreateAzureFunctionWithSqlBinding',
	exitCreateAzureFunctionQuickpick = 'exitCreateAzureFunctionQuickpick',

	// Add SQL Binding to Azure Function
	startAddSqlBinding = 'startAddSqlBinding',
	getAzureFunctionProject = 'getAzureFunctionProject',
	getBindingType = 'getBindingType',
	getObjectName = 'getObjectName',
	updateConnectionString = 'updateConnectionString',
	finishAddSqlBinding = 'finishAddSqlBinding',
	exitSqlBindingsQuickpick = 'exitSqlBindingsQuickpick',

	// Azure Functions Utils
	addSQLNugetPackage = 'addSQLNugetPackage',
}

export enum CreateAzureFunctionStep {
	noAzureFunctionsExtension = 'noAzureFunctionsExtension',
	getAzureFunctionProject = 'getAzureFunctionProject',
	learnMore = 'learnMore',
	helpCreateAzureFunctionProject = 'helpCreateAzureFunctionProject',
	getSelectedFolder = 'getSelectedFolder',
	getBindingType = 'getBindingType',
	launchFromCommandPalette = 'launchFromCommandPalette',
	launchFromObjectExplorer = 'launchFromObjectExplorer',
	getConnectionProfile = 'getConnectionProfile',
	getDatabase = 'getDatabase',
	getObjectName = 'getObjectName',
	getConnectionString = 'getConnectionString',
	getAzureFunctionName = 'getAzureFunctionName',
	getTemplateId = 'getTemplateId',
	getConnectionStringSettingName = 'getConnectionStringSettingName',
	promptForIncludePassword = 'promptForIncludePassword',
	createFunctionAPI = 'createFunctionAPI',
	finishCreateFunction = 'finishCreateFunction'
}

export enum ExitReason {
	cancelled = 'cancelled',
	finishCreate = 'finishCreate',
	timeout = 'timeout',
	error = 'error',
	exit = 'exit'
}
