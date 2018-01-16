/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import data = require('data');
import { IDisasterRecoveryService, TaskExecutionMode } from 'sql/parts/disasterRecovery/common/interfaces';
import * as Constants from 'sql/common/constants';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import * as TelemetryUtils from 'sql/common/telemetryUtilities';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';

export class DisasterRecoveryService implements IDisasterRecoveryService {

	public _serviceBrand: any;
	private _providers: { [handle: string]: data.DisasterRecoveryProvider; } = Object.create(null);

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@ITelemetryService private _telemetryService: ITelemetryService
	) {
	}

	/**
	 * Get database metadata needed to populate backup UI
	 */
	public getBackupConfigInfo(connectionUri: string): Thenable<data.BackupConfigInfo> {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			let provider = this._providers[providerId];
			if (provider) {
				return provider.getBackupConfigInfo(connectionUri);
			}
		}
		return Promise.resolve(undefined);
	}

	/**
	 * Backup a data source using the provided connection
	 */
	public backup(connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: TaskExecutionMode): Thenable<data.BackupResponse> {
		return new Promise<data.BackupResponse>((resolve, reject) => {
			let providerResult = this.getProvider(connectionUri);
			if (providerResult) {
				TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.BackupCreated, { provider: providerResult.providerName });
				providerResult.provider.backup(connectionUri, backupInfo, taskExecutionMode).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(Constants.InvalidProvider);
			}
		});
	}

	/**
	 * Gets restore config Info
	 */
	getRestoreConfigInfo(connectionUri: string): Thenable<data.RestoreConfigInfo> {
		return new Promise<data.RestoreConfigInfo>((resolve, reject) => {
			let providerResult = this.getProvider(connectionUri);
			if (providerResult) {
				providerResult.provider.getRestoreConfigInfo(connectionUri).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(Constants.InvalidProvider);
			}
		});
	}

	/**
	 * Restore a data source using a backup file or database
	 */
	restore(connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<data.RestoreResponse> {
		return new Promise<data.RestoreResponse>((resolve, reject) => {
			let providerResult = this.getProvider(connectionUri);
			if (providerResult) {
				TelemetryUtils.addTelemetry(this._telemetryService, TelemetryKeys.RestoreRequested, { provider: providerResult.providerName });
				providerResult.provider.restore(connectionUri, restoreInfo).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(Constants.InvalidProvider);
			}
		});
	}

	private getProvider(connectionUri: string): { provider: data.DisasterRecoveryProvider, providerName: string } {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			return { provider: this._providers[providerId], providerName: providerId };
		} else {
			return undefined;
		}
	}

	/**
	 * Gets restore plan to do the restore operation on a database
	 */
	getRestorePlan(connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<data.RestorePlanResponse> {
		return new Promise<data.RestorePlanResponse>((resolve, reject) => {
			let providerResult = this.getProvider(connectionUri);
			if (providerResult) {
				providerResult.provider.getRestorePlan(connectionUri, restoreInfo).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(Constants.InvalidProvider);

			}
		});
	}

	/**
	 * Cancels a restore plan
	 */
	cancelRestorePlan(connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			let providerResult = this.getProvider(connectionUri);
			if (providerResult) {
				providerResult.provider.cancelRestorePlan(connectionUri, restoreInfo).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(Constants.InvalidProvider);

			}
		});
	}

	/**
	 * Register a disaster recovery provider
	 */
	public registerProvider(providerId: string, provider: data.DisasterRecoveryProvider): void {
		this._providers[providerId] = provider;
	}
}
