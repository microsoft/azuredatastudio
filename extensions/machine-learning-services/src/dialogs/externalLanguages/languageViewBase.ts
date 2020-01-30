/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LanguagesDialogModel, LanguageUpdateModel, FileBrowseEventArgs } from './languagesDialogModel';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../common/constants';

export abstract class LanguageViewBase {
	protected _dialog: azdata.window.Dialog | undefined;
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

	protected _onUpdatedFailed: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	public readonly onUpdatedFailed: vscode.Event<any> = this._onUpdatedFailed.event;

	public componentMaxLength = 350;
	public browseButtonMaxLength = 20;
	public spaceBetweenComponentsLength = 10;

	constructor(protected _model: LanguagesDialogModel, protected _parent?: LanguageViewBase, ) {
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
			this._parent.filePathSelected(x => {
				this.onFilePathSelected(x);
			});
			this._parent.onUpdated(x => {
				this.onUpdatedLanguage(x);
			});
			this._parent.onUpdatedFailed(x => {
				this.onUpdatedLanguageFailed(x);
			});
		}
	}
	/**
	 * Dialog model instance
	 */
	public get model(): LanguagesDialogModel {
		return this._model;
	}

	public updateLanguage(updateModel: LanguageUpdateModel): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.onUpdateLanguage(updateModel);
			this.onUpdated(() => {
				resolve();
			});
			this.onUpdatedFailed(err => {
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

	public onUpdatedLanguageFailed(error: any): void {
		this._onUpdatedFailed.fire(error);
	}

	public onEditLanguage(model: LanguageUpdateModel): void {
		this._onEdit.fire(model);
	}

	public onDeleteLanguage(model: LanguageUpdateModel): void {
		this._onDelete.fire(model);
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

	public abstract reset(): Promise<void>;
}
