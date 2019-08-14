/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';

// Test stubs for commonly used objects

export class TestObjectExplorerProvider implements azdata.ObjectExplorerProvider {

	public readonly providerId = mssqlProviderName;

	public createNewSession(connInfo: azdata.ConnectionInfo): Thenable<azdata.ObjectExplorerCloseSessionResponse> {
		return Promise.resolve(undefined);
	}

	public expandNode(nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> {
		return Promise.resolve(undefined);
	}

	public refreshNode(nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> {
		return Promise.resolve(undefined);
	}

	public closeSession(closeSessionInfo: azdata.ObjectExplorerCloseSessionInfo): Thenable<azdata.ObjectExplorerCloseSessionResponse> {
		return Promise.resolve(undefined);
	}

	public registerOnSessionCreated(handler: (response: azdata.ObjectExplorerSession) => any): void {

	}

	public registerOnSessionDisconnected(handler: (response: azdata.ObjectExplorerSession) => any): void {

	}

	public registerOnExpandCompleted(handler: (response: azdata.ObjectExplorerExpandInfo) => any): void {

	}

	public findNodes(findNodesInfo: azdata.FindNodesInfo): Thenable<azdata.ObjectExplorerFindNodesResponse> {
		return undefined;
	}
}