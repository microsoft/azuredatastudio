/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as path from 'path';
import { pathExists } from 'fs-extra';
import * as loc from '../common/localizedConstants';
import { FileExtension, IBookTocManager } from '../book/bookTocManager';
import { confirmMessageDialog } from '../common/utils';
import { IPrompter } from '../prompts/question';
import CodeAdapter from '../prompts/adapter';
import { BookTreeItem, BookTreeItemType } from '../book/bookTreeItem';
import { BookPathHandler } from '../book/bookPathHandler';

export class AddFileDialog {
	private _dialog: azdata.window.Dialog;
	public view: azdata.ModelView;
	private _formModel: azdata.FormContainer;
	private _fileNameInputBox: azdata.InputBoxComponent;
	private _titleInputBox: azdata.InputBoxComponent;
	private _saveLocationInputBox: azdata.InputBoxComponent;
	private _prompter: IPrompter;

	constructor(private _tocManager: IBookTocManager, private _bookItem: BookTreeItem, private _extension: FileExtension) {
		this._prompter = new CodeAdapter();
	}

	public async validatePath(folderPath: string, fileBasename: string): Promise<boolean> {
		const destinationUri = path.join(folderPath, fileBasename);
		if (await pathExists(destinationUri)) {
			const doOverwrite = await confirmMessageDialog(this._prompter, loc.confirmOverwrite);
			if (doOverwrite) {
				return true;
			}
			return false;
		}
		return await pathExists(folderPath);
	}

	public async createDialog(): Promise<void> {
		const dialogTitle = this._extension === FileExtension.Notebook ? loc.newNotebook : loc.newMarkdown;
		this._dialog = azdata.window.createModelViewDialog(dialogTitle);
		this._dialog.registerContent(async view => {
			this.view = view;
			this._fileNameInputBox = this.view.modelBuilder.inputBox()
				.withProperties({
					enabled: true,
					width: '400px'
				}).component();

			this._titleInputBox = this.view.modelBuilder.inputBox()
				.withProperties({
					enabled: true,
					width: '400px'
				}).component();

			this._saveLocationInputBox = this.view.modelBuilder.inputBox()
				.withProperties({
					value: this._bookItem.contextValue === BookTreeItemType.Book ? this._bookItem.rootContentPath : path.dirname(this._bookItem.resourceUri.fsPath),
					enabled: false,
					width: '400px'
				}).component();

			this._formModel = this.view.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							title: loc.title,
							required: false,
							component: this._titleInputBox
						},
						{
							component: this._fileNameInputBox,
							title: loc.fileName,
							required: true
						},
						{
							component: this._saveLocationInputBox,
							title: loc.saveLocation,
							required: false
						}
					],
					title: ''
				}]).component();
			await this.view.initializeModel(this._formModel);
		});
		this._dialog.okButton.label = loc.add;
		this._dialog.registerCloseValidator(async () => await this.createFile());
		azdata.window.openDialog(this._dialog);
	}

	private async createFile(): Promise<boolean> {
		try {
			const dirPath = this._bookItem.contextValue === BookTreeItemType.Book ? this._bookItem.rootContentPath : path.dirname(this._bookItem.resourceUri.fsPath);
			const filePath = path.join(dirPath, this._fileNameInputBox.value).concat(this._extension);
			const isValid = await this.validatePath(dirPath, this._fileNameInputBox.value.concat(this._extension));
			if (!isValid) {
				throw (new Error(loc.msgSaveFolderError));
			}
			const pathDetails = new BookPathHandler(filePath, this._bookItem.rootContentPath, this._titleInputBox.value);
			await this._tocManager.addNewFile(pathDetails, this._bookItem);
			return true;
		} catch (error) {
			this._dialog.message = {
				text: error.message,
				level: azdata.window.MessageLevel.Error
			};
			return false;
		}
	}
}
