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

	getErrorHandleStatus(errorCode: number, errorMessage: string, providerName: string, ownerUri: string): Thenable<Contracts.errorCodes> {
		let params: Contracts.ErrorHandlerParameters = { errorCode: errorCode, errorMessage: errorMessage, providerName: providerName, ownerUri: ownerUri };
		return this.client.sendRequest(Contracts.ErrorHandlerRequest.type, params).then(
			r => {
				return undefined;
			},
			e => {
				this.client.logFailedRequest(Contracts.ErrorHandlerRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}
}
