/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from '../../../mssql';
import { ApiWrapper } from '../common/apiWrapper';

/**
 * Manage package dialog model
 */
export class LanguageService {

	public connection: azdata.connection.ConnectionProfile | undefined;
	public connectionUrl: string = '';

	constructor(
		private _apiWrapper: ApiWrapper,
		private _languageExtensionService: mssql.ILanguageExtensionService) {
	}

	public async load() {
		this.connection = await this.getCurrentConnection();
		this.connectionUrl = await this.getCurrentConnectionUrl();
	}

	public async getLanguageList(): Promise<mssql.ExternalLanguage[]> {
		if (this.connectionUrl) {
			return await this._languageExtensionService.listLanguages(this.connectionUrl);
		}

		return [];
	}

	public async deleteLanguage(languageName: string): Promise<void> {
		if (this.connectionUrl) {
			await this._languageExtensionService.deleteLanguage(this.connectionUrl, languageName);
		}
	}

	public async updateLanguage(language: mssql.ExternalLanguage): Promise<void> {
		if (this.connectionUrl) {
			await this._languageExtensionService.updateLanguage(this.connectionUrl, language);
		}
	}

	private async getCurrentConnectionUrl(): Promise<string> {
		let connection = await this.getCurrentConnection();
		if (connection) {
			return await this._apiWrapper.getUriForConnection(connection.connectionId);
		}
		return '';
	}

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}
}
