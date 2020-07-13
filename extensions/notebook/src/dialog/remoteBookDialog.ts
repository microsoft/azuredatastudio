/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../common/localizedConstants';
import { RemoteBookController, IReleases, IAssets } from '../book/remoteBookController';
import * as utils from '../common/utils';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();
const msgUndefinedAssetError = localize('msgUndefinedAssetError', "The selected book is not valid");

function getRemoteLocationCategory(name: string): azdata.CategoryValue {
	if (name === loc.onGitHub) {
		return { name: name, displayName: loc.onGitHub };
	}
	return { name: name, displayName: loc.onSharedFile };
}

export class RemoteBookDialogModel {
	private _remoteLocation: string;
	private _releases: IReleases[];
	private _assets: IAssets[];

	constructor() {
	}

	public get remoteLocation(): string {
		return this._remoteLocation;
	}

	public set remoteLocation(location: string) {
		this._remoteLocation = location;
	}

	public get releases(): IReleases[] {
		return this._releases;
	}

	public set releases(newReleases: IReleases[]) {
		this._releases = newReleases;
	}

	public get assets(): IAssets[] {
		return this._assets;
	}

	public set assets(newAssets: IAssets[]) {
		this._assets = newAssets;
	}

}

export class RemoteBookDialog {

	private dialog: azdata.window.Dialog;
	public view: azdata.ModelView;
	private formModel: azdata.FormContainer;
	private githubRepoDropdown: azdata.DropDownComponent;
	private remoteLocationDropdown: azdata.DropDownComponent;
	public releaseDropdown: azdata.DropDownComponent;
	private searchButton: azdata.ButtonComponent;
	public bookDropdown: azdata.DropDownComponent;
	public versionDropdown: azdata.DropDownComponent;
	public languageDropdown: azdata.DropDownComponent;
	private _remoteTypes: azdata.CategoryValue[];
	private readonly tigertoolboxrepo = 'repos/microsoft/tigertoolbox';
	private readonly urlGithubRE = /^(?:https:\/\/(?:github.com|api.github.com\/repos)|(?:\/)?(?:\/)?repos)([\w-.?!=&%*+:@\/]*)/g;

	constructor(public controller: RemoteBookController) {
	}

	public async createDialog(): Promise<void> {
		this.dialog = azdata.window.createModelViewDialog(loc.addRemoteBook);
		this.dialog.registerContent(async view => {
			this.view = view;

			this.remoteLocationDropdown = this.view.modelBuilder.dropDown().withProperties({
				values: this.remoteLocationCategories,
				value: '',
				editable: false,
			}).component();

			this.remoteLocationDropdown.onValueChanged(e => this.onRemoteLocationChanged());

			this.githubRepoDropdown = this.view.modelBuilder.dropDown().withProperties({
				values: [this.tigertoolboxrepo],
				value: '',
				editable: true,
				fireOnTextChange: true,
			}).component();

			this.searchButton = this.view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				label: loc.search,
				title: loc.search,
				width: '200px'
			}).component();
			this.searchButton.onDidClick(async () => await this.validate());

			this.releaseDropdown = this.view.modelBuilder.dropDown()
				.withProperties({
					values: [],
					value: '',
					enabled: false
				}).component();

			this.releaseDropdown.onValueChanged(async () => await this.getAssets());

			this.bookDropdown = this.view.modelBuilder.dropDown().withProperties({
				values: [],
				value: '',
				editable: false,
			}).component();

			this.bookDropdown.onValueChanged(async () => await this.fillVersionDropdown());

			this.versionDropdown = this.view.modelBuilder.dropDown().withProperties({
				values: [],
				value: '',
				editable: false,
			}).component();

			this.versionDropdown.onValueChanged(async () => await this.fillLanguageDropdown());

			this.languageDropdown = this.view.modelBuilder.dropDown().withProperties({
				values: [],
				value: '',
				editable: false,
			}).component();

			this.setFieldsToEmpty();

			this.formModel = this.view.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: this.remoteLocationDropdown,
							title: loc.location,
							required: true
						},
						{
							component: this.githubRepoDropdown,
							title: loc.repoUrl,
							required: true
						},
						{
							component: this.searchButton,
							title: ''
						},
						{
							component: this.releaseDropdown,
							title: loc.releases,
						},
						{
							component: this.bookDropdown,
							title: loc.book,
							required: true
						},
						{
							component: this.versionDropdown,
							title: loc.version,
							required: true
						},
						{
							component: this.languageDropdown,
							title: loc.language,
							required: true
						},
					],
					title: ''
				}]).withLayout({ width: '100%' }).component();
			await this.view.initializeModel(this.formModel);
		});
		this.dialog.okButton.enabled = false;
		this.dialog.okButton.label = loc.add;
		this.dialog.cancelButton.label = loc.close;
		this.dialog.registerCloseValidator(async () => await this.download());
		azdata.window.openDialog(this.dialog);
	}

	private async setFieldsToEmpty(): Promise<void> {
		await this.bookDropdown.updateProperties({
			values: [loc.invalidTextPlaceholder],
			value: loc.invalidTextPlaceholder
		});
		await this.versionDropdown.updateProperties({
			values: [loc.invalidTextPlaceholder],
			value: loc.invalidTextPlaceholder
		});
		await this.languageDropdown.updateProperties({
			values: [loc.invalidTextPlaceholder],
			value: loc.invalidTextPlaceholder
		});
	}

	private get remoteLocationValue(): string {
		return (<azdata.CategoryValue>this.remoteLocationDropdown.value).name;
	}

	public onRemoteLocationChanged(): void {
		if (this.controller.getReleases() !== undefined && this.remoteLocationValue === loc.onGitHub) {
			this.releaseDropdown.enabled = true;
		} else {
			this.releaseDropdown.enabled = false;
		}
	}

	public async validate(): Promise<void> {
		try {
			let url = utils.getDropdownValue(this.githubRepoDropdown);
			url = url.trim().toLowerCase();
			if (this.remoteLocationValue === loc.onGitHub && url.length > 0) {
				//get the first group to extract /owner/repo/releases format
				let groupsRe = url.match(this.urlGithubRE);
				if (groupsRe !== null && groupsRe.length > 0) {
					url = loc.apiGitHub(groupsRe[0]);
					let releases = await this.controller.fetchGithubReleases(new URL(url));
					if (releases) {
						this.releaseDropdown.enabled = true;
						await this.fillReleasesDropdown();
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

	public async getAssets(): Promise<void> {
		try {
			if (this.remoteLocationValue === loc.onGitHub) {
				let selected_release = this.controller.getReleases().filter(release =>
					release.name === this.releaseDropdown.value);
				let assets = await this.controller.fecthListAssets(selected_release[0]);
				if (assets !== undefined && assets.length > 0) {
					let bookValues: string[] = ['-'];
					assets.forEach(asset => {
						bookValues.push(asset.book);
					});
					bookValues = [...new Set(bookValues)]; //Remove duplicates
					this.bookDropdown.values = bookValues;
				}
			}
		}
		catch (error) {
			this.setFieldsToEmpty();
			this.dialog.message = {
				text: (typeof error === 'string') ? error : error.message,
				level: azdata.window.MessageLevel.Error
			};
		}
	}

	public async download(): Promise<boolean> {
		try {
			if (this.remoteLocationValue === loc.onGitHub) {
				let selected_asset = await this.getSelectedAsset();
				if (selected_asset === undefined) {
					throw (msgUndefinedAssetError);
				}
				await this.controller.setRemoteBook(selected_asset.url, this.remoteLocationValue, selected_asset);
			} else {
				let url = utils.getDropdownValue(this.githubRepoDropdown);
				let newUrl = new URL(url);
				await this.controller.setRemoteBook(newUrl, this.remoteLocationValue);
			}
			return true;
		}
		catch (error) {
			this.dialog.message = {
				text: (typeof error === 'string') ? error : error.message,
				level: azdata.window.MessageLevel.Error
			};
			return false;
		}
	}

	public async fillReleasesDropdown(): Promise<void> {
		let versions: string[] = ['-'];
		this.controller.getReleases().forEach(release => {
			versions.push(release.name);
		});
		this.releaseDropdown.values = versions;
		this.releaseDropdown.value = ' ';
	}

	public async fillVersionDropdown(): Promise<void> {
		let versions: string[] = ['-'];
		this.controller.getAssets().forEach(asset => {
			if (asset.book === this.bookDropdown.value) {
				versions.push(asset.version);
			}
		});
		this.versionDropdown.values = versions;
	}

	public async fillLanguageDropdown(): Promise<void> {
		let languages: string[] = ['-'];
		this.controller.getAssets().forEach(asset => {
			if (asset.book === this.bookDropdown.value && asset.version === this.versionDropdown.value) {
				languages.push(asset.language);
			}
		});
		this.languageDropdown.values = languages;
		if (this.checkValues) {
			this.dialog.okButton.enabled = true;
		}
	}

	public async getSelectedAsset(): Promise<IAssets> {
		let lang = this.languageDropdown.value;
		let book = this.bookDropdown.value;
		let version = this.versionDropdown.value;
		let selected_asset: IAssets;
		this.controller.getAssets().forEach(asset => {
			if (asset.book === book && asset.version === version && asset.language === lang) {
				selected_asset = asset;
			}
		});
		return selected_asset;
	}

	public checkValues(): boolean {
		if (this.languageDropdown.value !== 'N/A' && this.versionDropdown.value !== 'N/A' && this.bookDropdown.value !== 'N/A') {
			return true;
		}
		return false;
	}

	public get remoteLocationCategories(): azdata.CategoryValue[] {
		if (!this._remoteTypes) {
			this._remoteTypes = [getRemoteLocationCategory(loc.onGitHub)];
		}
		return this._remoteTypes;
	}
}
