/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../common/constants';
import { ApiWrapper } from '../../common/apiWrapper';
import * as mssql from '../../../../mssql';
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

export abstract class LanguageViewBase {
	protected _dialog: azdata.window.Dialog | undefined;
	public connection: azdata.connection.ConnectionProfile | undefined;
	public connectionUrl: string = '';

	// Events
	//
	protected _onEdit: vscode.EventEmitter<LanguageUpdateModel> = new vscode.EventEmitter<LanguageUpdateModel>();
	public readonly onEdit: vscode.Event<LanguageUpdateModel> = this._onEdit.event;

	protected _onUpdate: vscode.EventEmitter<LanguageUpdateModel> = new vscode.EventEmitter<LanguageUpdateModel>();
	public readonly onUpdate: vscode.Event<LanguageUpdateModel> = this._onUpdate.event;

	protected _onDelete: vscode.EventEmitter<LanguageUpdateModel> = new vscode.EventEmitter<LanguageUpdateModel>();
	public readonly onDelete: vscode.Event<LanguageUpdateModel> = this._onDelete.event;

	protected _fileBrowser: vscode.EventEmitter<FileBrowseEventArgs> = new vscode.EventEmitter<FileBrowseEventArgs>();
	public readonly fileBrowser: vscode.Event<FileBrowseEventArgs> = this._fileBrowser.event;

	protected _filePathSelected: vscode.EventEmitter<FileBrowseEventArgs> = new vscode.EventEmitter<FileBrowseEventArgs>();
	public readonly filePathSelected: vscode.Event<FileBrowseEventArgs> = this._filePathSelected.event;

	protected _onUpdated: vscode.EventEmitter<LanguageUpdateModel> = new vscode.EventEmitter<LanguageUpdateModel>();
	public readonly onUpdated: vscode.Event<LanguageUpdateModel> = this._onUpdated.event;

	protected _onList: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onList: vscode.Event<void> = this._onList.event;

	protected _onListLoaded: vscode.EventEmitter<mssql.ExternalLanguage[]> = new vscode.EventEmitter<mssql.ExternalLanguage[]>();
	public readonly onListLoaded: vscode.Event<mssql.ExternalLanguage[]> = this._onListLoaded.event;

	protected _onFailed: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	public readonly onFailed: vscode.Event<any> = this._onFailed.event;

	public componentMaxLength = 350;
	public browseButtonMaxLength = 20;
	public spaceBetweenComponentsLength = 10;

	constructor(protected _apiWrapper: ApiWrapper, protected _root?: string, protected _parent?: LanguageViewBase,) {
		if (this._parent) {
			if (!this._root) {
				this._root = this._parent.root;
			}
			this.connection = this._parent.connection;
			this.connectionUrl = this._parent.connectionUrl;
		}
		this.registerEvents();
	}

	private registerEvents() {
		if (this._parent) {
			this._dialog = this._parent.dialog;
			this.fileBrowser(url => {
				this._parent?.onOpenFileBrowser(url);
			});
			this.onUpdate(model => {
				this._parent?.onUpdateLanguage(model);
			});
			this.onEdit(model => {
				this._parent?.onEditLanguage(model);
			});
			this.onDelete(model => {
				this._parent?.onDeleteLanguage(model);
			});
			this.onList(() => {
				this._parent?.onListLanguages();
			});
			this._parent.filePathSelected(x => {
				this.onFilePathSelected(x);
			});
			this._parent.onUpdated(x => {
				this.onUpdatedLanguage(x);
			});
			this._parent.onFailed(x => {
				this.onActionFailed(x);
			});
			this._parent.onListLoaded(x => {
				this.onListLanguageLoaded(x);
			});
		}
	}
	public async getLocationTitle(): Promise<string> {
		let connection = await this.getCurrentConnection();
		if (connection) {
			return `${connection.serverName} ${connection.databaseName ? connection.databaseName : constants.extLangLocal}`;
		}
		return constants.noConnectionError;
	}

	public getServerTitle(): string {
		if (this.connection) {
			return this.connection.serverName;
		}
		return constants.noConnectionError;
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

	public async loadConnection(): Promise<void> {
		this.connection = await this.getCurrentConnection();
		this.connectionUrl = await this.getCurrentConnectionUrl();
	}

	public updateLanguage(updateModel: LanguageUpdateModel): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.onUpdateLanguage(updateModel);
			this.onUpdated(() => {
				resolve();
			});
			this.onFailed(err => {
				reject(err);
			});
		});
	}

	public deleteLanguage(model: LanguageUpdateModel): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.onDeleteLanguage(model);
			this.onUpdated(() => {
				resolve();
			});
			this.onFailed(err => {
				reject(err);
			});
		});
	}

	public listLanguages(): Promise<mssql.ExternalLanguage[]> {
		return new Promise<mssql.ExternalLanguage[]>((resolve, reject) => {
			this.onListLanguages();
			this.onListLoaded(list => {
				resolve(list);
			});
			this.onFailed(err => {
				reject(err);
			});
		});
	}

	/**
	 * Dialog model instance
	 */
	public get dialog(): azdata.window.Dialog | undefined {
		return this._dialog;
	}

	public set dialog(value: azdata.window.Dialog | undefined) {
		this._dialog = value;
	}

	public showInfoMessage(message: string): void {
		this.showMessage(message, azdata.window.MessageLevel.Information);
	}

	public showErrorMessage(message: string, error?: any): void {
		this.showMessage(`${message} ${constants.getErrorMessage(error)}`, azdata.window.MessageLevel.Error);
	}

	public onUpdateLanguage(model: LanguageUpdateModel): void {
		this._onUpdate.fire(model);
	}

	public onUpdatedLanguage(model: LanguageUpdateModel): void {
		this._onUpdated.fire(model);
	}

	public onActionFailed(error: any): void {
		this._onFailed.fire(error);
	}

	public onListLanguageLoaded(list: mssql.ExternalLanguage[]): void {
		this._onListLoaded.fire(list);
	}

	public onEditLanguage(model: LanguageUpdateModel): void {
		this._onEdit.fire(model);
	}

	public onDeleteLanguage(model: LanguageUpdateModel): void {
		this._onDelete.fire(model);
	}

	public onListLanguages(): void {
		this._onList.fire();
	}

	public onOpenFileBrowser(fileBrowseArgs: FileBrowseEventArgs): void {
		this._fileBrowser.fire(fileBrowseArgs);
	}

	public onFilePathSelected(fileBrowseArgs: FileBrowseEventArgs): void {
		this._filePathSelected.fire(fileBrowseArgs);
	}

	private showMessage(message: string, level: azdata.window.MessageLevel): void {
		if (this._dialog) {
			this._dialog.message = {
				text: message,
				level: level
			};
		}
	}

	public get root(): string {
		return this._root || '';
	}

	public asAbsolutePath(filePath: string): string {
		return path.join(this._root || '', filePath);
	}

	public abstract reset(): Promise<void>;

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
}
