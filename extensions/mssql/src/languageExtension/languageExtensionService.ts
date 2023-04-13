/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature } from 'dataprotocol-client';
import * as constants from '../constants';
import * as mssql from 'mssql';
import * as Utils from '../utils';
import { ClientCapabilities } from 'vscode-languageclient';
import * as contracts from '../contracts';
import { BaseService } from '../baseService';

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

	public listLanguages(ownerUri: string): Promise<mssql.ExternalLanguage[]> {
		const params: contracts.LanguageExtensionRequestParam = { ownerUri: ownerUri };
		return this.runWithErrorHandling(contracts.LanguageExtensibilityListRequest.type, params).then((r) => r.languages);
	}

	public updateLanguage(ownerUri: string, language: mssql.ExternalLanguage): Promise<void> {
		const params: contracts.ExternalLanguageUpdateRequestParam = { ownerUri: ownerUri, language: language };
		return this.runWithErrorHandling(contracts.LanguageExtensibilityUpdateRequest.type, params).then();
	}

	public deleteLanguage(ownerUri: string, languageName: string): Promise<void> {
		const params: contracts.ExternalLanguageRequestParam = { ownerUri: ownerUri, languageName: languageName };
		return this.runWithErrorHandling(contracts.LanguageExtensibilityDeleteRequest.type, params).then();
	}
}
