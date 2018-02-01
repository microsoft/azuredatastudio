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

@extHostNamedCustomer(SqlMainContext.MainThreadConnectionManagement)
export class MainThreadConnectionManagement extends MainThreadConnectionManagementShape {

	private _proxy: ExtHostConnectionManagementShape;

	constructor(
		extHostContext: IExtHostContext,
		@IConnectionManagementService private connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private objectExplorerService: IObjectExplorerService,
		@IWorkbenchEditorService private workbenchEditorService: IWorkbenchEditorService
	) {
		super();
		if (extHostContext) {
			this._proxy = extHostContext.get(SqlExtHostContext.ExtHostConnectionManagement);
		}
	}

	public dispose(): void {

	}

	public $getActiveConnections(): Thenable<data.connection.Connection[]> {
		console.log('Connection status length: ' + this.connectionManagementService.getActiveConnections().length);
		console.log('Connection store length: ' + (this.connectionManagementService as any)._connectionStore.getActiveConnections().length);
		return Promise.resolve(this.connectionManagementService.getActiveConnections().map(profile => this.convertConnection(profile)));
	}

	public $getCurrentConnection(): Thenable<data.connection.Connection> {
		return Promise.resolve(this.convertConnection(TaskUtilities.getCurrentGlobalConnection(this.objectExplorerService, this.connectionManagementService, this.workbenchEditorService, true)));
	}

	public $getCredentials(connectionId: string): Thenable<{ [name: string]: string }> {
		return Promise.resolve(this.connectionManagementService.getActiveConnectionCredentials(connectionId));
	}

	private convertConnection(profile: IConnectionProfile): data.connection.Connection {
		if (!profile) {
			return undefined;
		}
		profile = this.connectionManagementService.removeConnectionProfileCredentials(profile);
		let connection: data.connection.Connection = {
			providerName: profile.providerName,
			connectionId: profile.id,
			options: profile.options
		};
		return connection;
	}
}
