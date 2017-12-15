/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import Event, { Emitter } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import * as data from 'data';

import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { OptionsDialog } from 'sql/base/browser/ui/modal/optionsDialog';
import { BackupDialog } from 'sql/parts/disasterRecovery/backup/backupDialog';
import { IDisasterRecoveryService, IDisasterRecoveryUiService, TaskExecutionMode } from 'sql/parts/disasterRecovery/common/interfaces';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import ConnectionUtils = require('sql/parts/connection/common/utils');
import { ProviderConnectionInfo } from 'sql/parts/connection/common/providerConnectionInfo';
import { DashboardComponentParams } from 'sql/services/bootstrap/bootstrapParams';
import * as Utils from 'sql/parts/connection/common/utils';

export class DisasterRecoveryUiService implements IDisasterRecoveryUiService {
	public _serviceBrand: any;
	private _backupDialogs: { [providerName: string]: BackupDialog | OptionsDialog } = {};
	private _currentProvider: string;
	private _optionsMap: { [providerName: string]: data.ServiceOption[] } = {};
	private _optionValues: { [optionName: string]: any } = {};
	private _connectionUri: string;
	private static _connectionUniqueId: number = 0;

	private _onShowBackupEvent: Emitter<DashboardComponentParams>;
	public get onShowBackupEvent(): Event<DashboardComponentParams> { return this._onShowBackupEvent.event; }

	constructor( @IInstantiationService private _instantiationService: IInstantiationService,
		@IPartService private _partService: IPartService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IDisasterRecoveryService private _disasterRecoveryService: IDisasterRecoveryService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService) {
			this._onShowBackupEvent = new Emitter<DashboardComponentParams>();
		}

	public showBackup(connection: IConnectionProfile): Promise<any> {
		let self = this;
		return new Promise<void>((resolve, reject) => {
			self.showBackupDialog(connection).then(() => {
				resolve();
			}, error => {
				reject();
			});
		});
	}

	public showBackupDialog(connection: IConnectionProfile): TPromise<void> {
		let self = this;
		self._connectionUri = ConnectionUtils.generateUri(connection);
		self._currentProvider = connection.providerName;
		let backupDialog = self._backupDialogs[self._currentProvider];
		if (!backupDialog) {
			let capabilitiesList = this._capabilitiesService.getCapabilities();
			capabilitiesList.forEach(providerCapabilities => {
				let backupFeature = providerCapabilities.features.find(feature => feature.featureName === 'backup');
				if (backupFeature && backupFeature.optionsMetadata) {
					this._optionsMap[providerCapabilities.providerName] = backupFeature.optionsMetadata;
				}
			});
			let backupOptions = self._optionsMap[self._currentProvider];
			if (backupOptions) {
				backupDialog = self._instantiationService ? self._instantiationService.createInstance(
					OptionsDialog, 'Backup database - ' + connection.serverName + ':' + connection.databaseName, 'BackupOptions', undefined) : undefined;
				backupDialog.onOk(() => this.handleOptionDialogClosed());
			}
			else {
				backupDialog = self._instantiationService ? self._instantiationService.createInstance(BackupDialog) : undefined;
			}
			backupDialog.render();
			self._backupDialogs[self._currentProvider] = backupDialog;
		}

		let backupOptions = this._optionsMap[self._currentProvider];
		return new TPromise<void>(() => {
			if (backupOptions) {
				(backupDialog as OptionsDialog).open(backupOptions, self._optionValues);
			} else {
				let uri = this._connectionManagementService.getConnectionId(connection)
					+ ProviderConnectionInfo.idSeparator
					+ Utils.ConnectionUriBackupIdAttributeName
					+ ProviderConnectionInfo.nameValueSeparator
					+ DisasterRecoveryUiService._connectionUniqueId;

				DisasterRecoveryUiService._connectionUniqueId++;

				// Create connection if needed
				if (!this._connectionManagementService.isConnected(uri)) {
					this._connectionManagementService.connect(connection, uri).then(() => {
						this._onShowBackupEvent.fire({connection: connection, ownerUri: uri});
					});
				}
				(backupDialog as BackupDialog).open(connection);
			}
		});
	}

	public onShowBackupDialog() {
		let backupDialog = this._backupDialogs[this._currentProvider];
		if (backupDialog) {
			backupDialog.setFocusableElements();
		}
	}

	public closeBackup() {
		let self = this;
		let backupDialog = self._backupDialogs[self._currentProvider];
		if (backupDialog) {
			backupDialog.close();
		}
	}

	private handleOptionDialogClosed() {
		this._disasterRecoveryService.backup(this._connectionUri, this._optionValues, TaskExecutionMode.executeAndScript);
	}

}
