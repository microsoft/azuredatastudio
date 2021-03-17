/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';
import { pathExists, remove } from 'fs-extra';
import * as loc from '../common/localizedConstants';
import { IconPathHelper } from '../common/iconHelper';
import { FileType, IBookTocManager } from '../book/bookTocManager';
import { confirmReplace } from '../common/utils';
import { IPrompter } from '../prompts/question';
import CodeAdapter from '../prompts/adapter';
import { BookModel } from '../book/bookModel';

export class AddNotebookDialog {

	private dialog: azdata.window.Dialog;
	public view: azdata.ModelView;
	private formModel: azdata.FormContainer;
	private notebookNameInputBox: azdata.InputBoxComponent;
	private booksDropdown: azdata.DropDownComponent;
	private saveLocationInputBox: azdata.InputBoxComponent;
	private prompter: IPrompter;
	private bookNames: string[] = [];

	constructor(private tocManager: IBookTocManager, private books: BookModel[]) {
		this.prompter = new CodeAdapter();
		this.bookNames = this.books.map(b => b.bookItems[0].title);
		this.bookNames.unshift('-');
	}

	protected createHorizontalContainer(view: azdata.ModelView, items: azdata.Component[]): azdata.FlexContainer {
		return view.modelBuilder.flexContainer().withItems(items, { CSSStyles: { 'margin-right': '5px', 'margin-bottom': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
	}

	public async selectFolder(): Promise<string | undefined> {
		const allFilesFilter = loc.allFiles;
		let filter: any = {};
		filter[allFilesFilter] = '*';
		let uris = await vscode.window.showOpenDialog({
			filters: filter,
			canSelectFiles: false,
			canSelectMany: false,
			canSelectFolders: true,
			openLabel: loc.labelSelectFolder
		});
		if (uris && uris.length > 0) {
			return uris[0].fsPath;
		}
		return undefined;
	}

	public async validatePath(folderPath: string): Promise<boolean> {
		const destinationUri = path.join(folderPath, path.basename(this.notebookNameInputBox.value));
		if (await pathExists(destinationUri)) {
			const doReplace = await confirmReplace(this.prompter);
			if (doReplace) {
				//remove folder if exists
				await remove(destinationUri);
				return true;
			}
			return false;
		}
		return await pathExists(folderPath);
	}

	public async createDialog(): Promise<void> {
		this.dialog = azdata.window.createModelViewDialog('New Notebook');
		this.dialog.registerContent(async view => {
			this.view = view;

			const notebookLabel = this.view.modelBuilder.text()
				.withProperties({
					value: 'Notebooks are documents that contain code, descriptions and visualizations.',
					CSSStyles: { 'margin-bottom': '0px', 'margin-top': '0px', 'font-size': 'small' }
				}).component();

			this.notebookNameInputBox = this.view.modelBuilder.inputBox()
				.withProperties({
					values: [],
					value: '',
					enabled: true
				}).component();

			this.saveLocationInputBox = this.view.modelBuilder.inputBox().withProperties({
				values: [],
				value: '',
				placeHolder: loc.locationBrowser,
				width: '400px'
			}).component();

			this.booksDropdown = this.view.modelBuilder.dropDown().withProperties({
				values: this.bookNames,
				value: '',
				width: '400px'
			}).component();

			const browseFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				ariaLabel: loc.browse,
				iconPath: IconPathHelper.folder,
				width: '18px',
				height: '20px',
			}).component();

			browseFolderButton.onDidClick(async () => {
				this.saveLocationInputBox.value = await this.selectFolder();
			});

			this.booksDropdown.onValueChanged(async () => {
				const book = this.books.find(b => b.bookItems[0].title === this.booksDropdown.value.toString());
				this.saveLocationInputBox.value = book?.contentFolderPath;
			});

			this.formModel = this.view.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: notebookLabel,
							required: false
						},
						{
							component: this.notebookNameInputBox,
							title: loc.name,
							required: true
						},
						{
							title: loc.saveLocation,
							required: true,
							component: this.createHorizontalContainer(view, [this.saveLocationInputBox, browseFolderButton])
						},
						{
							title: 'Book',
							required: false,
							component: this.booksDropdown
						},
					],
					title: ''
				}]).component();
			await this.view.initializeModel(this.formModel);
		});
		this.dialog.okButton.label = loc.create;
		this.dialog.registerCloseValidator(async () => await this.create());
		azdata.window.openDialog(this.dialog);
	}

	private async create(): Promise<boolean> {
		try {
			const isValid = await this.validatePath(this.saveLocationInputBox.value);
			if (!isValid) {
				throw (new Error(loc.msgSaveFolderError));
			}
			const notebookPath = path.join(this.saveLocationInputBox.value, this.notebookNameInputBox.value);
			const book = this.books.find(b => b.bookItems[0].title === this.booksDropdown.value.toString());
			await this.tocManager.addNewNotebook(this.notebookNameInputBox.value, notebookPath, FileType.Notebook, book);
			return true;
		} catch (error) {
			this.dialog.message = {
				text: error.message,
				level: azdata.window.MessageLevel.Error
			};
			return false;
		}
	}
}
