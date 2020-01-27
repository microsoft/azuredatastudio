/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from '../../../../mssql';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';
import * as path from 'path';

/**
 * Manage package dialog model
 */
export class ExternalLanguagesDialogModel {

	constructor(
		private _apiWrapper: ApiWrapper,
		private _languageExtensionService: mssql.ILanguageExtensionService,
		private _root: string) {
	}

	public async load() {
		this.connectionUrl = await this.getCurrentConnectionUrl();
	}

	public async GetLanguageList(): Promise<mssql.ExternalLanguage[]> {
		if (this.connectionUrl) {
			return await this._languageExtensionService.listLanguages(this.connectionUrl);
		}

		return [];
	}

	public connectionUrl: string = '';

	public async deleteLanguage(languageName: string): Promise<void> {
		if (this.connectionUrl) {
			await this._languageExtensionService.deleteLanguage(this.connectionUrl, languageName);
		}
	}

	public async saveLanguage(language: mssql.ExternalLanguage): Promise<void> {
		if (this.connectionUrl) {
			await this._languageExtensionService.updateLanguage(this.connectionUrl, language);
		}
	}


	public async getLocationTitle(): Promise<string> {
		let connection = await this.getCurrentConnection();
		if (connection) {
			return `${connection.serverName} ${connection.databaseName ? connection.databaseName : ''}`;
		}
		return constants.packageManagerNoConnection;
	}

	private async getCurrentConnectionUrl(): Promise<string> {
		let connection = await this.getCurrentConnection();
		if (connection) {
			return await this._apiWrapper.getUriForConnection(connection.connectionId);
		}
		return '';
	}

	public asAbsolutePath(filePath: string): string {
		return path.join(this._root, filePath);
	}

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}
}
