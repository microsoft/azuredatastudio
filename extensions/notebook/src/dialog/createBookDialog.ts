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
import { confirmReplace } from '../common/utils';
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
		return view.modelBuilder.flexContainer().withItems(items, { CSSStyles: { 'margin-right': '10px', 'margin-bottom': '10px' } }).withLayout({ flexFlow: 'row' }).component();
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
		this.dialog = azdata.window.createModelViewDialog(loc.newGroup);
		this.dialog.registerContent(async view => {
			this.view = view;

			const groupLabel = this.view.modelBuilder.text()
				.withProperties({
					value: loc.groupDescription,
					CSSStyles: { 'margin-bottom': '0px', 'margin-top': '0px', 'font-size': 'small' }
				}).component();

			this.bookNameInputBox = this.view.modelBuilder.inputBox()
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

			this.contentFolderInputBox = this.view.modelBuilder.inputBox().withProperties({
				values: [],
				value: '',
				placeHolder: loc.selectContentFolder,
				width: '400px'
			}).component();

			const browseFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				ariaLabel: loc.browse,
				iconPath: IconPathHelper.folder,
				width: '18px',
				height: '20px',
			}).component();

			const browseContentFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				ariaLabel: loc.browse,
				iconPath: IconPathHelper.folder,
				width: '18px',
				height: '20px',
			}).component();

			browseFolderButton.onDidClick(async () => {
				this.saveLocationInputBox.value = await this.selectFolder();
			});

			browseContentFolderButton.onDidClick(async () => {
				this.contentFolderInputBox.value = await this.selectFolder();
			});

			this.formModel = this.view.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: groupLabel,
							required: false
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
							title: loc.contentFolder,
							required: false,
							component: this.createHorizontalContainer(view, [this.contentFolderInputBox, browseContentFolderButton])
						},
					],
					title: ''
				}]).withLayout({ width: '100%' }).component();
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
