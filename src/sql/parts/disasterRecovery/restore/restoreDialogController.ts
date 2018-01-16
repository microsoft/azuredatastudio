/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { TPromise } from 'vs/base/common/winjs.base';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as types from 'vs/base/common/types';

import { OptionsDialog } from 'sql/base/browser/ui/modal/optionsDialog';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import * as ConnectionConstants from 'sql/parts/connection/common/constants';
import { ProviderConnectionInfo } from 'sql/parts/connection/common/providerConnectionInfo';
import { IDisasterRecoveryService, IRestoreDialogController, TaskExecutionMode } from 'sql/parts/disasterRecovery/common/interfaces';
import { MssqlRestoreInfo } from 'sql/parts/disasterRecovery/restore/mssqlRestoreInfo';
import { RestoreDialog } from 'sql/parts/disasterRecovery/restore/restoreDialog';
import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import * as Utils from 'sql/parts/connection/common/utils';
import * as data from 'data';

export class RestoreDialogController implements IRestoreDialogController {
	_serviceBrand: any;

	private _restoreDialogs: { [provider: string]: RestoreDialog | OptionsDialog } = {};
	private _currentProvider: string;
	private _ownerUri: string;
	private _sessionId: string;
	private readonly _restoreFeature = 'Restore';
	private _optionValues: { [optionName: string]: any } = {};

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IDisasterRecoveryService private _disasterRecoveryService: IDisasterRecoveryService,
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService
	) {
	}

	private handleOnRestore(isScriptOnly: boolean = false): void {
		let restoreOption = this.setRestoreOption();
		if (isScriptOnly) {
			restoreOption.taskExecutionMode = TaskExecutionMode.script;
		} else {
			restoreOption.taskExecutionMode = TaskExecutionMode.executeAndScript;
		}

		this._disasterRecoveryService.restore(this._ownerUri, restoreOption);
		let restoreDialog = this._restoreDialogs[this._currentProvider];
		restoreDialog.close();
	}

	private handleMssqlOnValidateFile(overwriteTargetDatabase: boolean = false): void {
		let restoreDialog = this._restoreDialogs[this._currentProvider] as RestoreDialog;
		this._disasterRecoveryService.getRestorePlan(this._ownerUri, this.setRestoreOption(overwriteTargetDatabase)).then(restorePlanResponse => {
			this._sessionId = restorePlanResponse.sessionId;

			if (restorePlanResponse.errorMessage) {
				restoreDialog.onValidateResponseFail(restorePlanResponse.errorMessage);
			} else {
				restoreDialog.removeErrorMessage();
				restoreDialog.viewModel.onRestorePlanResponse(restorePlanResponse);
			}

			if (restorePlanResponse.canRestore && !this.isEmptyBackupset()) {
				restoreDialog.enableRestoreButton(true);
			} else {
				restoreDialog.enableRestoreButton(false);
			}
		}, error => {
			restoreDialog.showError(error);
		});
	}

	/**
	 * Temporary fix for bug #2506: Restore button not disabled when there's not backup set to restore
	 * Will remove this function once there is a fix in the service (bug #2572)
	 */
	private isEmptyBackupset(): boolean {
		let restoreDialog = this._restoreDialogs[this._currentProvider] as RestoreDialog;
		if (!types.isUndefinedOrNull(restoreDialog.viewModel.selectedBackupSets) && restoreDialog.viewModel.selectedBackupSets.length === 0) {
			return true;
		}
		return false;
	}

	private getMssqlRestoreConfigInfo(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			let restoreDialog = this._restoreDialogs[this._currentProvider] as RestoreDialog;
			this._disasterRecoveryService.getRestoreConfigInfo(this._ownerUri).then(restoreConfigInfo => {
				restoreDialog.viewModel.updateOptionWithConfigInfo(restoreConfigInfo.configInfo);
				resolve();
			}, error => {
				restoreDialog.showError(error);
				reject(error);
			});
		});
	}

	private setRestoreOption(overwriteTargetDatabase: boolean = false): data.RestoreInfo {
		let restoreInfo = undefined;

		let providerId: string = this.getCurrentProviderId();
		if (providerId === ConnectionConstants.mssqlProviderName) {
			restoreInfo = new MssqlRestoreInfo();

			if (this._sessionId) {
				restoreInfo.sessionId = this._sessionId;
			}

			let restoreDialog = this._restoreDialogs[providerId] as RestoreDialog;
			restoreInfo.backupFilePaths = restoreDialog.viewModel.filePath;

			restoreInfo.readHeaderFromMedia = restoreDialog.viewModel.readHeaderFromMedia;
			restoreInfo.selectedBackupSets = restoreDialog.viewModel.selectedBackupSets;
			restoreInfo.sourceDatabaseName = restoreDialog.viewModel.sourceDatabaseName;
			if (restoreDialog.viewModel.targetDatabaseName) {
				restoreInfo.targetDatabaseName = restoreDialog.viewModel.targetDatabaseName;
			}
			restoreInfo.overwriteTargetDatabase = overwriteTargetDatabase;

			// Set other restore options
			restoreDialog.viewModel.getRestoreAdvancedOptions(restoreInfo.options);
		} else {
			restoreInfo = { options: this._optionValues };
		}

		return restoreInfo;
	}

	private getRestoreOption(): data.ServiceOption[] {
		let options: data.ServiceOption[] = [];
		let providerId: string = this.getCurrentProviderId();
		let providerCapabilities = this._capabilitiesService.getCapabilities().find(c => c.providerName === providerId);

		if (providerCapabilities) {
			let restoreMetadataProvider = providerCapabilities.features.find(f => f.featureName === this._restoreFeature);
			if (restoreMetadataProvider) {
				options = restoreMetadataProvider.optionsMetadata;
			}
		}
		return options;
	}

	private handleOnClose(): void {
		this._connectionService.disconnect(this._ownerUri);
	}

	private handleOnCancel(): void {
		let restoreInfo = new MssqlRestoreInfo();
		restoreInfo.sessionId = this._sessionId;
		this._disasterRecoveryService.cancelRestorePlan(this._ownerUri, restoreInfo).then(() => {
			this._connectionService.disconnect(this._ownerUri);
		});
	}

	public showDialog(connection: IConnectionProfile): TPromise<void> {
		return new TPromise<void>((resolve, reject) => {
			let result: void;

			this._ownerUri = this._connectionService.getConnectionId(connection)
				+ ProviderConnectionInfo.idSeparator
				+ Utils.ConnectionUriRestoreIdAttributeName
				+ ProviderConnectionInfo.nameValueSeparator
				+ '0';

			if (!this._connectionService.isConnected(this._ownerUri)) {
				this._connectionService.connect(connection, this._ownerUri).then(connectionResult => {
					this._sessionId = null;
					this._currentProvider = this.getCurrentProviderId();
					if (!this._restoreDialogs[this._currentProvider]) {
						let newRestoreDialog: RestoreDialog | OptionsDialog = undefined;
						if (this._currentProvider === ConnectionConstants.mssqlProviderName) {
							let provider = this._currentProvider;
							newRestoreDialog = this._instantiationService.createInstance(RestoreDialog, this.getRestoreOption());
							newRestoreDialog.onCancel(() => this.handleOnCancel());
							newRestoreDialog.onRestore((isScriptOnly) => this.handleOnRestore(isScriptOnly));
							newRestoreDialog.onValidate((overwriteTargetDatabase) => this.handleMssqlOnValidateFile(overwriteTargetDatabase));
							newRestoreDialog.onDatabaseListFocused(() => this.fetchDatabases(provider));
						} else {
							newRestoreDialog = this._instantiationService.createInstance(
								OptionsDialog, 'Restore database - ' + connection.serverName + ':' + connection.databaseName, 'RestoreOptions', undefined);
							newRestoreDialog.onOk(() => this.handleOnRestore());
						}
						newRestoreDialog.onCloseEvent(() => this.handleOnClose());
						newRestoreDialog.render();
						this._restoreDialogs[this._currentProvider] = newRestoreDialog;
					}

					if (this._currentProvider === ConnectionConstants.mssqlProviderName) {
						let restoreDialog = this._restoreDialogs[this._currentProvider] as RestoreDialog;
						restoreDialog.viewModel.resetRestoreOptions(connection.databaseName);
						this.getMssqlRestoreConfigInfo().then(() => {
							restoreDialog.open(connection.serverName, this._ownerUri);
							restoreDialog.validateRestore();
						}, restoreConfigError => {
							reject(restoreConfigError);
						});

					} else {
						let restoreDialog = this._restoreDialogs[this._currentProvider] as OptionsDialog;
						restoreDialog.open(this.getRestoreOption(), this._optionValues);
					}

					resolve(result);
				}, error => {
					reject(error);
				});
			}
		});
	}

	private getCurrentProviderId(): string {
		return this._connectionService.getProviderIdFromUri(this._ownerUri);
	}

	private fetchDatabases(provider: string): void {
		this._connectionService.listDatabases(this._ownerUri).then(result => {
			if (result && result.databaseNames) {
				(<RestoreDialog>this._restoreDialogs[provider]).databaseListOptions = result.databaseNames;
			}
		});
	}
}
