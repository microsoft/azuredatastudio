/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature } from 'dataprotocol-client';
import * as constants from '../constants';
import * as mssql from '../mssql';
import * as Utils from '../utils';
import { ClientCapabilities } from 'vscode-languageclient';
import * as contracts from '../contracts';

export class LanguageExtensionService implements mssql.ILanguageExtensionService {

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

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		context.registerService(constants.LanguageExtensionService, this);
	}

	public listLanguages(ownerUri: string): Thenable<mssql.ExternalLanguage[]> {
		const params: contracts.LanguageExtensionRequestParam = { ownerUri: ownerUri };
		return this.client.sendRequest(contracts.LanguageExtensibilityListRequest.type, params).then(
			r => {
				return r.languages;
			},
			e => {
				this.client.logFailedRequest(contracts.LanguageExtensibilityListRequest.type, e);
				return Promise.reject(e);
			}
		);
	}

	public updateLanguage(ownerUri: string, language: mssql.ExternalLanguage): Thenable<void> {
		const params: contracts.ExternalLanguageUpdateRequestParam = { ownerUri: ownerUri, language: language };
		return this.client.sendRequest(contracts.LanguageExtensibilityUpdateRequest.type, params).then(
			() => {
			},
			e => {
				this.client.logFailedRequest(contracts.LanguageExtensibilityUpdateRequest.type, e);
				return Promise.reject(e);
			}
		);
	}

	public deleteLanguage(ownerUri: string, languageName: string): Thenable<void> {
		const params: contracts.ExternalLanguageRequestParam = { ownerUri: ownerUri, languageName: languageName };
		return this.client.sendRequest(contracts.LanguageExtensibilityDeleteRequest.type, params).then(
			() => {
			},
			e => {
				this.client.logFailedRequest(contracts.LanguageExtensibilityDeleteRequest.type, e);
				return Promise.reject(e);
			}
		);
	}
}
