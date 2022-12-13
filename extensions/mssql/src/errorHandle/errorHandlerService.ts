/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature, SqlOpsFeature } from 'dataprotocol-client';
import { ClientCapabilities, ServerCapabilities } from 'vscode-languageclient';
import { Disposable } from 'vscode';
import * as Contracts from './contracts';
export class ErrorHandlerService extends SqlOpsFeature<any> {



	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends ErrorHandlerService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			override fillClientCapabilities(capabilities: ClientCapabilities): void {
			}

			override initialize(): void {
			}
		};
	}

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		super(client, []);
	}

	fillClientCapabilities(capabilities: ClientCapabilities): void { }

	initialize(capabilities: ServerCapabilities): void { }

	protected registerProvider(options: any): Disposable { return undefined; }

	protected async getToken(request: Contracts.ErrorHandlerParameters): Promise<Contracts.errorCodes | undefined> {
		return Promise.resolve(undefined);
	}
}
