/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as path from 'path';
import { pathExists } from 'fs-extra';
import * as loc from '../common/localizedConstants';
import { IconPathHelper } from '../common/iconHelper';
import { FileExtension, IBookTocManager } from '../book/bookTocManager';
import { confirmMessageDialog, getDropdownValue, selectFolder } from '../common/utils';
import { IPrompter } from '../prompts/question';
import CodeAdapter from '../prompts/adapter';
import { BookModel } from '../book/bookModel';
import { BookTreeItemType } from '../book/bookTreeItem';
import { BookPathHandler } from '../book/bookPathHandler';

export class AddFileDialog {
	private _dialog: azdata.window.Dialog;
	public view: azdata.ModelView;
	private _formModel: azdata.FormContainer;
	private _fileNameInputBox: azdata.InputBoxComponent;
	private _booksDropdown: azdata.DropDownComponent;
	private _fileExtensionDropdown: azdata.DropDownComponent;
	private _saveLocationInputBox: azdata.InputBoxComponent;
	private _prompter: IPrompter;
	private _bookNames: string[];

	constructor(private _tocManager: IBookTocManager, private _books: BookModel[]) {
		this._prompter = new CodeAdapter();
		this._bookNames = this._books.map(b => b.bookItems[0].title);
		this._bookNames.unshift('-');
	}

	protected createHorizontalContainer(view: azdata.ModelView, items: azdata.Component[]): azdata.FlexContainer {
		return view.modelBuilder.flexContainer().withItems(items, { CSSStyles: { 'margin-right': '5px', 'margin-bottom': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
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
		this._dialog = azdata.window.createModelViewDialog(loc.newFile);
		this._dialog.registerContent(async view => {
			this.view = view;
			this._fileNameInputBox = this.view.modelBuilder.inputBox()
				.withProperties({
					enabled: true
				}).component();

			this._saveLocationInputBox = this.view.modelBuilder.inputBox().withProperties({
				placeHolder: loc.locationBrowser,
				width: '400px'
			}).component();

			this._booksDropdown = this.view.modelBuilder.dropDown().withProperties({
				values: this._bookNames,
				width: '400px'
			}).component();

			this._fileExtensionDropdown = this.view.modelBuilder.dropDown().withProperties({
				values: ['-', BookTreeItemType.Notebook, BookTreeItemType.Markdown],
				width: '400px'
			}).component();

			const browseFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				ariaLabel: loc.browse,
				iconPath: IconPathHelper.folder,
				width: '18px',
				height: '20px',
			}).component();

			browseFolderButton.onDidClick(async () => {
				this._saveLocationInputBox.value = await selectFolder();
			});

			this._booksDropdown.onValueChanged(async () => {
				const book = this._books.find(b => b.bookItems[0].title === getDropdownValue(this._booksDropdown));
				this._saveLocationInputBox.value = book?.contentFolderPath;
			});

			this._formModel = this.view.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: this._fileNameInputBox,
							title: loc.name,
							required: true
						},
						{
							title: loc.fileExtension,
							required: true,
							component: this._fileExtensionDropdown
						},
						{
							title: loc.book,
							required: false,
							component: this._booksDropdown
						},
						{
							title: loc.saveLocation,
							required: true,
							component: this.createHorizontalContainer(view, [this._saveLocationInputBox, browseFolderButton])
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
			const extension = getDropdownValue(this._fileExtensionDropdown) === BookTreeItemType.Notebook ? FileExtension.Notebook : FileExtension.Markdown;
			const isValid = await this.validatePath(this._saveLocationInputBox.value, path.basename(this._fileNameInputBox.value).concat(extension));
			if (!isValid) {
				throw (new Error(loc.msgSaveFolderError));
			}
			const filePath = path.join(this._saveLocationInputBox.value, this._fileNameInputBox.value).concat(extension);
			const book = this._books.find(b => b.bookItems[0].title === getDropdownValue(this._booksDropdown));
			const pathDetails = new BookPathHandler(filePath, book?.bookPath);
			await this._tocManager.addNewFile(pathDetails, book);
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
