/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from '../constants';
import * as contracts from '../contracts';

import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature, BaseService } from 'dataprotocol-client';
import { ClientCapabilities } from 'vscode-languageclient';

export interface INotebookConvertService {
	convertNotebookToSql(content: string): Promise<contracts.ConvertNotebookToSqlResult | undefined>;
	convertSqlToNotebook(content: string): Promise<contracts.ConvertSqlToNotebookResult | undefined>;
}

export class NotebookConvertService extends BaseService implements INotebookConvertService {
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

	private constructor(context: AppContext, client: SqlOpsDataClient) {
		super(client);
		context.registerService(constants.NotebookConvertService, this);
	}

	async convertNotebookToSql(content: string): Promise<contracts.ConvertNotebookToSqlResult | undefined> {
		let params: contracts.ConvertNotebookToSqlParams = { content: content };
		return this.runWithErrorHandling(contracts.ConvertNotebookToSqlRequest.type, params);
	}
	async convertSqlToNotebook(content: string): Promise<contracts.ConvertSqlToNotebookResult | undefined> {
		let params: contracts.ConvertSqlToNotebookParams = { clientUri: content };
		return this.runWithErrorHandling(contracts.ConvertSqlToNotebookRequest.type, params);
	}
}
