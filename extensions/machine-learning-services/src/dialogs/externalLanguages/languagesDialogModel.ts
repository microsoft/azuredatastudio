/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from '../../../../mssql/src/mssql';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';
import * as path from 'path';


export interface LanguageUpdateModel {
	language: mssql.ExternalLanguage,
	content: mssql.ExternalLanguageContent,
	newLang: boolean
}

export interface FileBrowseEventArgs {
	filePath: string,
	target: string
}
/**
 * Manage package dialog model
 */
export class LanguagesDialogModel {

	private _onMessage: vscode.EventEmitter<azdata.window.DialogMessage> = new vscode.EventEmitter<azdata.window.DialogMessage>();
	public readonly onMessage: vscode.Event<azdata.window.DialogMessage> = this._onMessage.event;

	constructor(
		private _apiWrapper: ApiWrapper,
		private _languageExtensionService: mssql.ILanguageExtensionService,
		private _root: string) {
	}

	public async load() {
		this.connection = await this.getCurrentConnection();
		this.connectionUrl = await this.getCurrentConnectionUrl();
	}

	public async GetLanguageList(): Promise<mssql.ExternalLanguage[]> {
		if (this.connectionUrl) {
			return await this._languageExtensionService.listLanguages(this.connectionUrl);
		}

		return [];
	}

	public connection: azdata.connection.ConnectionProfile | undefined;
	public connectionUrl: string = '';

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


	public async getLocationTitle(): Promise<string> {
		let connection = await this.getCurrentConnection();
		if (connection) {
			return `${connection.serverName} ${connection.databaseName ? connection.databaseName : constants.extLangLocal}`;
		}
		return constants.packageManagerNoConnection;
	}

	public getServerTitle(): string {
		if (this.connection) {
			return this.connection.serverName;
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

	public createNewContent(): mssql.ExternalLanguageContent {
		return {
			extensionFileName: '',
			isLocalFile: true,
			pathToExtension: '',
		};
	}

	public createNewLanguage(): mssql.ExternalLanguage {
		return {
			name: '',
			contents: []
		};
	}

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}
}
