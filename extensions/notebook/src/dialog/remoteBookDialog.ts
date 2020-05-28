/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../common/localizedConstants';
import { RemoteBookController, GitHubRemoteBook } from '../book/remoteBookController';

function getRemoteLocationCategory(name: string): azdata.CategoryValue {
	if (name === 'GitHub') {
		return { name: name, displayName: loc.onGitHub };
	}
	return { name: name, displayName: loc.onSharedFile };
}

export class RemoteBookDialogModel {

	private _canceled = false;
	private _remoteTypes: azdata.CategoryValue[];
	private _controller: RemoteBookController;

	constructor(
	) {
		this._controller = new RemoteBookController();
	}

	public get remoteLocationCategories(): azdata.CategoryValue[] {
		if (!this._remoteTypes) {
			this._remoteTypes = [getRemoteLocationCategory('GitHub'), getRemoteLocationCategory('Shared File')];
		}
		return this._remoteTypes;
	}

	public async setRemoteBook(url: string, remoteLocation: string): Promise<any> {
		try {
			if (this._controller !== undefined) {
				return this._controller.setRemoteBook(url, remoteLocation);
			}
		} catch (error) {
			// Ignore the error if we cancelled the request since we can't stop the actual request from completing
			if (!this._canceled) {
				throw error;
			}
		}
		return [];
	}

	public async downloadLocalCopy(book?: GitHubRemoteBook): Promise<void> {
		if (this._controller !== undefined) {
			if (book) {
				this._controller.updateBook(book);
			}
			await this._controller.setLocalPath();
		}
	}

}

export class RemoteBookDialog {

	private dialog: azdata.window.Dialog;
	private view: azdata.ModelView;
	private formModel: azdata.FormContainer;
	private urlInputBox: azdata.InputBoxComponent;
	private remoteLocationDropdown: azdata.DropDownComponent;
	//private remoteBookDropdown: azdata.DropDownComponent;
	//private languageDropdown: azdata.DropDownComponent;
	//private versionDropdown: azdata.DropDownComponent;
	private releaseDropdown: azdata.DropDownComponent;
	private releases: GitHubRemoteBook[];

	constructor(private model: RemoteBookDialogModel) {
	}

	public showDialog(): void {
		this.createDialog();
	}

	private createDialog(): void {
		this.dialog = azdata.window.createModelViewDialog(loc.openRemoteBook);
		this.dialog.registerContent(async view => {
			this.view = view;

			this.remoteLocationDropdown = this.view.modelBuilder.dropDown().withProperties({
				values: this.model.remoteLocationCategories,
				value: '',
				editable: false,
			}).component();

			this.remoteLocationDropdown.onValueChanged(e => this.onRemoteLocationChanged());

			this.urlInputBox = this.view.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					placeHolder: loc.url
				}).component();

			this.urlInputBox.onTextChanged(async () => await this.validate());

			/* 			this.remoteBookDropdown = this.view.modelBuilder.dropDown().withProperties({
							values: [],
							value: '',
						}).component();

						this.languageDropdown = this.view.modelBuilder.dropDown().withProperties({
							values: [],
							value: '',
						}).component(); */

			this.releaseDropdown = this.view.modelBuilder.dropDown().withProperties({
				values: [],
				value: '',
			}).component();

			this.releaseDropdown.updateCssStyles({
				display: 'none'
			});

			this.releaseDropdown.onValueChanged(async () => await this.selectedRelease());

			this.formModel = this.view.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: this.remoteLocationDropdown,
							title: loc.location,
							required: true
						},
						{
							component: this.urlInputBox,
							title: loc.remoteBookUrl,
							required: true
						},
						{
							component: this.releaseDropdown,
							title: ''
						},
					],
					title: ''
				}]).withLayout({ width: '100%' }).component();
			await this.view.initializeModel(this.formModel);
			this.urlInputBox.focus();
		});
		this.dialog.okButton.label = loc.open;
		this.dialog.cancelButton.label = loc.cancel;
		azdata.window.openDialog(this.dialog);
	}

	private get remoteLocationValue(): string {
		return (<azdata.CategoryValue>this.remoteLocationDropdown.value).name;
	}

	private onRemoteLocationChanged(): void {
		let location = this.remoteLocationValue;
		if (this.releases !== undefined && location === 'GitHub') {
			this.releaseDropdown.updateCssStyles({
				display: 'block'
			});
		} else {
			this.releaseDropdown.updateCssStyles({
				display: 'none'
			});
		}
	}

	private async validate(): Promise<any> {
		let url = this.urlInputBox && this.urlInputBox.value;
		let location = this.remoteLocationValue;

		try {
			let releases = await this.model.setRemoteBook(url, location);
			if (releases !== undefined && releases !== []) {

				this.releaseDropdown.updateCssStyles({
					display: 'block'
				});

				return await this.fillReleasesDropdown(releases);
			}
		}
		catch (error) {
			this.dialog.message = {
				text: (typeof error === 'string') ? error : error.message,
				level: azdata.window.MessageLevel.Error
			};
		}
		return false;
	}

	public async selectedRelease(): Promise<void> {
		let location = this.remoteLocationValue;
		if (location === 'GitHub') {
			let selected_release = this.releases.filter(release =>
				release.version === this.releaseDropdown.value);
			await this.model.downloadLocalCopy(selected_release[0]);
		}
		this.dialog.okButton.enabled = true;
	}

	public async fillReleasesDropdown(releases: GitHubRemoteBook[]): Promise<void> {
		this.releases = releases;
		let versions: string[] = ['-'];
		releases.forEach(release => {
			versions.push(release.version);
		});

		this.releaseDropdown.updateProperties({
			values: versions
		});
	}
}
