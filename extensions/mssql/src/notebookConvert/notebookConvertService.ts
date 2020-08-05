/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature } from 'dataprotocol-client';
import { ClientCapabilities } from 'vscode-languageclient';
import * as constants from '../constants';
import * as contracts from '../contracts';

export interface INotebookConvertService {
	convertNotebookToSql(content: string): Promise<contracts.ConvertNotebookToSqlResult | undefined>;
	convertSqlToNotebook(content: string): Promise<contracts.ConvertSqlToNotebookResult | undefined>;
}

export class NotebookConvertService implements INotebookConvertService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends NotebookConvertService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(capabilities: ClientCapabilities): void {
			}

			initialize(): void {
			}
		};
	}

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		context.registerService(constants.NotebookConvertService, this);
	}

	async convertNotebookToSql(content: string): Promise<contracts.ConvertNotebookToSqlResult | undefined> {
		let params: contracts.ConvertNotebookToSqlParams = { content: content };
		try {
			return this.client.sendRequest(contracts.ConvertNotebookToSqlRequest.type, params);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.ConvertNotebookToSqlRequest.type, e);
		}

		return undefined;
	}
	async convertSqlToNotebook(content: string): Promise<contracts.ConvertSqlToNotebookResult | undefined> {
		let params: contracts.ConvertSqlToNotebookParams = { clientUri: content };
		try {
			return this.client.sendRequest(contracts.ConvertSqlToNotebookRequest.type, params);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.ConvertSqlToNotebookRequest.type, e);
		}

		return undefined;
	}
}
