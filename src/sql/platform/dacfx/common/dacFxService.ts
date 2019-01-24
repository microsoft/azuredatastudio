/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { TPromise } from 'vs/base/common/winjs.base';
import { localize } from 'vs/nls';

export const SERVICE_ID = 'dacFxService';
export const IDacFxService = createDecorator<IDacFxService>(SERVICE_ID);

export interface IDacFxService {
	_serviceBrand: any;

	registerProvider(providerId: string, provider: sqlops.DacFxServicesProvider): void;
	exportBacpac(sourceDatabaseName: string, packageFilePath: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): void;
	importBacpac(packageFilePath: string, targetDatabaseName: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): void;
	extractDacpac(sourceDatabaseName: string, packageFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): void;
	deployDacpac(packageFilePath: string, targetDatabaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): void;
	generateDeployScript(packageFilePath: string, targetDatabaseName: string, scriptFilePath: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): void;
	generateDeployPlan(packageFilePath: string, targetDatabaseName: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): void;
}

export class DacFxService implements IDacFxService {
	_serviceBrand: any;
	private _providers: { [handle: string]: sqlops.DacFxServicesProvider; } = Object.create(null);

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService
	) {
	}

	registerProvider(providerId: string, provider: sqlops.DacFxServicesProvider): void {
		this._providers[providerId] = provider;
	}

	exportBacpac(databasesName: string, packageFilePath: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.DacFxResult> {
		return this._runAction(ownerUri, (runner) => {
			return runner.exportBacpac(databasesName, packageFilePath, ownerUri, taskExecutionMode);
		});
	}

	importBacpac(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.DacFxResult> {
		return this._runAction(ownerUri, (runner) => {
			return runner.importBacpac(packageFilePath, databaseName, ownerUri, taskExecutionMode);
		});
	}

	extractDacpac(databaseName: string, packageFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.DacFxResult> {
		return this._runAction(ownerUri, (runner) => {
			return runner.extractDacpac(databaseName, packageFilePath, applicationName, applicationVersion, ownerUri, taskExecutionMode);
		});
	}

	deployDacpac(packageFilePath: string, databaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.DacFxResult> {
		return this._runAction(ownerUri, (runner) => {
			return runner.deployDacpac(packageFilePath, databaseName, upgradeExisting, ownerUri, taskExecutionMode);
		});
	}

	generateDeployScript(packageFilePath: string, databaseName: string, generateDeployScript: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.DacFxResult> {
		return this._runAction(ownerUri, (runner) => {
			return runner.generateDeployScript(packageFilePath, databaseName, generateDeployScript, ownerUri, taskExecutionMode);
		});
	}

	generateDeployPlan(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.GenerateDeployPlanResult> {
		return this._runAction(ownerUri, (runner) => {
			return runner.generateDeployPlan(packageFilePath, databaseName, ownerUri, taskExecutionMode);
		});
	}

	private _runAction<T>(uri: string, action: (handler: sqlops.DacFxServicesProvider) => Thenable<T>): Thenable<T> {
		let providerId: string = this._connectionService.getProviderIdFromUri(uri);

		if (!providerId) {
			return TPromise.wrapError(new Error(localize('providerIdNotValidError', "Connection is required in order to interact with DacFxService")));
		}
		let handler = this._providers[providerId];
		if (handler) {
			return action(handler);
		} else {
			return TPromise.wrapError(new Error(localize('noHandlerRegistered', "No Handler Registered")));
		}
	}
}