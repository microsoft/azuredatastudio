/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionComponentCallbacks } from 'sql/workbench/services/connection/browser/connectionDialogService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ConnectionProviderProperties } from 'sql/workbench/parts/connection/common/connectionProviderExtension';
import { ConnectionController } from 'sql/workbench/services/connection/browser/connectionController';
import { CmsConnectionWidget } from 'sql/workbench/services/connection/browser/cmsConnectionWidget';
import { IServerGroupController } from 'sql/platform/serverGroup/common/serverGroupController';

/**
 * Connection Controller for CMS Connections
 */
export class CmsConnectionController extends ConnectionController {

	constructor(
		connectionProperties: ConnectionProviderProperties,
		callback: IConnectionComponentCallbacks,
		providerName: string,
		@IConnectionManagementService _connectionManagementService: IConnectionManagementService,
		@IInstantiationService _instantiationService: IInstantiationService,
		@IServerGroupController _serverGroupController: IServerGroupController
	) {
		super(connectionProperties, callback, providerName, _connectionManagementService, _instantiationService, _serverGroupController);
		let specialOptions = this._providerOptions.filter(
			(property) => (property.specialValueType !== null && property.specialValueType !== undefined));
		this._connectionWidget = this._instantiationService.createInstance(CmsConnectionWidget, specialOptions, {
			onSetConnectButton: (enable: boolean) => this._callback.onSetConnectButton(enable),
			onCreateNewServerGroup: () => this.onCreateNewServerGroup(),
			onAdvancedProperties: () => this.handleOnAdvancedProperties(),
			onSetAzureTimeOut: () => this.handleonSetAzureTimeOut(),
			onFetchDatabases: (serverName: string, authenticationType: string, userName?: string, password?: string) => this.onFetchDatabases(
				serverName, authenticationType, userName, password).then(result => {
					return result;
				})
		}, providerName);
	}

	public showUiComponent(container: HTMLElement, authTypeChanged: boolean = false): void {
		this._databaseCache = new Map<string, string[]>();
		this._connectionWidget.createConnectionWidget(container, authTypeChanged);
	}
}
