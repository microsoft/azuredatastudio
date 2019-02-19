/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { SqlExtHostContext, SqlMainContext, ExtHostConnectionManagementShape, MainThreadConnectionManagementShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import * as sqlops from 'sqlops';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import * as TaskUtilities from 'sql/workbench/common/taskUtilities';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { generateUuid } from 'vs/base/common/uuid';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';

@extHostNamedCustomer(SqlMainContext.MainThreadConnectionManagement)
export class MainThreadConnectionManagement implements MainThreadConnectionManagementShape {

	private _proxy: ExtHostConnectionManagementShape;
	private _toDispose: IDisposable[];

	constructor(
		extHostContext: IExtHostContext,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IEditorService private _workbenchEditorService: IEditorService,
		@IConnectionDialogService private _connectionDialogService: IConnectionDialogService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService
	) {
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostConnectionManagement);
		}
		this._toDispose = [];
	}

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
	}

	public $getActiveConnections(): Thenable<sqlops.connection.Connection[]> {
		return Promise.resolve(this._connectionManagementService.getActiveConnections().map(profile => this.convertConnection(profile)));
	}

	public $getCurrentConnection(): Thenable<sqlops.connection.Connection> {
		return Promise.resolve(this.convertConnection(TaskUtilities.getCurrentGlobalConnection(this._objectExplorerService, this._connectionManagementService, this._workbenchEditorService, true)));
	}

	public $getCredentials(connectionId: string): Thenable<{ [name: string]: string }> {
		return Promise.resolve(this._connectionManagementService.getActiveConnectionCredentials(connectionId));
	}

	public $getServerInfo(connectionId: string): Thenable<sqlops.ServerInfo> {
		return Promise.resolve(this._connectionManagementService.getServerInfo(connectionId));
	}

	public async $openConnectionDialog(providers: string[], initialConnectionProfile?: IConnectionProfile, connectionCompletionOptions?: sqlops.IConnectionCompletionOptions): Promise<sqlops.connection.Connection> {
		let connectionProfile = await this._connectionDialogService.openDialogAndWait(this._connectionManagementService, { connectionType: 1, providers: providers }, initialConnectionProfile);
		const connection = connectionProfile ? {
			connectionId: connectionProfile.id,
			options: connectionProfile.options,
			providerName: connectionProfile.providerName
		} : undefined;

		if (connectionCompletionOptions) {
			// Somehow, connectionProfile.saveProfile is false even if initialConnectionProfile.saveProfile is true, reset the flag here.
			connectionProfile.saveProfile = initialConnectionProfile.saveProfile;
			await this._connectionManagementService.connectAndSaveProfile(connectionProfile, undefined, {
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

	private convertConnection(profile: IConnectionProfile): sqlops.connection.Connection {
		if (!profile) {
			return undefined;
		}
		profile = this._connectionManagementService.removeConnectionProfileCredentials(profile);
		let connection: sqlops.connection.Connection = {
			providerName: profile.providerName,
			connectionId: profile.id,
			options: profile.options
		};
		return connection;
	}

	public $connect(connectionProfile: IConnectionProfile): Thenable<sqlops.ConnectionResult> {
		let profile = new ConnectionProfile(this._capabilitiesService, connectionProfile);
		profile.id = generateUuid();
		return this._connectionManagementService.connectAndSaveProfile(profile, undefined, {
			saveTheConnection: true,
			showDashboard: true,
			params: undefined,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		}).then((result) => {
			return <sqlops.ConnectionResult>{
				connected: result.connected,
				connectionId: result.connected ? profile.id : undefined,
				errorCode: result.errorCode,
				errorMessage: result.errorMessage
			};
		});
	}
}
