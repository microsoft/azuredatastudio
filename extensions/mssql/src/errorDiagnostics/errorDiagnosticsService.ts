/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as mssql from 'mssql';
import { ISqlOpsFeature, SqlOpsDataClient } from 'dataprotocol-client';
import * as constants from '../constants';
import * as contracts from '../contracts';
import { AppContext } from '../appContext';
import { ClientCapabilities } from 'vscode-languageclient';

export const diagnosticsId = 'azurediagnostics'
export const serviceName = 'AzureDiagnostics';

export class ErrorDiagnosticsService implements mssql.IErrorDiagnosticsService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends ErrorDiagnosticsService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(capabilities: ClientCapabilities): void {
			}

			initialize(): void {
			}
		};
	}

	public constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		context.registerService(constants.ErrorDiagnosticsService, this);
	}

	async handleErrorCode(errorCode: number, errorMessage: string): Promise<mssql.ErrorDiagnosticsResponse> {
		const params: contracts.ErrorDiagnosticsParameters = { errorCode, errorMessage };
		return this.client.sendRequest(contracts.DiagnosticsRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.DiagnosticsRequest.type, e);
				return Promise.resolve(undefined);
			}
		)
	}
}
