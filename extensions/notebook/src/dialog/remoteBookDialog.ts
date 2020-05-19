/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../common/localizedConstants';
import { RemoteBookController } from '../book/remoteBookController';
import { TreeNode, TreeDataProvider } from './treeDataProvider';
//import * as path from 'path';

function getRemoteLocationCategory(name: string): azdata.CategoryValue {
	if (name === 'GitHub') {
		return { name: name, displayName: loc.onGitHub };
	}
	return { name: name, displayName: loc.onSharedFile };
}

export class RemoteBookDialogModel {

	private _canceled = false;
	private _remoteTypes: azdata.CategoryValue[];

	constructor(
	) { }

	public get remoteLocationCategories(): azdata.CategoryValue[] {
		if (!this._remoteTypes) {
			this._remoteTypes = [getRemoteLocationCategory('GitHub'), getRemoteLocationCategory('Shared File')];
		}
		return this._remoteTypes;
	}

	public async fetchData(url: string, remoteLocation: string): Promise<any> {
		try {
			// We pre-fetch the endpoints here to verify that the information entered is correct (the user is able to connect)
			let controller = new RemoteBookController(url, remoteLocation);

			// Verify if it'
			//bookname -> language -> versions
			// books/ HowToDebug / EN/ 1.11


			let _isvalid = await controller.validate();
			if (_isvalid) {
				if (this._canceled) {
					return;
				}
				let releases = await controller.getReleases();
				let jsonReleases = JSON.parse(releases);
				return jsonReleases;
			}
		} catch (error) {
			// Ignore the error if we cancelled the request since we can't stop the actual request from completing
			if (!this._canceled) {
				throw error;
			}
		}
		return [];
	}
}

export class RemoteBookDialog {

	private dialog: azdata.window.Dialog;
	private view: azdata.ModelView;
	private formModel: azdata.FormContainer;
	private urlInputBox: azdata.InputBoxComponent;
	private remoteLocationDropdown: azdata.DropDownComponent;
	private remoteBookDropdown: azdata.DropDownComponent;
	private languageDropdown: azdata.DropDownComponent;
	private versionDropdown: azdata.DropDownComponent;

	constructor(private model: RemoteBookDialogModel) {
	}

	public showDialog(): void {
		this.createDialog();
		//this.openDialog();
	}

	private createDialog(): void {
		this.dialog = azdata.window.createModelViewDialog(loc.openRemoteBook);
		this.dialog.registerContent(async view => {
			this.view = view;
			this.urlInputBox = this.view.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					placeHolder: loc.url
				}).component();

			this.urlInputBox.onTextChanged(async () => await this.loadBooks());

			this.remoteLocationDropdown = this.view.modelBuilder.dropDown().withProperties({
				values: this.model.remoteLocationCategories,
				value: '',
				editable: false,
			}).component();

			this.remoteBookDropdown = this.view.modelBuilder.dropDown().withProperties({
				values: [],
				value: '',
				display: false,
			}).component();

			this.remoteBookDropdown.onValueChanged(async () => await this.validate());

			this.languageDropdown = this.view.modelBuilder.dropDown().withProperties({
				values: [],
				value: '',
				display: false,
			}).component();

			this.versionDropdown = this.view.modelBuilder.dropDown().withProperties({
				values: [],
				value: '',
				display: false,
			}).component();


			this.formModel = this.view.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: this.urlInputBox,
							title: loc.remoteBookUrl,
							required: true
						}, {
							component: this.remoteLocationDropdown,
							title: loc.location,
							required: true
						},
						{
							component: this.remoteBookDropdown,
							title: 'Book',
							required: true
						},
						{
							component: this.languageDropdown,
							title: 'Language',
							required: true
						},
						{
							component: this.versionDropdown,
							title: 'Version',
							required: true
						}
					],
					title: ''
				}]).withLayout({ width: '100%' }).component();
			await this.view.initializeModel(this.formModel);
			this.urlInputBox.focus();
		});
		this.dialog.okButton.label = loc.ok;
		this.dialog.cancelButton.label = loc.cancel;
		this.dialog.okButton.onClick(async () => await this.validate());
		azdata.window.openDialog(this.dialog);
	}

	private get remoteLocationValue(): string {
		return (<azdata.CategoryValue>this.remoteLocationDropdown.value).name;
	}

	private async validate(): Promise<boolean> {
		let url = this.urlInputBox && this.urlInputBox.value;
		let location = this.remoteLocationValue;

		try {
			let books = await this.model.fetchData(url, location);
			await this.fillDropdowns(books);
			return true;
		} catch (error) {
			this.dialog.message = {
				text: (typeof error === 'string') ? error : error.message,
				level: azdata.window.MessageLevel.Error
			};
			return false;
		}
	}

	private async loadBooks(): Promise<void> {
		this.remoteBookDropdown.values = ['Azure data TSG', 'BDC Troubleshooting Guide', 'Debugging Guide'];
		this.remoteBookDropdown.value = '';
	}

	public async fillDropdowns(books: any): Promise<void> {
		let bookVersions: Array<string> = [];
		books.forEach(book => {
			bookVersions.push(book.tag_name);
		});
		this.languageDropdown.updateProperties({
			values: ['EN', 'ES'],
			display: true,
		});
		this.versionDropdown.updateProperties({
			values: bookVersions,
			display: true,
		});
	}

	private async getTab3Content(view: azdata.ModelView): Promise<void> {
		// Make this programmatically
		let treeData = {
			label: '1',
			children: [
				{
					label: 'Book1',
					id: '11',
					children: [
						{
							label: 'EN',
							id: '111',
							children: [
								{
									label: 'Version 1.1',
									id: '1111',
								},
								{
									label: 'Version 1.2',
									id: '1112',
								}
							]
						},
						{
							label: 'ES',
							id: '12',
							children: [
								{
									label: 'Version 1.1',
									id: '1211',
								},
								{
									label: 'Version 1.2',
									id: '1212',
								}
							]
						}
					]
				},
			],
			id: '1'
		};
		let root = TreeNode.createTree(treeData);

		let treeDataProvider = new TreeDataProvider(root);

		this.urlInputBox = view.modelBuilder.inputBox()
			.withProperties<azdata.InputBoxProperties>({
				placeHolder: loc.url
			}).component();

		this.remoteLocationDropdown = view.modelBuilder.dropDown().withProperties({
			values: this.model.remoteLocationCategories,
			value: '',
			editable: false,
		}).component();

		let tree: azdata.TreeComponent<TreeNode> = view.modelBuilder.tree<TreeNode>().component();
		let treeView = tree.registerDataProvider(treeDataProvider);
		treeView.onDidChangeSelection(selectedNodes => {
			if (selectedNodes && selectedNodes.selection) {
				selectedNodes.selection.forEach(node => {
					console.info('tree node selected: ' + node.label);
				});
			}
		});
		let formModel = view.modelBuilder.formContainer()
			.withFormItems([
				{
					component: this.urlInputBox,
					title: loc.remoteBookUrl,
					required: true
				}, {
					component: this.remoteLocationDropdown,
					title: loc.location,
					required: true
				}]).withLayout({ width: '100%' }).component();

		let formModel2 = view.modelBuilder.formContainer()
			.withFormItems([
				{
					component: tree,
					title: 'Remote Book'
				}
			], {
				horizontal: false,
				componentWidth: 450,
				componentHeight: 200
			}).component();

		let flexModel = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column',
			}).withItems([formModel, formModel2]).component();
		await view.initializeModel(flexModel);
	}

	private openDialog(): void {
		let dialog = azdata.window.createModelViewDialog('Open Remote Book');
		//let tab3 = azdata.window.createTab('Test tab 3');
		//dialog.content = [tab3];
		dialog.okButton.onClick(() => console.log('ok clicked!'));
		dialog.cancelButton.onClick(() => console.log('cancel clicked!'));
		dialog.okButton.label = 'Open';
		dialog.cancelButton.label = loc.cancel;
		dialog.registerContent(async (view) => {
			await this.getTab3Content(view);
		});
		azdata.window.openDialog(dialog);
	}
}
