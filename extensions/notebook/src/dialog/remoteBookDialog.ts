/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../common/localizedConstants';
import { RemoteBookController, IReleases } from '../book/remoteBookController';

function getRemoteLocationCategory(name: string): azdata.CategoryValue {
	if (name === loc.onGitHub) {
		return { name: name, displayName: loc.onGitHub };
	}
	return { name: name, displayName: loc.onSharedFile };
}

export class RemoteBookDialogModel {
	private _remoteTypes: azdata.CategoryValue[];
	private _controller: RemoteBookController;

	constructor(
	) {
		this._controller = new RemoteBookController();
	}

	public get remoteLocationCategories(): azdata.CategoryValue[] {
		if (!this._remoteTypes) {
			this._remoteTypes = [getRemoteLocationCategory(loc.onGitHub), getRemoteLocationCategory(loc.onSharedFile)];
		}
		return this._remoteTypes;
	}

	public async getReleases(url: string): Promise<IReleases[]> {
		let remotePath: URL;
		try {
			url = loc.apiGitHub.concat(url);
			remotePath = new URL(url);
			return this._controller.getReleases(remotePath);
		}
		catch (error) {
			throw error;
		}
	}

	public async downloadLocalCopy(url: URL, remoteLocation: string, release?: IReleases): Promise<void> {
		if (release) {
			await this._controller.setRemoteBook(url, remoteLocation, release.zipURL, release.tarURL);
		}
		else {
			await this._controller.setRemoteBook(url, remoteLocation);
		}
	}

	public openRemoteBook(book: string): void {
		this._controller.openRemoteBook(book);
	}
}

export class RemoteBookDialog {

	private dialog: azdata.window.Dialog;
	private view: azdata.ModelView;
	private formModel: azdata.FormContainer;
	private urlInputBox: azdata.InputBoxComponent;
	private remoteLocationDropdown: azdata.DropDownComponent;
	private releaseDropdown: azdata.DropDownComponent;
	private releaseDropdownComponent: azdata.FormComponent;
	private releases: IReleases[];

	constructor(private model: RemoteBookDialogModel) {
	}

	public showDialog(): void {
		this.createDialog();
	}

	private async createReleaseDropdown(): Promise<azdata.FormComponent> {
		this.releaseDropdown = this.view.modelBuilder.dropDown()
			.withProperties({
				values: [],
				value: '',
			}).component();

		this.releaseDropdown.updateCssStyles({
			display: 'none'
		});

		return {
			component: this.releaseDropdown,
			title: '',
			required: false
		};
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

			this.releaseDropdownComponent = await this.createReleaseDropdown();

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
						this.releaseDropdownComponent,
					],
					title: ''
				}]).withLayout({ width: '100%' }).component();
			await this.view.initializeModel(this.formModel);
			this.urlInputBox.focus();
		});
		this.dialog.registerCloseValidator(async () => await this.download());
		this.dialog.okButton.label = loc.open;
		this.dialog.cancelButton.label = loc.cancel;
		azdata.window.openDialog(this.dialog);
	}

	private get remoteLocationValue(): string {
		return (<azdata.CategoryValue>this.remoteLocationDropdown.value).name;
	}

	private onRemoteLocationChanged(): void {
		let location = this.remoteLocationValue;
		if (this.releases !== undefined && location === loc.onGitHub) {
			this.releaseDropdown.updateCssStyles({
				display: 'block'
			});
		} else {
			this.releaseDropdown.updateCssStyles({
				display: 'none'
			});
		}
	}

	private async validate(): Promise<void> {
		try {
			let url = this.urlInputBox && this.urlInputBox.value;
			url = url.trim().toLowerCase();
			let location = this.remoteLocationValue;
			if (location === loc.onGitHub && url.length > 0) {
				//get the first group to extract /owner/repo/releases format
				let re = /^(?:https:\/\/(?:github.com|api.github.com\/repos)|(?:\/)?(?:\/)?repos)([\w-.?!=&%*+:@\/]*\/releases)/g;
				let groupsRe = re.exec(url);
				if (groupsRe !== undefined) {
					url = groupsRe.pop();
					let releases = await this.model.getReleases(url);
					if (releases !== undefined && releases !== []) {
						await this.fillReleasesDropdown(releases);
					}
				} else {
					throw new Error(loc.urlGithubError);
				}
			}
		}
		catch (error) {
			this.dialog.message = {
				text: (typeof error === 'string') ? error : error.message,
				level: azdata.window.MessageLevel.Error
			};
		}
	}

	private async download(): Promise<boolean> {
		let location = this.remoteLocationValue;
		try {
			this.dialog.okButton.enabled = false;
			if (location === loc.onGitHub) {
				let selected_release = this.releases.filter(release =>
					release.tag_name === this.releaseDropdown.value);
				await this.model.downloadLocalCopy(selected_release[0].remote_path, location, selected_release[0]);
			} else {
				let url = this.urlInputBox && this.urlInputBox.value;
				let newUrl = new URL(url);
				await this.model.downloadLocalCopy(newUrl, location);
			}
			return true;
		}
		catch (error) {
			this.dialog.message = {
				text: (typeof error === 'string') ? error : error.message,
				level: azdata.window.MessageLevel.Error
			};
			this.dialog.okButton.enabled = true;
			return false;
		}
	}

	private async fillReleasesDropdown(releases: IReleases[]): Promise<void> {
		this.releases = releases;
		let versions: string[] = [];
		releases.forEach(release => {
			versions.push(release.tag_name);
		});

		this.releaseDropdownComponent.title = loc.releases;
		this.releaseDropdownComponent.required = true;
		this.releaseDropdownComponent.component.updateCssStyles({
			display: 'block'
		});
		this.releaseDropdownComponent.component.updateProperties({
			values: versions
		});
	}
}
