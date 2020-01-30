/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from '../../../../mssql/src/mssql';
import { ApiWrapper } from '../../common/apiWrapper';
import { LanguagesDialogModel, LanguageUpdateModel } from './languagesDialogModel';
import { LanguagesDialog } from './languagesDialog';
import { LanguageEditDialog } from './languageEditDialog';
import { FileBrowserDialog } from './fileBrowserDialog';
import { LanguageDialogBase } from './languageDialogBase';
import * as constants from '../../common/constants';

export class LanguageController {

	private _model: LanguagesDialogModel;
	/**
	 *
	 */
	constructor(
		private _apiWrapper: ApiWrapper,
		private _languageExtensionService: mssql.ILanguageExtensionService,
		private _root: string) {
		this._model = new LanguagesDialogModel(this._apiWrapper, this._languageExtensionService, this._root);
	}

	public async manageLanguages(): Promise<void> {

		await this._model.load();
		let dialog = new LanguagesDialog(this._model);
		dialog.onEdit(model => {
			this.editLanguage(dialog, model);
		});
		dialog.onDelete(async deleteModel => {
			await this.executeAction(dialog, this.deleteLanguage, this._model, deleteModel);
		});

		dialog.onUpdate(async updateModel => {
			try {
				await this.executeAction(dialog, this.updateLanguage, this._model, updateModel);
				dialog.onUpdatedLanguage(updateModel);
			} catch (err) {
				dialog.onUpdatedLanguageFailed(err);
			}
		});
		this.selectFile(dialog);
		dialog.showDialog();
	}

	public async executeAction(dialog: LanguageDialogBase, func: (...args: any[]) => Promise<void>, ...args: any[]): Promise<void> {
		try {
			await func(...args);
			await dialog.reset();
		} catch (error) {
			//dialog.showErrorMessage(error?.message);
			throw error;
		}
	}

	public editLanguage(parent: LanguageDialogBase, languageUpdateModel: LanguageUpdateModel): void {
		let editDialog = new LanguageEditDialog(parent, this._model, languageUpdateModel);
		editDialog.showDialog();
	}

	private selectFile(dialog: LanguageDialogBase): void {
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
			let dialog = new FileBrowserDialog(connectionUrl);
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

	public async deleteLanguage(model: LanguagesDialogModel, deleteModel: LanguageUpdateModel): Promise<void> {
		await model.deleteLanguage(deleteModel.language.name);
	}

	public async updateLanguage(model: LanguagesDialogModel, updateModel: LanguageUpdateModel): Promise<void> {
		if (!updateModel.language) {
			return;
		}
		let contents: mssql.ExternalLanguageContent[] = [];
		if (!updateModel.language.contents || updateModel.language.contents.length === 0) {
			contents = [];
		} else {
			contents = updateModel.language.contents.filter(x => x.platform !== updateModel.content.platform);
		}
		contents.push(updateModel.content);

		updateModel.language.contents = contents;
		await model.updateLanguage(updateModel.language);
	}
}
