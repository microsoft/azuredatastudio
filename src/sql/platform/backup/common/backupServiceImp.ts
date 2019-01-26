/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import * as sqlops from 'sqlops';
import * as Constants from 'sql/common/constants';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import * as TelemetryUtils from 'sql/common/telemetryUtilities';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IBackupService, TaskExecutionMode } from 'sql/platform/backup/common/backupService';

export class BackupService implements IBackupService {

	public _serviceBrand: any;
	private _providers: { [handle: string]: sqlops.BackupProvider; } = Object.create(null);

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@ITelemetryService private _telemetryService: ITelemetryService
	) {
	}

	/**
	 * Get database metadata needed to populate backup UI
	 */
	public getBackupConfigInfo(connectionUri: string): Thenable<sqlops.BackupConfigInfo> {
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
	public backup(connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: TaskExecutionMode): Thenable<sqlops.BackupResponse> {
		return new Promise<sqlops.BackupResponse>((resolve, reject) => {
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

	private getProvider(connectionUri: string): { provider: sqlops.BackupProvider, providerName: string } {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			return { provider: this._providers[providerId], providerName: providerId };
		} else {
			return undefined;
		}
	}

	/**
	 * Register a disaster recovery provider
	 */
	public registerProvider(providerId: string, provider: sqlops.BackupProvider): void {
		this._providers[providerId] = provider;
	}
}
