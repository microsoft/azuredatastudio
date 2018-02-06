/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { SqlExtHostContext, SqlMainContext, ExtHostConnectionManagementShape, MainThreadConnectionManagementShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import * as data from 'data';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { IObjectExplorerService } from 'sql/parts/registeredServer/common/objectExplorerService';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import * as TaskUtilities from 'sql/workbench/common/taskUtilities';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';

@extHostNamedCustomer(SqlMainContext.MainThreadConnectionManagement)
export class MainThreadConnectionManagement implements MainThreadConnectionManagementShape {

	private _proxy: ExtHostConnectionManagementShape;
	private _toDispose: IDisposable[];

	constructor(
		extHostContext: IExtHostContext,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IWorkbenchEditorService private _workbenchEditorService: IWorkbenchEditorService
	) {
		if (extHostContext) {
			this._proxy = extHostContext.get(SqlExtHostContext.ExtHostConnectionManagement);
		}
		this._toDispose = [];
	}

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
	}

	public $getActiveConnections(): Thenable<data.connection.Connection[]> {
		return Promise.resolve(this._connectionManagementService.getActiveConnections().map(profile => this.convertConnection(profile)));
	}

	public $getCurrentConnection(): Thenable<data.connection.Connection> {
		return Promise.resolve(this.convertConnection(TaskUtilities.getCurrentGlobalConnection(this._objectExplorerService, this._connectionManagementService, this._workbenchEditorService, true)));
	}

	public $getCredentials(connectionId: string): Thenable<{ [name: string]: string }> {
		return Promise.resolve(this._connectionManagementService.getActiveConnectionCredentials(connectionId));
	}

	private convertConnection(profile: IConnectionProfile): data.connection.Connection {
		if (!profile) {
			return undefined;
		}
		profile = this._connectionManagementService.removeConnectionProfileCredentials(profile);
		let connection: data.connection.Connection = {
			providerName: profile.providerName,
			connectionId: profile.id,
			options: profile.options
		};
		return connection;
	}
}
