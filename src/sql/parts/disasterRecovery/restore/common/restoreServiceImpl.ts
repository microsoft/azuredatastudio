/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import * as sqlops from 'sqlops';
import { TPromise } from 'vs/base/common/winjs.base';
import * as Constants from 'sql/common/constants';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import * as TelemetryUtils from 'sql/common/telemetryUtilities';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as types from 'vs/base/common/types';
import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import { IRestoreService, IRestoreDialogController, TaskExecutionMode } from 'sql/parts/disasterRecovery/restore/common/restoreService';
import { OptionsDialog } from 'sql/base/browser/ui/modal/optionsDialog';
import { RestoreDialog } from 'sql/parts/disasterRecovery/restore/restoreDialog';
import * as ConnectionConstants from 'sql/parts/connection/common/constants';
import { MssqlRestoreInfo } from 'sql/parts/disasterRecovery/restore/mssqlRestoreInfo';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { ProviderConnectionInfo } from 'sql/parts/connection/common/providerConnectionInfo';
import * as Utils from 'sql/parts/connection/common/utils';
import { IObjectExplorerService } from 'sql/parts/registeredServer/common/objectExplorerService';
import { ITaskService } from 'sql/parts/taskHistory/common/taskService';
import { TaskStatus, TaskNode } from 'sql/parts/taskHistory/common/taskNode';

export class RestoreService implements IRestoreService {

	public _serviceBrand: any;
	private _providers: { [handle: string]: sqlops.RestoreProvider; } = Object.create(null);

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@ITelemetryService private _telemetryService: ITelemetryService
	) {
	}

	/**
	 * Gets restore config Info
	 */
	getRestoreConfigInfo(connectionUri: string): Thenable<sqlops.RestoreConfigInfo> {
		return new Promise<sqlops.RestoreConfigInfo>((resolve, reject) => {
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
	restore(connectionUri: string, restoreInfo: sqlops.RestoreInfo): Thenable<sqlops.RestoreResponse> {
		return new Promise<sqlops.RestoreResponse>((resolve, reject) => {
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

	private getProvider(connectionUri: string): { provider: sqlops.RestoreProvider, providerName: string } {
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
	getRestorePlan(connectionUri: string, restoreInfo: sqlops.RestoreInfo): Thenable<sqlops.RestorePlanResponse> {
		return new Promise<sqlops.RestorePlanResponse>((resolve, reject) => {
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
	cancelRestorePlan(connectionUri: string, restoreInfo: sqlops.RestoreInfo): Thenable<boolean> {
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
	public registerProvider(providerId: string, provider: sqlops.RestoreProvider): void {
		this._providers[providerId] = provider;
	}
}


export class RestoreDialogController implements IRestoreDialogController {
	_serviceBrand: any;

	private _restoreDialogs: { [provider: string]: RestoreDialog | OptionsDialog } = {};
	private _currentProvider: string;
	private _ownerUri: string;
	private _sessionId: string;
	private readonly _restoreFeature = 'Restore';
	private readonly _restoreTaskName: string = 'Restore Database';
	private readonly _restoreCompleted : string = 'Completed';
	private _optionValues: { [optionName: string]: any } = {};

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IRestoreService private _restoreService: IRestoreService,
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@ITaskService private _taskService: ITaskService
	) {
	}

	private handleOnRestore(isScriptOnly: boolean = false): void {
		let restoreOption = this.setRestoreOption();
		if (isScriptOnly) {
			restoreOption.taskExecutionMode = TaskExecutionMode.script;
		} else {
			restoreOption.taskExecutionMode = TaskExecutionMode.executeAndScript;
		}

		this._restoreService.restore(this._ownerUri, restoreOption).then(result => {
			const self = this;
			let connectionProfile = self._connectionService.getConnectionProfile(self._ownerUri);
			let activeNode = self._objectExplorerService.getObjectExplorerNode(connectionProfile);
			this._taskService.onTaskComplete(response => {
				if (result.taskId === response.id && this.isSuccessfulRestore(response) && activeNode) {
					self._objectExplorerService.refreshTreeNode(activeNode.getSession(), activeNode).then(result => {
						self._objectExplorerService.getServerTreeView().refreshTree();
					});
				}
			});
			let restoreDialog = this._restoreDialogs[this._currentProvider];
			restoreDialog.close();
		});
	}

	private isSuccessfulRestore(response: TaskNode): boolean {
		return (response.taskName === this._restoreTaskName &&
				response.message === this._restoreCompleted &&
				(response.status === TaskStatus.succeeded ||
					response.status === TaskStatus.succeededWithWarning) &&
				(response.taskExecutionMode === TaskExecutionMode.execute ||
					response.taskExecutionMode === TaskExecutionMode.executeAndScript));
	}

	private handleMssqlOnValidateFile(overwriteTargetDatabase: boolean = false): void {
		let restoreDialog = this._restoreDialogs[this._currentProvider] as RestoreDialog;
		this._restoreService.getRestorePlan(this._ownerUri, this.setRestoreOption(overwriteTargetDatabase)).then(restorePlanResponse => {
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
			this._restoreService.getRestoreConfigInfo(this._ownerUri).then(restoreConfigInfo => {
				restoreDialog.viewModel.updateOptionWithConfigInfo(restoreConfigInfo.configInfo);
				resolve();
			}, error => {
				restoreDialog.showError(error);
				reject(error);
			});
		});
	}

	private setRestoreOption(overwriteTargetDatabase: boolean = false): sqlops.RestoreInfo {
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

	private getRestoreOption(): sqlops.ServiceOption[] {
		let options: sqlops.ServiceOption[] = [];
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
		this._restoreService.cancelRestorePlan(this._ownerUri, restoreInfo).then(() => {
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
