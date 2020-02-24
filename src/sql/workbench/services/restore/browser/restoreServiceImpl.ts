/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as types from 'vs/base/common/types';
import * as azdata from 'azdata';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IRestoreService, IRestoreDialogController, TaskExecutionMode } from 'sql/workbench/services/restore/common/restoreService';
import { OptionsDialog } from 'sql/workbench/browser/modal/optionsDialog';
import { RestoreDialog } from 'sql/workbench/services/restore/browser/restoreDialog';
import * as ConnectionConstants from 'sql/platform/connection/common/constants';
import { MssqlRestoreInfo } from 'sql/workbench/services/restore/common/mssqlRestoreInfo';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ProviderConnectionInfo } from 'sql/platform/connection/common/providerConnectionInfo';
import * as Utils from 'sql/platform/connection/common/utils';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { ITaskService } from 'sql/workbench/services/tasks/common/tasksService';
import { TaskStatus, TaskNode } from 'sql/workbench/services/tasks/common/tasksNode';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { invalidProvider } from 'sql/base/common/errors';
import { ILogService } from 'vs/platform/log/common/log';
import { find } from 'vs/base/common/arrays';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';

export class RestoreService implements IRestoreService {

	public _serviceBrand: undefined;
	private _providers: { [handle: string]: azdata.RestoreProvider; } = Object.create(null);

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) {
	}

	/**
	 * Gets restore config Info
	 */
	getRestoreConfigInfo(connectionUri: string): Thenable<azdata.RestoreConfigInfo> {
		return new Promise<azdata.RestoreConfigInfo>((resolve, reject) => {
			const providerResult = this.getProvider(connectionUri);
			if (providerResult) {
				providerResult.provider.getRestoreConfigInfo(connectionUri).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(invalidProvider());
			}
		});
	}

	/**
	 * Restore a data source using a backup file or database
	 */
	restore(connectionUri: string, restoreInfo: azdata.RestoreInfo): Thenable<azdata.RestoreResponse> {
		return new Promise<azdata.RestoreResponse>((resolve, reject) => {
			const providerResult = this.getProvider(connectionUri);
			if (providerResult) {
				this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Shell, TelemetryKeys.RestoreRequested)
					.withAdditionalProperties({
						provider: providerResult.providerName
					}).send();
				providerResult.provider.restore(connectionUri, restoreInfo).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(invalidProvider);
			}
		});
	}

	private getProvider(connectionUri: string): { provider: azdata.RestoreProvider, providerName: string } {
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
	getRestorePlan(connectionUri: string, restoreInfo: azdata.RestoreInfo): Thenable<azdata.RestorePlanResponse> {
		return new Promise<azdata.RestorePlanResponse>((resolve, reject) => {
			const providerResult = this.getProvider(connectionUri);
			if (providerResult) {
				providerResult.provider.getRestorePlan(connectionUri, restoreInfo).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(invalidProvider);

			}
		});
	}

	/**
	 * Cancels a restore plan
	 */
	cancelRestorePlan(connectionUri: string, restoreInfo: azdata.RestoreInfo): Thenable<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			const providerResult = this.getProvider(connectionUri);
			if (providerResult) {
				providerResult.provider.cancelRestorePlan(connectionUri, restoreInfo).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(invalidProvider);

			}
		});
	}

	/**
	 * Register a disaster recovery provider
	 */
	public registerProvider(providerId: string, provider: azdata.RestoreProvider): void {
		this._providers[providerId] = provider;
	}
}

export class RestoreDialogController implements IRestoreDialogController {
	_serviceBrand: undefined;

	private _restoreDialogs: { [provider: string]: RestoreDialog | OptionsDialog } = {};
	private _currentProvider: string;
	private _ownerUri: string;
	private _sessionId: string;
	private readonly _restoreFeature = 'Restore';
	private readonly _restoreTaskName: string = 'Restore Database';
	private readonly _restoreCompleted: string = 'Completed';
	private _optionValues: { [optionName: string]: any } = {};

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IRestoreService private _restoreService: IRestoreService,
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@ITaskService private _taskService: ITaskService,
		@ILogService private _logService: ILogService,
	) {
	}

	private handleOnRestore(isScriptOnly: boolean = false): void {
		let restoreOption = this.setRestoreOption(isScriptOnly ? TaskExecutionMode.script : TaskExecutionMode.executeAndScript);

		this._restoreService.restore(this._ownerUri, restoreOption).then(result => {
			const self = this;
			let connectionProfile = self._connectionService.getConnectionProfile(self._ownerUri);
			let activeNode = self._objectExplorerService.getObjectExplorerNode(connectionProfile);
			this._taskService.onTaskComplete(async response => {
				if (result.taskId === response.id && this.isSuccessfulRestore(response) && activeNode) {
					try {
						await self._objectExplorerService.refreshTreeNode(activeNode.getSession(), activeNode);
						await self._objectExplorerService.getServerTreeView().refreshTree();
					} catch (e) {
						this._logService.error(e);
					}
				}
			});
			let restoreDialog = this._restoreDialogs[this._currentProvider];
			restoreDialog.close();
		});
	}

	private isSuccessfulRestore(response: TaskNode): boolean {
		return (response.taskName === this._restoreTaskName &&
			response.message === this._restoreCompleted &&
			(response.status === TaskStatus.Succeeded ||
				response.status === TaskStatus.SucceededWithWarning) &&
			(response.taskExecutionMode === TaskExecutionMode.execute ||
				response.taskExecutionMode === TaskExecutionMode.executeAndScript));
	}

	private handleMssqlOnValidateFile(overwriteTargetDatabase: boolean = false): void {
		let restoreDialog = this._restoreDialogs[this._currentProvider] as RestoreDialog;
		this._restoreService.getRestorePlan(this._ownerUri, this.setRestoreOption(TaskExecutionMode.execute, overwriteTargetDatabase)).then(restorePlanResponse => {
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

	private setRestoreOption(taskExecutionMode: TaskExecutionMode, overwriteTargetDatabase: boolean = false): azdata.RestoreInfo {
		let restoreInfo = undefined;

		let providerId: string = this.getCurrentProviderId();
		if (providerId === ConnectionConstants.mssqlProviderName) {
			restoreInfo = new MssqlRestoreInfo(taskExecutionMode);

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

	private getRestoreOption(): azdata.ServiceOption[] {
		let options: azdata.ServiceOption[] = [];
		let providerId: string = this.getCurrentProviderId();
		let providerCapabilities = this._capabilitiesService.getLegacyCapabilities(providerId);

		if (providerCapabilities) {
			let restoreMetadataProvider = find(providerCapabilities.features, f => f.featureName === this._restoreFeature);
			if (restoreMetadataProvider) {
				options = restoreMetadataProvider.optionsMetadata;
			}
		}
		return options;
	}

	private handleOnClose(): void {
		this._connectionService.disconnect(this._ownerUri).catch((e) => this._logService.error(e));
	}

	private handleOnCancel(): void {
		let restoreInfo = new MssqlRestoreInfo(TaskExecutionMode.execute);
		restoreInfo.sessionId = this._sessionId;
		this._restoreService.cancelRestorePlan(this._ownerUri, restoreInfo).then(() => {
			this._connectionService.disconnect(this._ownerUri);
		});
	}

	public showDialog(connection: IConnectionProfile): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			let result: void;

			this._ownerUri = this._connectionService.getConnectionUri(connection)
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
