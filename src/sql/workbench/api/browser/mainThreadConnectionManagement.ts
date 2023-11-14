/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtHostConnectionManagementShape, MainThreadConnectionManagementShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import * as azdata from 'azdata';
import { IConnectionManagementService, ConnectionType, IConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import * as TaskUtilities from 'sql/workbench/browser/taskUtilities';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { Disposable, DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { generateUuid } from 'vs/base/common/uuid';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { deepClone } from 'vs/base/common/objects';
import { extHostNamedCustomer, IExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { SqlExtHostContext, SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { ILogService } from 'vs/platform/log/common/log';

@extHostNamedCustomer(SqlMainContext.MainThreadConnectionManagement)
export class MainThreadConnectionManagement extends Disposable implements MainThreadConnectionManagementShape {

	private _proxy: ExtHostConnectionManagementShape;
	private _connectionEventListenerDisposables = new Map<number, IDisposable>();

	constructor(
		extHostContext: IExtHostContext,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IEditorService private _workbenchEditorService: IEditorService,
		@IConnectionDialogService private _connectionDialogService: IConnectionDialogService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@ILogService private _logService: ILogService
	) {
		super();
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostConnectionManagement);
		}
	}

	public $registerConnectionEventListener(handle: number): void {

		let stripProfile = (inputProfile: azdata.IConnectionProfile) => {
			if (!inputProfile) {
				return inputProfile;
			}

			let outputProfile: azdata.IConnectionProfile = {
				connectionName: inputProfile.connectionName,
				serverName: inputProfile.serverName,
				databaseName: inputProfile.databaseName,
				userName: inputProfile.userName,
				password: inputProfile.password,
				authenticationType: inputProfile.authenticationType,
				savePassword: inputProfile.savePassword,
				groupFullName: inputProfile.groupFullName,
				groupId: inputProfile.groupId,
				providerName: inputProfile.providerName,
				saveProfile: inputProfile.saveProfile,
				id: inputProfile.id,
				azureTenantId: inputProfile.azureTenantId,
				azureAccount: inputProfile.azureAccount,
				options: inputProfile.options
			};
			return outputProfile;
		};

		const disposable = new DisposableStore();
		disposable.add(this._connectionManagementService.onConnect((params: IConnectionParams) => {
			this._proxy.$onConnectionEvent(handle, 'onConnect', params.connectionUri, stripProfile(params.connectionProfile));
		}));

		disposable.add(this._connectionManagementService.onConnectionChanged((params: IConnectionParams) => {
			this._proxy.$onConnectionEvent(handle, 'onConnectionChanged', params.connectionUri, stripProfile(params.connectionProfile));
		}));

		disposable.add(this._connectionManagementService.onDisconnect((params: IConnectionParams) => {
			this._proxy.$onConnectionEvent(handle, 'onDisconnect', params.connectionUri, stripProfile(params.connectionProfile));
		}));

		this._connectionEventListenerDisposables.set(handle, disposable);
	}

	public $unregisterConnectionEventListener(handle: number): void {
		const disposable = this._connectionEventListenerDisposables.get(handle);
		if (disposable) {
			disposable.dispose();
			this._connectionEventListenerDisposables.delete(handle);
		}
	}

	public $getConnections(activeConnectionsOnly?: boolean): Thenable<azdata.connection.ConnectionProfile[]> {
		return Promise.resolve(this._connectionManagementService.getConnections(activeConnectionsOnly).map(profile => this.convertToConnectionProfile(profile)));
	}

	public $getConnection(uri: string): Thenable<azdata.connection.ConnectionProfile> {
		const profile = this._connectionManagementService.getConnectionProfile(uri);
		if (!profile) {
			return Promise.resolve(undefined);
		}

		let connection: azdata.connection.ConnectionProfile = {
			providerId: profile.providerName,
			connectionId: profile.id,
			connectionName: profile.connectionName,
			serverName: profile.serverName,
			databaseName: profile.databaseName,
			userName: profile.userName,
			password: profile.password,
			authenticationType: profile.authenticationType,
			savePassword: profile.savePassword,
			groupFullName: profile.groupFullName,
			groupId: profile.groupId,
			saveProfile: profile.savePassword,
			azureTenantId: profile.azureTenantId,
			options: profile.options
		};
		return Promise.resolve(connection);
	}

	public $getActiveConnections(): Thenable<azdata.connection.Connection[]> {
		return Promise.resolve(this._connectionManagementService.getActiveConnections().map(profile => this.convertConnection(profile)));
	}

	public $getCurrentConnection(): Thenable<azdata.connection.Connection> {
		return Promise.resolve(this.convertConnection(TaskUtilities.getCurrentGlobalConnection(this._objectExplorerService, this._connectionManagementService, this._workbenchEditorService, this._logService, true)));
	}

	public $getCurrentConnectionProfile(): Thenable<azdata.connection.ConnectionProfile> {
		return Promise.resolve(this.convertToConnectionProfile(TaskUtilities.getCurrentGlobalConnection(this._objectExplorerService, this._connectionManagementService, this._workbenchEditorService, this._logService, true)));
	}

	public $getCredentials(connectionId: string): Thenable<{ [name: string]: string }> {
		return Promise.resolve(this._connectionManagementService.getConnectionCredentials(connectionId));
	}

	public $getServerInfo(connectionId: string): Thenable<azdata.ServerInfo> {
		return Promise.resolve(this._connectionManagementService.getServerInfo(connectionId));
	}

	public async $openConnectionDialog(providers: string[], initialConnectionProfile?: IConnectionProfile, connectionCompletionOptions?: azdata.IConnectionCompletionOptions): Promise<azdata.connection.Connection | undefined> {
		if (initialConnectionProfile?.providerName && this._capabilitiesService.providers[initialConnectionProfile.providerName] === undefined) {
			await this._connectionManagementService.handleUnsupportedProvider(initialConnectionProfile.providerName);
			return undefined;
		}

		// Here we default to ConnectionType.default which saves the connection in the connection store and server tree by default
		let connectionType = ConnectionType.default;

		// If the API call explicitly set saveConnection to false, set it to ConnectionType.extension
		// which doesn't save the connection by default
		if (connectionCompletionOptions && !connectionCompletionOptions.saveConnection) {
			connectionType = ConnectionType.temporary;
		}
		let connectionProfile = await this._connectionDialogService.openDialogAndWait(this._connectionManagementService,
			{ connectionType: connectionType, providers: providers }, initialConnectionProfile, undefined);

		if (!connectionProfile) {
			return undefined;
		}

		connectionProfile.options.savePassword = connectionProfile.savePassword;
		const connection = connectionProfile ? {
			connectionId: connectionProfile.id,
			options: connectionProfile.options,
			providerName: connectionProfile.providerName
		} : undefined;

		if (connectionCompletionOptions && connectionCompletionOptions.saveConnection) {
			await this._connectionManagementService.connectAndSaveProfile(connectionProfile, undefined, {
				saveTheConnection: isUndefinedOrNull(connectionCompletionOptions.saveConnection) ? true : connectionCompletionOptions.saveConnection,
				showDashboard: isUndefinedOrNull(connectionCompletionOptions.showDashboard) ? false : connectionCompletionOptions.showDashboard,
				showConnectionDialogOnError: isUndefinedOrNull(connectionCompletionOptions.showConnectionDialogOnError) ? true : connectionCompletionOptions.showConnectionDialogOnError,
				showFirewallRuleOnError: isUndefinedOrNull(connectionCompletionOptions.showFirewallRuleOnError) ? true : connectionCompletionOptions.showFirewallRuleOnError
			});
		}
		return connection;
	}

	public $openChangePasswordDialog(profile: IConnectionProfile): Thenable<string | undefined> {
		// Need to have access to getOptionsKey, so recreate profile from details.
		let convertedProfile = new ConnectionProfile(this._capabilitiesService, profile);
		return this._connectionManagementService.openChangePasswordDialog(convertedProfile);
	}

	public $getNonDefaultOptions(profile: azdata.IConnectionProfile): Thenable<string> {
		let convertedProfile = new ConnectionProfile(this._capabilitiesService, profile);
		return Promise.resolve(this._connectionManagementService.getNonDefaultOptions(convertedProfile));
	}

	public async $listDatabases(connectionId: string): Promise<string[]> {
		let connectionUri = await this.$getUriForConnection(connectionId);
		let result = await this._connectionManagementService.listDatabases(connectionUri);
		return result.databaseNames;
	}

	public async $getConnectionString(connectionId: string, includePassword: boolean): Promise<string> {
		return this._connectionManagementService.getConnectionString(connectionId, includePassword);
	}

	public $getUriForConnection(connectionId: string): Thenable<string> {
		return Promise.resolve(this._connectionManagementService.getConnectionUriFromId(connectionId));
	}

	private convertConnection(profile: IConnectionProfile): azdata.connection.Connection {
		if (!profile) {
			return undefined;
		}
		profile = this._connectionManagementService.removeConnectionProfileCredentials(profile);
		let connection: azdata.connection.Connection = {
			providerName: profile.providerName,
			connectionId: profile.id,
			options: deepClone(profile.options)
		};
		return connection;
	}

	private convertToConnectionProfile(profile: IConnectionProfile): azdata.connection.ConnectionProfile {
		if (!profile) {
			return undefined;
		}

		profile = this._connectionManagementService.removeConnectionProfileCredentials(profile);
		let connection: azdata.connection.ConnectionProfile = {
			providerId: profile.providerName,
			connectionId: profile.id,
			options: deepClone(profile.options),
			connectionName: profile.connectionName,
			serverName: profile.serverName,
			databaseName: profile.databaseName,
			userName: profile.userName,
			password: profile.password,
			authenticationType: profile.authenticationType,
			savePassword: profile.savePassword,
			groupFullName: profile.groupFullName,
			groupId: profile.groupId,
			saveProfile: profile.saveProfile
		};
		return connection;
	}

	public $connect(connectionProfile: IConnectionProfile, saveConnection: boolean = true, showDashboard: boolean = true): Thenable<azdata.ConnectionResult> {
		let profile = new ConnectionProfile(this._capabilitiesService, connectionProfile);
		profile.id = generateUuid();
		return this._connectionManagementService.connectAndSaveProfile(profile, undefined, {
			saveTheConnection: saveConnection,
			showDashboard: showDashboard,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		}).then((result) => {
			return <azdata.ConnectionResult>{
				connected: result.connected,
				connectionId: result.connected ? profile.id : undefined,
				errorCode: result.errorCode,
				errorMessage: result.errorMessage
			};
		});
	}
}
