/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as path from 'path';
import { pathExists } from 'fs-extra';
import * as loc from '../common/localizedConstants';
import { IBookTocManager } from '../book/bookTocManager';
import { confirmMessageDialog, FileExtension, BookTreeItemType } from '../common/utils';
import { IPrompter } from '../prompts/question';
import CodeAdapter from '../prompts/adapter';
import { BookTreeItem } from '../book/bookTreeItem';
import { TocEntryPathHandler } from '../book/tocEntryPathHandler';

export class AddTocEntryDialog {
	private _dialog: azdata.window.Dialog;
	private readonly _dialogName = 'addNewFileBookTreeViewDialog';
	public view: azdata.ModelView;
	private _formModel: azdata.FormContainer;
	private _fileNameInputBox: azdata.InputBoxComponent;
	private _titleInputBox: azdata.InputBoxComponent;
	private _saveLocationInputBox: azdata.TextComponent;
	private _prompter: IPrompter;

	constructor(private _tocManager: IBookTocManager, private _bookItem: BookTreeItem, private _extension: FileExtension, private _isSection?: boolean) {
		this._prompter = new CodeAdapter();
	}

	public get dialog(): azdata.window.Dialog | undefined {
		return this._dialog;
	}

	public async validatePath(folderPath: string, fileBasename: string): Promise<void> {
		const destinationUri = path.join(folderPath, fileBasename);
		if (await pathExists(destinationUri)) {
			const doOverwrite = await confirmMessageDialog(this._prompter, loc.confirmOverwrite);
			if (!doOverwrite) {
				throw (new Error(loc.msgDuplicateFileName(destinationUri)));
			}
		}
		if (!(await pathExists(folderPath))) {
			throw (new Error(loc.msgSaveFolderError));
		}
	}

	public async createDialog(): Promise<void> {
		const dialogTitle = this._isSection ? loc.newSection : this._extension === FileExtension.Notebook ? loc.newNotebook : loc.newMarkdown;
		this._dialog = azdata.window.createModelViewDialog(dialogTitle, this._dialogName);
		this._dialog.registerContent(async view => {
			this.view = view;
			this._fileNameInputBox = this.view.modelBuilder.inputBox()
				.withProps({
					enabled: true,
					width: '400px'
				}).component();

			this._titleInputBox = this.view.modelBuilder.inputBox()
				.withProps({
					enabled: true,
					width: '400px'
				}).component();

			this._saveLocationInputBox = this.view.modelBuilder.inputBox()
				.withProps({
					value: this._bookItem.contextValue === BookTreeItemType.savedBook ? this._bookItem.rootContentPath : path.dirname(this._bookItem.resourceUri.fsPath),
					enabled: false,
					width: '400px'
				}).component();

			this._formModel = this.view.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							title: loc.title,
							required: true,
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
		this._dialog.registerCloseValidator(async () => await this.createFile(this._fileNameInputBox.value, this._titleInputBox.value));
		azdata.window.openDialog(this._dialog);
	}

	public async createFile(fileName: string, titleName: string): Promise<boolean> {
		try {
			const dirPath = this._bookItem.contextValue === BookTreeItemType.savedBook ? this._bookItem.rootContentPath : path.dirname(this._bookItem.book.contentPath);
			// For sections, we pass the name of the section in the path to create a directory with the same name
			const filePath = this._isSection ? path.posix.join(dirPath, titleName, fileName).concat(this._extension) : path.posix.join(dirPath, fileName).concat(this._extension);
			await this.validatePath(dirPath, fileName.concat(this._extension));
			const pathDetails = new TocEntryPathHandler(filePath, this._bookItem.rootContentPath, titleName);
			await this._tocManager.addNewTocEntry(pathDetails, this._bookItem, this._isSection);
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
