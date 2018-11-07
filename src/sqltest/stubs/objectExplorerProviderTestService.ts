/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as sqlops from 'sqlops';

// Test stubs for commonly used objects

export class ObjectExplorerProviderTestService implements sqlops.ObjectExplorerProvider {

	public readonly providerId = 'MSSQL';

	public createNewSession(connInfo: sqlops.ConnectionInfo): Thenable<sqlops.ObjectExplorerCloseSessionResponse> {
		return Promise.resolve(undefined);
	}

	public expandNode(nodeInfo: sqlops.ExpandNodeInfo): Thenable<boolean> {
		return Promise.resolve(undefined);
	}

	public refreshNode(nodeInfo: sqlops.ExpandNodeInfo): Thenable<boolean> {
		return Promise.resolve(undefined);
	}

	public closeSession(closeSessionInfo: sqlops.ObjectExplorerCloseSessionInfo): Thenable<sqlops.ObjectExplorerCloseSessionResponse> {
		return Promise.resolve(undefined);
	}

	public registerOnSessionCreated(handler: (response: sqlops.ObjectExplorerSession) => any): void {

	}

	public registerOnSessionDisconnected(handler: (response: sqlops.ObjectExplorerSession) => any): void {

	}

	public registerOnExpandCompleted(handler: (response: sqlops.ObjectExplorerExpandInfo) => any): void {

	}

	public findNodes(findNodesInfo: sqlops.FindNodesInfo): Thenable<sqlops.ObjectExplorerFindNodesResponse> {
		return undefined;
	}
}