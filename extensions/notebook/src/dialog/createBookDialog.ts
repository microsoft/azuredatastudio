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
import { IBookTocManager } from '../book/bookTocManager';
import { confirmMessageDialog } from '../common/utils';
import { IPrompter } from '../prompts/question';
import CodeAdapter from '../prompts/adapter';

export class CreateBookDialog {

	private dialog: azdata.window.Dialog;
	public view: azdata.ModelView;
	private formModel: azdata.FormContainer;
	private bookNameInputBox: azdata.InputBoxComponent;
	private saveLocationInputBox: azdata.InputBoxComponent;
	private contentFolderInputBox: azdata.InputBoxComponent;
	private prompter: IPrompter;

	constructor(private tocManager: IBookTocManager) {
		this.prompter = new CodeAdapter();
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
		const destinationUri = path.join(folderPath, path.basename(this.bookNameInputBox.value));
		if (await pathExists(destinationUri)) {
			const doReplace = await confirmMessageDialog(this.prompter, loc.confirmReplace);
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
		this.dialog = azdata.window.createModelViewDialog(loc.newBook);
		this.dialog.registerContent(async view => {
			this.view = view;

			const jupyterBookDocumentation = this.view.modelBuilder.hyperlink()
				.withProps({
					label: loc.learnMore,
					url: 'https://jupyterbook.org/intro.html',
					CSSStyles: { 'margin-bottom': '0px', 'margin-top': '0px', 'font-size': 'small' }
				}).component();

			const bookLabel = this.view.modelBuilder.text()
				.withProps({
					value: loc.bookDescription,
					CSSStyles: { 'margin-bottom': '0px', 'margin-top': '0px', 'font-size': 'small' }
				}).component();

			this.bookNameInputBox = this.view.modelBuilder.inputBox()
				.withProps({
					value: '',
					enabled: true
				}).component();

			this.saveLocationInputBox = this.view.modelBuilder.inputBox().withProps({
				value: '',
				ariaLabel: loc.saveLocation,
				width: '400px'
			}).component();

			this.contentFolderInputBox = this.view.modelBuilder.inputBox().withProps({
				value: '',
				ariaLabel: loc.contentFolder,
				width: '400px'
			}).component();

			const browseFolderButton = view.modelBuilder.button().withProps({
				ariaLabel: loc.browse,
				iconPath: IconPathHelper.folder,
				width: '18px',
				height: '20px',
			}).component();

			const browseContentFolderButton = view.modelBuilder.button().withProps({
				ariaLabel: loc.browse,
				iconPath: IconPathHelper.folder,
				width: '18px',
				height: '20px',
			}).component();

			browseFolderButton.onDidClick(async () => {
				const selectedFolder = await this.selectFolder();
				if (selectedFolder) {
					this.saveLocationInputBox.value = selectedFolder;
				}
			});

			browseContentFolderButton.onDidClick(async () => {
				const selectedFolder = await this.selectFolder();
				if (selectedFolder) {
					this.contentFolderInputBox.value = selectedFolder;
				}
			});

			this.formModel = this.view.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							required: false,
							component: this.createHorizontalContainer(view, [bookLabel, jupyterBookDocumentation])
						},
						{
							component: this.bookNameInputBox,
							title: loc.name,
							required: true
						},
						{
							title: loc.saveLocation,
							required: true,
							component: this.createHorizontalContainer(view, [this.saveLocationInputBox, browseFolderButton])
						},
						{
							title: loc.contentFolderOptional,
							required: false,
							component: this.createHorizontalContainer(view, [this.contentFolderInputBox, browseContentFolderButton])
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
			if (this.contentFolderInputBox.value !== '' && !await pathExists(this.contentFolderInputBox.value)) {
				throw (new Error(loc.msgContentFolderError));
			}
			const bookPath = path.join(this.saveLocationInputBox.value, this.bookNameInputBox.value);
			await this.tocManager.createBook(bookPath, this.contentFolderInputBox.value);
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
