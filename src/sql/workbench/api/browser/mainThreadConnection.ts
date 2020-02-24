/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlMainContext, MainThreadConnectionShape, ExtHostConnectionShape, SqlExtHostContext } from 'sql/workbench/api/common/sqlExtHost.protocol';
import * as azdata from 'azdata';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { IConnectionManagementService, ConnectionType } from 'sql/platform/connection/common/connectionManagement';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import * as TaskUtilities from 'sql/workbench/browser/taskUtilities';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { Disposable, combinedDisposable, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { generateUuid } from 'vs/base/common/uuid';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { deepClone } from 'vs/base/common/objects';
import { IProviderConnectionChangedEvent, IProviderConnectionCompleteEvent, IConnectionService } from 'sql/platform/connection/common/connectionService';
import { Emitter } from 'vs/base/common/event';
import { values } from 'vs/base/common/collections';

interface ConnectionEvents {
	onDidConnectionComplete: Emitter<IProviderConnectionCompleteEvent>;
	onDidConnectionChange: Emitter<IProviderConnectionChangedEvent>;
}

@extHostNamedCustomer(SqlMainContext.MainThreadConnection)
export class MainThreadConnection extends Disposable implements MainThreadConnectionShape {

	private readonly _proxy: ExtHostConnectionShape;
	private readonly _connectionEvents = new Map<number, ConnectionEvents>();
	private readonly _registrations = new Map<number, IDisposable>();

	constructor(
		extHostContext: IExtHostContext,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IEditorService private _workbenchEditorService: IEditorService,
		@IConnectionDialogService private _connectionDialogService: IConnectionDialogService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IConnectionService private readonly connectionService: IConnectionService,
	) {
		super();
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostConnection);
		}
	}

	//#region connection
	public async $registerProvider(providerId: string, handle: number): Promise<void> {
		const emitters = {
			onDidConnectionChange: new Emitter<IProviderConnectionChangedEvent>(),
			onDidConnectionComplete: new Emitter<IProviderConnectionCompleteEvent>()
		};
		this._connectionEvents.set(handle, emitters);
		const disposable = this.connectionService.registerProvider({
			id: providerId,
			connect: (connectionUri: string, options: { [name: string]: any }): Promise<boolean> => {
				return this._proxy.$connect(handle, connectionUri, { options });
			},
			disconnect: (connectionUri: string): Promise<boolean> => {
				return this._proxy.$disconnect(handle, connectionUri);
			},
			cancelConnect: (connectionUri: string): Promise<boolean> => {
				return this._proxy.$cancelConnect(handle, connectionUri);
			},
			onDidConnectionChanged: emitters.onDidConnectionChange.event,
			onDidConnectionComplete: emitters.onDidConnectionComplete.event
		});

		this._registrations.set(handle,
			combinedDisposable(
				disposable,
				...values(emitters),
				toDisposable(() => this._connectionEvents.delete(handle))
			)
		);
	}

	public $onConnectionComplete(handle: number, connectionInfoSummary: azdata.ConnectionInfoSummary): void {
		this._connectionEvents.get(handle)?.onDidConnectionComplete.fire({ connectionUri: connectionInfoSummary.ownerUri, errorMessage: connectionInfoSummary.errorMessage || connectionInfoSummary.messages });
	}

	public $onConnectionChangeNotification(handle: number, changedConnInfo: azdata.ChangedConnectionInfo): void {
		this._connectionEvents.get(handle)?.onDidConnectionChange.fire(changedConnInfo);
	}

	public $onIntelliSenseCacheComplete(handle: number, connectionUri: string): void {
		this._connectionManagementService.onIntelliSenseCacheComplete(handle, connectionUri);
	}
	//#endregion connection

	public async $unregisterProvider(handle: number): Promise<void> {
		const disposable = this._registrations.get(handle);
		if (disposable) {
			disposable.dispose();
			this._registrations.delete(handle);
		}
	}

	public $registerConnectionEventListener(handle: number, providerId: string): void {

		// let stripProfile = (inputProfile: azdata.IConnectionProfile) => {
		// 	if (!inputProfile) {
		// 		return inputProfile;
		// 	}

		// 	let outputProfile: azdata.IConnectionProfile = {
		// 		connectionName: inputProfile.connectionName,
		// 		serverName: inputProfile.serverName,
		// 		databaseName: inputProfile.databaseName,
		// 		userName: inputProfile.userName,
		// 		password: inputProfile.password,
		// 		authenticationType: inputProfile.authenticationType,
		// 		savePassword: inputProfile.savePassword,
		// 		groupFullName: inputProfile.groupFullName,
		// 		groupId: inputProfile.groupId,
		// 		providerName: inputProfile.providerName,
		// 		saveProfile: inputProfile.saveProfile,
		// 		id: inputProfile.id,
		// 		azureTenantId: inputProfile.azureTenantId,
		// 		azureAccount: inputProfile.azureAccount,
		// 		options: inputProfile.options
		// 	};
		// 	return outputProfile;
		// };

		// this._connectionManagementService.onConnect((params: IConnectionParams) => {
		// 	this._proxy.$onConnectionEvent(handle, 'onConnect', params.connectionUri, stripProfile(params.connectionProfile));
		// });

		// this._connectionManagementService.onConnectionChanged((params: IConnectionParams) => {
		// 	this._proxy.$onConnectionEvent(handle, 'onConnectionChanged', params.connectionUri, stripProfile(params.connectionProfile));
		// });

		// this._connectionManagementService.onDisconnect((params: IConnectionParams) => {
		// 	this._proxy.$onConnectionEvent(handle, 'onDisconnect', params.connectionUri, stripProfile(params.connectionProfile));
		// });
	}

	public $getConnections(activeConnectionsOnly?: boolean): Thenable<azdata.connection.ConnectionProfile[]> {
		return Promise.resolve(this._connectionManagementService.getConnections(activeConnectionsOnly).map(profile => this.convertToConnectionProfile(profile)));
	}

	public $getConnection(uri: string): Thenable<azdata.connection.ConnectionProfile> {
		let profile = this._connectionManagementService.getConnection(uri);
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
		return Promise.resolve(this.convertConnection(TaskUtilities.getCurrentGlobalConnection(this._objectExplorerService, this._connectionManagementService, this._workbenchEditorService, true)));
	}

	public $getCurrentConnectionProfile(): Thenable<azdata.connection.ConnectionProfile> {
		return Promise.resolve(this.convertToConnectionProfile(TaskUtilities.getCurrentGlobalConnection(this._objectExplorerService, this._connectionManagementService, this._workbenchEditorService, true)));
	}

	public $getCredentials(connectionId: string): Thenable<{ [name: string]: string }> {
		return Promise.resolve(this._connectionManagementService.getActiveConnectionCredentials(connectionId));
	}

	public $getServerInfo(connectionId: string): Thenable<azdata.ServerInfo> {
		return Promise.resolve(this._connectionManagementService.getServerInfo(connectionId));
	}

	public async $openConnectionDialog(providers: string[], initialConnectionProfile?: IConnectionProfile, connectionCompletionOptions?: azdata.IConnectionCompletionOptions): Promise<azdata.connection.Connection> {
		// Here we default to ConnectionType.editor which saves the connecton in the connection store by default
		let connectionType = ConnectionType.editor;

		// If the API call explicitly set saveConnection to false, set it to ConnectionType.extension
		// which doesn't save the connection by default
		if (connectionCompletionOptions && !connectionCompletionOptions.saveConnection) {
			connectionType = ConnectionType.temporary;
		}
		let connectionProfile = await this._connectionDialogService.openDialogAndWait(
			{ connectionType: connectionType, providers: providers }, initialConnectionProfile, undefined);
		if (connectionProfile) {
			(connectionProfile as any).options.savePassword = (connectionProfile as any).savePassword;
		}
		const connection = connectionProfile ? {
			connectionId: (connectionProfile as any).id,
			options: (connectionProfile as any).options,
			providerName: (connectionProfile as any).providerName
		} : undefined;

		if (connectionCompletionOptions && connectionCompletionOptions.saveConnection) {
			// Somehow, connectionProfile.saveProfile is false even if initialConnectionProfile.saveProfile is true, reset the flag here.
			(connectionProfile as any).saveProfile = initialConnectionProfile.saveProfile;
			await this._connectionManagementService.connectAndSaveProfile((connectionProfile as any), undefined, {
				saveTheConnection: isUndefinedOrNull(connectionCompletionOptions.saveConnection) ? true : connectionCompletionOptions.saveConnection,
				showDashboard: isUndefinedOrNull(connectionCompletionOptions.showDashboard) ? false : connectionCompletionOptions.showDashboard,
				params: undefined,
				showConnectionDialogOnError: isUndefinedOrNull(connectionCompletionOptions.showConnectionDialogOnError) ? true : connectionCompletionOptions.showConnectionDialogOnError,
				showFirewallRuleOnError: isUndefinedOrNull(connectionCompletionOptions.showFirewallRuleOnError) ? true : connectionCompletionOptions.showFirewallRuleOnError
			});
		}
		return connection;
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
			params: undefined,
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
