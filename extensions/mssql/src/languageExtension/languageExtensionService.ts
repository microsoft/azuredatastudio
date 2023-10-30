/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from '../constants';
import * as mssql from 'mssql';
import * as Utils from '../utils';
import * as contracts from '../contracts';

import { AppContext } from '../appContext';
import { ClientCapabilities } from 'vscode-languageclient';
import { SqlOpsDataClient, ISqlOpsFeature, BaseService } from 'dataprotocol-client';

export class LanguageExtensionService extends BaseService implements mssql.ILanguageExtensionService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends LanguageExtensionService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(capabilities: ClientCapabilities): void {
				Utils.ensure(capabilities, 'languageExtension')!.languageExtension = true;
			}

			initialize(): void {
			}
		};
	}

	private constructor(context: AppContext, client: SqlOpsDataClient) {
		super(client);
		context.registerService(constants.LanguageExtensionService, this);
	}

	public async listLanguages(ownerUri: string): Promise<mssql.ExternalLanguage[]> {
		const params: contracts.LanguageExtensionRequestParam = { ownerUri: ownerUri };
		return this.runWithErrorHandling(contracts.LanguageExtensibilityListRequest.type, params).then((r) => r.languages);
	}

	public async updateLanguage(ownerUri: string, language: mssql.ExternalLanguage): Promise<void> {
		const params: contracts.ExternalLanguageUpdateRequestParam = { ownerUri: ownerUri, language: language };
		return this.runWithErrorHandling(contracts.LanguageExtensibilityUpdateRequest.type, params).then();
	}

	public async deleteLanguage(ownerUri: string, languageName: string): Promise<void> {
		const params: contracts.ExternalLanguageRequestParam = { ownerUri: ownerUri, languageName: languageName };
		return this.runWithErrorHandling(contracts.LanguageExtensibilityDeleteRequest.type, params).then();
	}
}
