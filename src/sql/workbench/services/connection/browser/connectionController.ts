/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionComponentCallbacks, IConnectionComponentController, IConnectionValidateResult } from 'sql/workbench/services/connection/browser/connectionDialogService';
import { AdvancedPropertiesController } from 'sql/workbench/services/connection/browser/advancedPropertiesController';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ConnectionProfileGroup, IConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import * as Constants from 'sql/platform/connection/common/constants';
import * as azdata from 'azdata';
import * as Utils from 'sql/platform/connection/common/utils';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ConnectionOptionSpecialType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ConnectionWidget } from 'sql/workbench/services/connection/browser/connectionWidget';
import { IServerGroupController } from 'sql/platform/serverGroup/common/serverGroupController';
import { ILogService } from 'vs/platform/log/common/log';
import { ConnectionProviderProperties } from 'sql/platform/capabilities/common/capabilitiesService';
import { assign } from 'vs/base/common/objects';
import { find } from 'vs/base/common/arrays';

export class ConnectionController implements IConnectionComponentController {
	private _advancedController: AdvancedPropertiesController;
	private _model: IConnectionProfile;
	private _providerName: string;
	protected _callback: IConnectionComponentCallbacks;
	protected _connectionWidget: ConnectionWidget;
	protected _providerOptions: azdata.ConnectionOption[];
	/* key: uri, value : list of databases */
	protected _databaseCache = new Map<string, string[]>();

	constructor(
		connectionProperties: ConnectionProviderProperties,
		callback: IConnectionComponentCallbacks,
		providerName: string,
		@IConnectionManagementService protected readonly _connectionManagementService: IConnectionManagementService,
		@IInstantiationService protected readonly _instantiationService: IInstantiationService,
		@IServerGroupController protected readonly _serverGroupController: IServerGroupController,
		@ILogService private readonly _logService: ILogService
	) {
		this._callback = callback;
		this._providerOptions = connectionProperties.connectionOptions;
		let specialOptions = this._providerOptions.filter(
			(property) => (property.specialValueType !== null && property.specialValueType !== undefined));
		this._connectionWidget = this._instantiationService.createInstance(ConnectionWidget, specialOptions, {
			onSetConnectButton: (enable: boolean) => this._callback.onSetConnectButton(enable),
			onCreateNewServerGroup: () => this.onCreateNewServerGroup(),
			onAdvancedProperties: () => this.handleOnAdvancedProperties(),
			onSetAzureTimeOut: () => this.handleonSetAzureTimeOut(),
			onFetchDatabases: (serverName: string, authenticationType: string, userName?: string, password?: string) => this.onFetchDatabases(
				serverName, authenticationType, userName, password).then(result => {
					return result;
				}),
			onAzureTenantSelection: (azureTenantId?: string) => this.onAzureTenantSelection(azureTenantId),
		}, providerName);
		this._providerName = providerName;
	}

	protected async onFetchDatabases(serverName: string, authenticationType: string, userName?: string, password?: string): Promise<string[]> {
		let tempProfile = this._model;
		tempProfile.serverName = serverName;
		tempProfile.authenticationType = authenticationType;
		tempProfile.userName = userName;
		tempProfile.password = password;
		tempProfile.groupFullName = '';
		tempProfile.saveProfile = false;
		let uri = this._connectionManagementService.getConnectionUri(tempProfile);
		if (this._databaseCache.has(uri)) {
			let cachedDatabases: string[] = this._databaseCache.get(uri);
			if (cachedDatabases !== null) {
				return cachedDatabases;
			} else {
				throw new Error('database cache didn\'t have value');
			}
		} else {
			const connResult = await this._connectionManagementService.connect(tempProfile, uri);
			if (connResult && connResult.connected) {
				const result = await this._connectionManagementService.listDatabases(uri);
				if (result && result.databaseNames) {
					this._databaseCache.set(uri, result.databaseNames);
					return result.databaseNames;
				} else {
					this._databaseCache.set(uri, null);
					throw new Error('list databases failed');
				}
			} else {
				throw new Error(connResult.errorMessage);
			}
		}
	}

	protected onCreateNewServerGroup(): void {
		this._serverGroupController.showCreateGroupDialog({
			onAddGroup: (groupName) => this._connectionWidget.updateServerGroup(this.getAllServerGroups(), groupName),
			onClose: () => this._connectionWidget.focusOnServerGroup()
		}).catch((e) => this._logService.error(e));
	}

	protected handleonSetAzureTimeOut(): void {
		let timeoutPropertyName = 'connectTimeout';
		let timeoutOption = this._model.options[timeoutPropertyName];
		if (timeoutOption === undefined || timeoutOption === null) {
			this._model.options[timeoutPropertyName] = 30;
		}
	}

	protected onAzureTenantSelection(azureTenantId?: string): void {
		if (this._model.options.azureAccountToken !== undefined) {
			this._model.options.azureAccountToken = undefined;
		}

		if (this._model.azureTenantId !== azureTenantId) {
			this._model.azureTenantId = azureTenantId;
		}

		if (this._model.options.azureTenantId !== azureTenantId) {
			this._model.azureTenantId = azureTenantId;
		}
	}

	protected handleOnAdvancedProperties(): void {
		if (!this._advancedController) {
			this._advancedController = this._instantiationService.createInstance(AdvancedPropertiesController, () => this._connectionWidget.focusOnAdvancedButton());
		}
		let advancedOption = this._providerOptions.filter(
			(property) => (property.specialValueType === undefined || property.specialValueType === null));
		this._advancedController.showDialog(advancedOption, this._model.options);
	}

	public showUiComponent(container: HTMLElement): void {
		this._databaseCache = new Map<string, string[]>();
		this._connectionWidget.createConnectionWidget(container);
	}

	private flattenGroups(group: ConnectionProfileGroup, allGroups: IConnectionProfileGroup[]): void {
		if (group) {
			if (group.fullName !== '') {
				allGroups.push(group);
			}
			if (group.hasChildren()) {
				group.children.forEach((child) => this.flattenGroups(child, allGroups));
			}
		}
	}

	private getAllServerGroups(providers?: string[]): IConnectionProfileGroup[] {
		let connectionGroupRoot = this._connectionManagementService.getConnectionGroups(providers);
		let allGroups: IConnectionProfileGroup[] = [];
		let defaultGroupId: string;
		if (connectionGroupRoot && connectionGroupRoot.length > 0 && ConnectionProfileGroup.isRoot(connectionGroupRoot[0].name)) {
			defaultGroupId = connectionGroupRoot[0].id;
		} else {
			defaultGroupId = Utils.defaultGroupId;
		}
		allGroups.push(assign({}, this._connectionWidget.DefaultServerGroup, { id: defaultGroupId }));
		allGroups.push(this._connectionWidget.NoneServerGroup);
		if (connectionGroupRoot && connectionGroupRoot.length > 0) {
			this.flattenGroups(connectionGroupRoot[0], allGroups);
		}
		connectionGroupRoot.forEach(cpg => cpg.dispose());
		return allGroups;
	}

	public initDialog(providers: string[], connectionInfo: IConnectionProfile): void {
		this._connectionWidget.updateServerGroup(this.getAllServerGroups(providers));
		this._model = connectionInfo;
		this._model.providerName = this._providerName;
		let appNameOption = find(this._providerOptions, option => option.specialValueType === ConnectionOptionSpecialType.appName);
		if (appNameOption) {
			let appNameKey = appNameOption.name;
			this._model.options[appNameKey] = Constants.applicationName;
		}
		this._connectionWidget.initDialog(this._model);
	}

	public focusOnOpen(): void {
		this._connectionWidget.focusOnOpen();
	}

	public validateConnection(): IConnectionValidateResult {
		return { isValid: this._connectionWidget.connect(this._model), connection: this._model };
	}

	public fillInConnectionInputs(connectionInfo: IConnectionProfile): void {
		this._model = connectionInfo;
		this._connectionWidget.fillInConnectionInputs(connectionInfo);
	}

	public handleOnConnecting(): void {
		this._connectionWidget.handleOnConnecting();
	}

	public handleResetConnection(): void {
		this._connectionWidget.handleResetConnection();
	}

	public closeDatabaseDropdown(): void {
		this._connectionWidget.closeDatabaseDropdown();
	}

	public get databaseDropdownExpanded(): boolean {
		return this._connectionWidget.databaseDropdownExpanded;
	}

	public set databaseDropdownExpanded(val: boolean) {
		this._connectionWidget.databaseDropdownExpanded = val;
	}
}
