/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import data = require('data');

// Test stubs for commonly used objects

export class ObjectExplorerProviderTestService implements data.ObjectExplorerProvider {

	public readonly providerId = 'MSSQL';

	public createNewSession(connInfo: data.ConnectionInfo): Thenable<data.ObjectExplorerCloseSessionResponse> {
		return Promise.resolve(undefined);
	}

	public expandNode(nodeInfo: data.ExpandNodeInfo): Thenable<boolean> {
		return Promise.resolve(undefined);
	}

	public refreshNode(nodeInfo: data.ExpandNodeInfo): Thenable<boolean> {
		return Promise.resolve(undefined);
	}

	public closeSession(closeSessionInfo: data.ObjectExplorerCloseSessionInfo): Thenable<data.ObjectExplorerCloseSessionResponse> {
		return Promise.resolve(undefined);
	}

	public registerOnSessionCreated(handler: (response: data.ObjectExplorerSession) => any): void {

	}

	public registerOnExpandCompleted(handler: (response: data.ObjectExplorerExpandInfo) => any): void {

	}
}