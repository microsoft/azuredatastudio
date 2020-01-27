/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';

export class FileBrowserDialog {

	private selectedPathTextBox: azdata.InputBoxComponent | undefined;
	private fileBrowserDialog: azdata.window.Dialog | undefined;
	private fileBrowserNameBox: azdata.InputBoxComponent | undefined;
	private fileBrowserTree: azdata.FileBrowserTreeComponent | undefined;
	private fileTypeDropdown: azdata.DropDownComponent | undefined;

	private _onPathSelected: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
	public readonly onPathSelected: vscode.Event<string> = this._onPathSelected.event;


	constructor(private ownerUri: string) {

	}

	/**
	 * Opens a dialog to manage packages used by notebooks.
	 */
	public showDialog(): void {
		let fileBrowserTitle = '';
		this.fileBrowserDialog = azdata.window.createModelViewDialog(fileBrowserTitle);
		let fileBrowserTab = azdata.window.createTab('File Browser');
		this.fileBrowserDialog.content = [fileBrowserTab];
		fileBrowserTab.registerContent(async (view) => {
			this.fileBrowserTree = view.modelBuilder.fileBrowserTree()
				.withProperties({ ownerUri: this.ownerUri, width: 420, height: 700 })
				.component();
			this.selectedPathTextBox = view.modelBuilder.inputBox()
				.withProperties({ inputType: 'text' })
				.component();
			this.fileBrowserTree.onDidChange((args) => {
				if (this.selectedPathTextBox) {
					this.selectedPathTextBox.value = args.fullPath;
				}
				if (this.fileBrowserNameBox) {
					this.fileBrowserNameBox.value = args.isFile ? path.win32.basename(args.fullPath) : '';
				}
			});
			this.fileTypeDropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: 'All',
					values: ['All']
				})
				.component();
			this.fileBrowserNameBox = view.modelBuilder.inputBox()
				.withProperties({})
				.component();
			let fileBrowserContainer = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.fileBrowserTree,
					title: ''
				}, {
					component: this.selectedPathTextBox,
					title: 'Selected Path'
				}, {
					component: this.fileTypeDropdown,
					title: 'File of Type'
				}, {
					component: this.fileBrowserNameBox,
					title: 'File Name'
				}
				]).component();
			view.initializeModel(fileBrowserContainer);
		});
		this.fileBrowserDialog.okButton.onClick(() => {
			if (this.selectedPathTextBox && this.fileBrowserNameBox) {
				let selectedPath = this.selectedPathTextBox.value || '';
				this._onPathSelected.fire(selectedPath);
			}
		});
		this.fileBrowserDialog.okButton.label = 'OK';
		this.fileBrowserDialog.cancelButton.label = 'Cancel';
		azdata.window.openDialog(this.fileBrowserDialog);
	}
}
