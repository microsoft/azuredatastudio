/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { IConnectionComponentCallbacks, IConnectionComponentController, IConnectionValidateResult } from 'sql/parts/connection/connectionDialog/connectionDialogService';
import { ConnectionWidget } from 'sql/parts/connection/connectionDialog/connectionWidget';
import { AdvancedPropertiesController } from 'sql/parts/connection/connectionDialog/advancedPropertiesController';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { ConnectionProfileGroup, IConnectionProfileGroup } from 'sql/parts/connection/common/connectionProfileGroup';
import * as Constants from 'sql/parts/connection/common/constants';
import data = require('data');
import * as Utils from 'sql/parts/connection/common/utils';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ConnectionOptionSpecialType } from 'sql/workbench/api/common/sqlExtHostTypes';

export class ConnectionController implements IConnectionComponentController {
	private _container: HTMLElement;
	private _connectionManagementService: IConnectionManagementService;
	private _callback: IConnectionComponentCallbacks;
	private _connectionWidget: ConnectionWidget;
	private _advancedController: AdvancedPropertiesController;
	private _model: IConnectionProfile;
	private _providerOptions: data.ConnectionOption[];
	private _providerName: string;
	/* key: uri, value : list of databases */
	private _databaseCache = new Map<string, string[]>();

	constructor(container: HTMLElement,
		connectionManagementService: IConnectionManagementService,
		sqlCapabilities: data.DataProtocolServerCapabilities,
		callback: IConnectionComponentCallbacks,
		providerName: string,
		@IInstantiationService private _instantiationService: IInstantiationService, ) {
		this._container = container;
		this._connectionManagementService = connectionManagementService;
		this._callback = callback;
		this._providerOptions = sqlCapabilities.connectionProvider.options;
		var specialOptions = this._providerOptions.filter(
			(property) => (property.specialValueType !== null && property.specialValueType !== undefined));
		this._connectionWidget = this._instantiationService.createInstance(ConnectionWidget, specialOptions, {
			onSetConnectButton: (enable: boolean) => this._callback.onSetConnectButton(enable),
			onCreateNewServerGroup: () => this.onCreateNewServerGroup(),
			onAdvancedProperties: () => this.handleOnAdvancedProperties(),
			onSetAzureTimeOut: () => this.handleonSetAzureTimeOut(),
			onFetchDatabases: (serverName: string, authenticationType: string, userName?: string, password?: string) => this.onFetchDatabases(
				serverName, authenticationType, userName, password).then(result => {
				return result;
			})
		}, providerName);
		this._providerName = providerName;
	}

	private onFetchDatabases(serverName: string, authenticationType: string, userName?: string, password?: string): Promise<string[]> {
		let tempProfile = this._model;
		tempProfile.serverName = serverName;
		tempProfile.authenticationType = authenticationType;
		tempProfile.userName = userName;
		tempProfile.password = password;
		let uri = this._connectionManagementService.getConnectionId(tempProfile);
		return new Promise<string[]>((resolve, reject) => {
			if (this._databaseCache.has(uri)) {
				let cachedDatabases : string[] = this._databaseCache.get(uri);
				if (cachedDatabases !== null) {
					resolve(cachedDatabases);
				} else {
					reject();
				}
			} else {
				this._connectionManagementService.connect(tempProfile, uri).then(connResult => {
					if (connResult && connResult.connected) {
						this._connectionManagementService.listDatabases(uri).then(result => {
							if (result && result.databaseNames) {
								this._databaseCache.set(uri, result.databaseNames);
								resolve(result.databaseNames);
							} else {
								this._databaseCache.set(uri, null);
								reject();
							}
						})
					} else {
						reject(connResult.errorMessage);
					}
				});
			}
		});
	}

	private onCreateNewServerGroup(): void {
		this._connectionManagementService.showCreateServerGroupDialog({
			onAddGroup: (groupName) => this._connectionWidget.updateServerGroup(this.getAllServerGroups(), groupName),
			onClose: () => this._connectionWidget.focusOnServerGroup()
		});
	}

	private handleonSetAzureTimeOut(): void {
		var timeoutPropertyName = 'connectTimeout';
		var timeoutOption = this._model.options[timeoutPropertyName];
		if (timeoutOption === undefined || timeoutOption === null) {
			this._model.options[timeoutPropertyName] = 30;
		}
	}

	private handleOnAdvancedProperties(): void {
		if (!this._advancedController) {
			this._advancedController = this._instantiationService.createInstance(AdvancedPropertiesController, () => this._connectionWidget.focusOnAdvancedButton());
		}
		var advancedOption = this._providerOptions.filter(
			(property) => (property.specialValueType === undefined || property.specialValueType === null));
		this._advancedController.showDialog(advancedOption, this._container, this._model.options);
	}

	public showUiComponent(container: HTMLElement): void {
		this._connectionWidget.createConnectionWidget(container);
	}

	private getServerGroupHelper(group: ConnectionProfileGroup, groupNames: IConnectionProfileGroup[]): void {
		if (group) {
			if (group.fullName !== '') {
				groupNames.push(group);
			}
			if (group.hasChildren()) {
				group.children.forEach((child) => this.getServerGroupHelper(child, groupNames));
			}
		}
	}

	private getAllServerGroups(): IConnectionProfileGroup[] {
		var connectionGroupRoot = this._connectionManagementService.getConnectionGroups();
		var connectionGroupNames: IConnectionProfileGroup[] = [];
		if (connectionGroupRoot && connectionGroupRoot.length > 0) {
			this.getServerGroupHelper(connectionGroupRoot[0], connectionGroupNames);
		}
		let defaultGroupId: string;
		if (connectionGroupRoot && connectionGroupRoot.length > 0 && ConnectionProfileGroup.isRoot(connectionGroupRoot[0].name)) {
			defaultGroupId = connectionGroupRoot[0].id;
		} else {
			defaultGroupId = Utils.defaultGroupId;
		}
		connectionGroupNames.push(Object.assign({}, this._connectionWidget.DefaultServerGroup, { id: defaultGroupId }));
		connectionGroupNames.push(this._connectionWidget.NoneServerGroup);
		return connectionGroupNames;
	}

	public initDialog(connectionInfo: IConnectionProfile): void {
		this._connectionWidget.updateServerGroup(this.getAllServerGroups());
		this._model = connectionInfo;
		this._model.providerName = this._providerName;
		let appNameOption = this._providerOptions.find(option => option.specialValueType === ConnectionOptionSpecialType.appName);
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
}