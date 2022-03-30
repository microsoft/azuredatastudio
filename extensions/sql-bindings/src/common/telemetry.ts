/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import AdsTelemetryReporter from '@microsoft/ads-extension-telemetry';
import { getPackageInfo } from './utils';

const packageInfo = getPackageInfo()!;

export const TelemetryReporter = new AdsTelemetryReporter(packageInfo.name, packageInfo.version, packageInfo.aiKey);

export enum TelemetryViews {
	SqlBindingsQuickPick = 'SqlBindingsQuickPick',
	CreateAzureFunctionWithSqlBinding = 'CreateAzureFunctionWithSqlBinding'
}

export enum TelemetryActions {
	startCreateAzureFunction = 'startCreateAzureFunction',
	helpCreateAzureFunction = 'helpCreateAzureFunction',
	startCreateAzureFunctionWithSqlBinding = 'startCreateAzureFunctionWithSqlBinding',
	finishCreateAzureFunctionWithSqlBinding = 'finishCreateAzureFunctionWithSqlBinding',
	startAddSqlBinding = 'startAddSqlBinding',
	getAzureFunctionProject = 'getAzureFunctionProject',
	getBindingType = 'getBindingType',
	getObjectName = 'getObjectName',
	updateConnectionString = 'updateConnectionString',
	finishAddSqlBinding = 'finishAddSqlBinding',
	exitCreateAzureFunctionQuickpick = 'exitCreateAzureFunctionQuickpick',
	exitSqlBindingsQuickpick = 'exitSqlBindingsQuickpick',
	learnMore = 'learnMore',
}
