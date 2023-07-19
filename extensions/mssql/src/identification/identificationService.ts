/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from '../constants';
import * as mssql from 'mssql';
import * as vscode from 'vscode';
import * as contracts from '../contracts';

import { AppContext } from '../appContext';
import { ClientCapabilities } from 'vscode-languageclient';
import { SqlOpsDataClient, ISqlOpsFeature, BaseService } from 'dataprotocol-client';

export class IdentificationService extends BaseService implements mssql.IIdentificationService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends IdentificationService {
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
		context.registerService(constants.IdentificationService, this);
	}

	async identify(documentUri: string, vscodePosition: vscode.Position, word: string): Promise<string> {
		const position : contracts.Position = {line: vscodePosition.line + 1, character: vscodePosition.character};
		const identificationParams: contracts.IdentificationParams = { documentUri: documentUri, position: position, word: word};

		return this.runWithErrorHandling(contracts.IdentificationRequest.type, identificationParams);
	}

}
