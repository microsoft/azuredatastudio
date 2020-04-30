/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from '../../../../mssql';
import { ApiWrapper } from '../../common/apiWrapper';
import { LanguageService } from '../../externalLanguage/languageService';
import { LanguagesDialog } from './languagesDialog';
import { LanguageEditDialog } from './languageEditDialog';
import { FileBrowserDialog } from './fileBrowserDialog';
import { LanguageViewBase, LanguageUpdateModel } from './languageViewBase';
import * as constants from '../../common/constants';

export class LanguageController {

	/**
	 *
	 */
	constructor(
		private _apiWrapper: ApiWrapper,
		private _root: string,
		private _service: LanguageService) {
	}

	/**
	 * Opens the manage language dialog and connects events to the model
	 */
	public async manageLanguages(): Promise<LanguagesDialog> {

		let dialog = new LanguagesDialog(this._apiWrapper, this._root);

		// Load current connection
		//
		await this._service.load();
		dialog.connection = this._service.connection;
		dialog.connectionUrl = this._service.connectionUrl;

		// Handle dialog events and connect to model
		//
		dialog.onEdit(model => {
			this.editLanguage(dialog, model);
		});
		dialog.onDelete(async deleteModel => {
			try {
				await this.executeAction(dialog, this.deleteLanguage, this._service, deleteModel);
				dialog.onUpdatedLanguage(deleteModel);
			} catch (err) {
				dialog.onActionFailed(err);
			}
		});

		dialog.onUpdate(async updateModel => {
			try {
				await this.executeAction(dialog, this.updateLanguage, this._service, updateModel);
				dialog.onUpdatedLanguage(updateModel);
			} catch (err) {
				dialog.onActionFailed(err);
			}
		});

		dialog.onList(async () => {
			try {
				let result = await this.listLanguages(this._service);
				dialog.onListLanguageLoaded(result);
			} catch (err) {
				dialog.onActionFailed(err);
			}
		});
		this.onSelectFile(dialog);

		// Open dialog
		//
		dialog.showDialog();
		return dialog;
	}

	public async executeAction<T>(dialog: LanguageViewBase, func: (...args: any[]) => Promise<T>, ...args: any[]): Promise<T> {
		let result = await func(...args);
		await dialog.reset();
		return result;
	}

	public editLanguage(parent: LanguageViewBase, languageUpdateModel: LanguageUpdateModel): void {
		let editDialog = new LanguageEditDialog(this._apiWrapper, parent, languageUpdateModel);
		editDialog.showDialog();
	}

	private onSelectFile(dialog: LanguageViewBase): void {
		dialog.fileBrowser(async (args) => {
			let filePath = '';
			if (args.target === constants.localhost) {
				filePath = await this.getLocalFilePath();

			} else {
				filePath = await this.getServerFilePath(args.target);
			}
			dialog.onFilePathSelected({ filePath: filePath, target: args.target });
		});
	}

	public getServerFilePath(connectionUrl: string): Promise<string> {
		return new Promise<string>((resolve) => {
			let dialog = new FileBrowserDialog(this._apiWrapper, connectionUrl);
			dialog.onPathSelected((selectedPath) => {
				resolve(selectedPath);
			});

			dialog.showDialog();
		});
	}

	public async getLocalFilePath(): Promise<string> {
		let result = await this._apiWrapper.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false
		});
		return result && result.length > 0 ? result[0].fsPath : '';
	}

	public async deleteLanguage(model: LanguageService, deleteModel: LanguageUpdateModel): Promise<void> {
		await model.deleteLanguage(deleteModel.language.name);
	}

	public async listLanguages(model: LanguageService): Promise<mssql.ExternalLanguage[]> {
		return await model.getLanguageList();
	}

	public async updateLanguage(model: LanguageService, updateModel: LanguageUpdateModel): Promise<void> {
		if (!updateModel.language) {
			return;
		}
		let contents: mssql.ExternalLanguageContent[] = [];
		if (updateModel.language.contents && updateModel.language.contents.length >= 0) {
			contents = updateModel.language.contents.filter(x => x.platform !== updateModel.content.platform);
		}
		contents.push(updateModel.content);

		updateModel.language.contents = contents;
		await model.updateLanguage(updateModel.language);
	}
}
