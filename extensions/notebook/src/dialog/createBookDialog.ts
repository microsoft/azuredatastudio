/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';
//import {pathExists, remove} from 'fs-extra';
import * as loc from '../common/localizedConstants';
import { IconPathHelper } from '../common/iconHelper';
import { BookTocManager } from '../book/bookTocManager';

export class CreateBookDialog {

	private dialog: azdata.window.Dialog;
	public view: azdata.ModelView;
	private formModel: azdata.FormContainer;
	private groupNameInputBox: azdata.InputBoxComponent;
	private locationInputBox: azdata.InputBoxComponent;
	private notebooksLocationInputBox: azdata.InputBoxComponent;
	public saveLocation: string = '';
	public contentFolder: string = '';
	public tocManager: BookTocManager;

	constructor(toc: BookTocManager) {
		this.tocManager = toc;
	}

	protected createHorizontalContainer(view: azdata.ModelView, items: azdata.Component[]): azdata.FlexContainer {
		return view.modelBuilder.flexContainer().withItems(items, { CSSStyles: { 'margin-right': '10px', 'margin-bottom': '10px' } }).withLayout({ flexFlow: 'row' }).component();
	}

	public async selectFolder(): Promise<string> {
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
			let pickedFolder = uris[0];
			//let destinationUri: vscode.Uri = vscode.Uri.file(path.join(pickedFolder.fsPath, path.basename(this.groupNameInputBox.value)));
			if (pickedFolder.fsPath) {
				// if (await pathExists(destinationUri.fsPath)) {
				// 	let doReplace = await this.confirmReplace();
				// 	if (!doReplace) {
				// 		return undefined;
				// 	}
				// 	else {
				// 		//remove folder if exists
				// 		await remove(destinationUri.fsPath);
				// 	}
				// }
				return pickedFolder.fsPath;
			}
		}
		return undefined;
	}

	public async createDialog(): Promise<void> {
		this.dialog = azdata.window.createModelViewDialog('New group');
		this.dialog.registerContent(async view => {
			this.view = view;

			this.groupNameInputBox = this.view.modelBuilder.inputBox()
				.withProperties({
					values: [],
					value: '',
					enabled: true
				}).component();

			this.locationInputBox = this.view.modelBuilder.inputBox().withProperties({
				values: [],
				value: '',
				placeHolder: 'Browse locations...',
				width: '400px'
			}).component();

			this.notebooksLocationInputBox = this.view.modelBuilder.inputBox().withProperties({
				values: [],
				value: '',
				placeHolder: 'Select content folder.',
				width: '400px'
			}).component();

			const browseFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				ariaLabel: 'Browse',
				iconPath: IconPathHelper.folder,
				width: '18px',
				height: '20px',
			}).component();

			const browseContentFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				ariaLabel: 'Browse',
				iconPath: IconPathHelper.folder,
				width: '18px',
				height: '20px',
			}).component();

			browseFolderButton.onDidClick(async () => {
				this.saveLocation = await this.selectFolder();
				this.locationInputBox.value = this.saveLocation;
			});

			browseContentFolderButton.onDidClick(async () => {
				this.contentFolder = await this.selectFolder();
				this.notebooksLocationInputBox.value = this.contentFolder;
			});

			this.formModel = this.view.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: this.groupNameInputBox,
							title: 'Name',
							required: true
						},
						{
							title: 'Save location',
							required: true,
							component: this.createHorizontalContainer(view, [this.locationInputBox, browseFolderButton])
						},
						{
							title: 'Content folder (Optional)',
							required: false,
							component: this.createHorizontalContainer(view, [this.notebooksLocationInputBox, browseContentFolderButton])
						},
					],
					title: ''
				}]).withLayout({ width: '100%' }).component();
			await this.view.initializeModel(this.formModel);
		});
		this.dialog.okButton.label = 'Create';
		this.dialog.okButton.onClick(() => {
			this.saveLocation = this.locationInputBox.value;
			this.contentFolder = this.notebooksLocationInputBox.value;
		});

		this.dialog.cancelButton.label = 'Cancel';
		this.dialog.registerCloseValidator(async () => await this.create());
		azdata.window.openDialog(this.dialog);
	}

	private async create(): Promise<boolean> {
		try {
			const bookPath = path.join(this.saveLocation, this.groupNameInputBox.value);
			await this.tocManager.createBook(bookPath, this.contentFolder);
			return true;
		} catch (error) {
			return false;
		}
	}
}
