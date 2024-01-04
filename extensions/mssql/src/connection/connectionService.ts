/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from './constants';
import * as contracts from '../contracts';

import { BaseService, ISqlOpsFeature, SqlOpsDataClient } from 'dataprotocol-client';
import { ClientCapabilities } from 'vscode-languageclient';
import { AppContext } from '../appContext';

export class ConnectionService extends BaseService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends ConnectionService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(_: ClientCapabilities): void { }
			initialize(): void { }
		};
	}

	private constructor(context: AppContext, client: SqlOpsDataClient) {
		super(client);
		context.registerService(constants.ConnectionService, this);
	}

	async clearPooledConnections(): Promise<void> {
		return this.runWithErrorHandling(contracts.ClearPooledConnectionsRequest.type, {});
	}
}
