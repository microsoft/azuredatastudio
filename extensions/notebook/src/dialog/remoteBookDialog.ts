/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../common/localizedConstants';
import { RemoteBookController, getReleases } from '../book/remoteBookController';
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

	//private _dummyPath: string = 'books/HowToDebug/EN/1.11';

	// TODO add the dialogs to show as cascade

	// Open a file (funcionality)
	constructor(
		public prefilledUrl?: string
	) {
		prefilledUrl = prefilledUrl;
	}

	public get remoteLocationCategories(): azdata.CategoryValue[] {
		if (!this._remoteTypes) {
			this._remoteTypes = [getRemoteLocationCategory('GitHub'), getRemoteLocationCategory('Shared File')];
		}
		return this._remoteTypes;
	}

	public async onComplete(url: string, remoteLocation: string): Promise<void> {
		try {
			// We pre-fetch the endpoints here to verify that the information entered is correct (the user is able to connect)
			let controller = new RemoteBookController(url, remoteLocation);
			console.log(controller);
			await getReleases();


			// Verify if it's a valid input
			//bookname -> language -> versions
			// books/ HowToDebug / EN/ 1.11



			/*
			let _isvalid = controller.validate();
			let response = await controller.getVersions();
			if (_isvalid) {
				if (this._canceled) {
					return;
				}
				this.treeDataProvider.addOrUpdateController(url, auth, username, password, rememberPassword);
				vscode.commands.executeCommand(ManageControllerCommand, <BdcDashboardOptions>{ url: url, auth: auth, username: username, password: password });
				await this.treeDataProvider.saveControllers();
			}
			*/
		} catch (error) {
			// Ignore the error if we cancelled the request since we can't stop the actual request from completing
			if (!this._canceled) {
				throw error;
			}
		}
	}
}

export class RemoteBookDialog {

	private dialog: azdata.window.Dialog;
	private urlInputBox: azdata.InputBoxComponent;
	private remoteLocationDropdown: azdata.DropDownComponent;
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
			this.urlInputBox = view.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					placeHolder: loc.url,
					value: this.model.prefilledUrl
				}).component();

			this.remoteLocationDropdown = view.modelBuilder.dropDown().withProperties({
				values: this.model.remoteLocationCategories,
				value: '',
				editable: false,
			}).component();

			this.languageDropdown = view.modelBuilder.dropDown().withProperties({
				values: ['EN', 'ES'],
				value: '',
				editable: false,
			}).component();

			this.versionDropdown = view.modelBuilder.dropDown().withProperties({
				values: ['1.11', '1.21'],
				value: '',
				editable: false,
			}).component();

			let formModel = view.modelBuilder.formContainer()
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
						}, {
							component: this.languageDropdown,
							title: 'Language',
							required: true
						}, {
							component: this.versionDropdown,
							title: 'Version',
							required: true
						}
					],
					title: 'Open Remote Book'
				}]).withLayout({ width: '100%' }).component();
			await view.initializeModel(formModel);
			this.urlInputBox.focus();
		});
		this.dialog.registerCloseValidator(async () => await this.validate());
		this.dialog.okButton.label = loc.ok;
		this.dialog.cancelButton.label = loc.cancel;
		azdata.window.openDialog(this.dialog);
	}

	private get remoteLocationValue(): string {
		return (<azdata.CategoryValue>this.remoteLocationDropdown.value).name;
	}

	private async validate(): Promise<boolean> {
		let url = this.urlInputBox && this.urlInputBox.value;
		let location = this.remoteLocationValue;

		try {
			await this.model.onComplete(url, location);
			return true;
		} catch (error) {
			this.dialog.message = {
				text: (typeof error === 'string') ? error : error.message,
				level: azdata.window.MessageLevel.Error
			};
			return false;
		}
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
				placeHolder: loc.url,
				value: this.model.prefilledUrl
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
