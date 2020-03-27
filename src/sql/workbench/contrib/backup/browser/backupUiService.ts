/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import * as azdata from 'azdata';

import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import * as ConnectionUtils from 'sql/platform/connection/common/utils';
import { ProviderConnectionInfo } from 'sql/platform/connection/common/providerConnectionInfo';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { BackupDialog } from 'sql/workbench/contrib/backup/browser/backupDialog';
import { OptionsDialog } from 'sql/workbench/browser/modal/optionsDialog';
import { IBackupService, TaskExecutionMode } from 'sql/platform/backup/common/backupService';
import { IBackupUiService } from 'sql/workbench/contrib/backup/common/backupUiService';
import { find } from 'vs/base/common/arrays';

export class BackupUiService implements IBackupUiService {
	public _serviceBrand: undefined;
	private _backupDialogs: { [providerName: string]: BackupDialog | OptionsDialog } = {};
	private _currentProvider: string;
	private _optionValues: { [optionName: string]: any } = {};
	private _connectionUri: string;
	private static _connectionUniqueId: number = 0;

	private _onShowBackupEvent: Emitter<{ connection: IConnectionProfile, ownerUri: string }>;
	public get onShowBackupEvent(): Event<{ connection: IConnectionProfile, ownerUri: string }> { return this._onShowBackupEvent.event; }

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IBackupService private _disasterRecoveryService: IBackupService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		this._onShowBackupEvent = new Emitter<{ connection: IConnectionProfile, ownerUri: string }>();
	}

	public showBackup(connection: IConnectionProfile): Promise<any> {
		let self = this;
		return new Promise<void>((resolve, reject) => {
			self.showBackupDialog(connection).then(() => {
				resolve(void 0);
			}, error => {
				reject();
			});
		});
	}

	private getOptions(provider: string): azdata.ServiceOption[] {
		let feature = find(this._capabilitiesService.getLegacyCapabilities(this._currentProvider).features, f => f.featureName === 'backup');
		if (feature) {
			return feature.optionsMetadata;
		} else {
			return undefined;
		}
	}

	public async showBackupDialog(connection: IConnectionProfile): Promise<void> {
		let self = this;
		self._connectionUri = ConnectionUtils.generateUri(connection);
		self._currentProvider = connection.providerName;
		let backupDialog = self._backupDialogs[self._currentProvider];
		if (!backupDialog) {
			let backupOptions = this.getOptions(this._currentProvider);
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

		let backupOptions = this.getOptions(this._currentProvider);
		let uri = this._connectionManagementService.getConnectionUri(connection)
			+ ProviderConnectionInfo.idSeparator
			+ ConnectionUtils.ConnectionUriBackupIdAttributeName
			+ ProviderConnectionInfo.nameValueSeparator
			+ BackupUiService._connectionUniqueId;

		this._connectionUri = uri;

		BackupUiService._connectionUniqueId++;

		if (backupOptions) {
			(backupDialog as OptionsDialog).open(backupOptions, self._optionValues);
		} else {
			(backupDialog as BackupDialog).open(connection);
		}

		// Create connection if needed
		if (!this._connectionManagementService.isConnected(uri)) {
			await this._connectionManagementService.connect(connection, uri);
			this._onShowBackupEvent.fire({ connection: connection, ownerUri: uri });
		}
	}

	public onShowBackupDialog() {
		let backupDialog = this._backupDialogs[this._currentProvider];
		if (backupDialog) {
			backupDialog.setInitialFocusedElement();
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
