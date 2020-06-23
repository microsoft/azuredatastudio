/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../common/localizedConstants';
import { RemoteBookController, IReleases, IAssets, GitHubRemoteBook } from '../book/remoteBookController';
import { ApiWrapper } from '../common/apiWrapper';
import * as utils from '../common/utils';

function getRemoteLocationCategory(name: string): azdata.CategoryValue {
	if (name === loc.onGitHub) {
		return { name: name, displayName: loc.onGitHub };
	}
	return { name: name, displayName: loc.onSharedFile };
}

export class RemoteBookDialogModel {
	private _remoteTypes: azdata.CategoryValue[];
	private _controller: RemoteBookController;
	private _remoteLocation: string;
	private _releases: IReleases[];
	private _assets: IAssets[];

	constructor(private apiWrapper: ApiWrapper) {
		this._controller = new RemoteBookController(this.apiWrapper);
	}

	public get remoteLocationCategories(): azdata.CategoryValue[] {
		if (!this._remoteTypes) {
			this._remoteTypes = [getRemoteLocationCategory(loc.onGitHub)];
		}
		return this._remoteTypes;
	}

	public async getReleases(url: string): Promise<Boolean> {
		let remotePath: URL;
		url = loc.apiGitHub(url);
		remotePath = new URL(url);
		this._releases = await GitHubRemoteBook.getReleases(remotePath);
		return this._releases !== undefined && this._releases.length > 0;
	}

	public async getListAssets(release: IReleases): Promise<IAssets[]> {
		try {
			return await GitHubRemoteBook.getListAssets(release);
		}
		catch (error) {
			throw error;
		}
	}

	public async downloadLocalCopy(url: URL, asset?: IAssets): Promise<void> {
		await this._controller.setRemoteBook(url, this._remoteLocation, asset);
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
	private readonly tigertoolboxrepo = 'repos/microsoft/tigertoolbox';
	private readonly urlGithubRE = /^(?:https:\/\/(?:github.com|api.github.com\/repos)|(?:\/)?(?:\/)?repos)([\w-.?!=&%*+:@\/]*)/g;

	constructor(public model: RemoteBookDialogModel) {
	}

	public async createDialog(): Promise<void> {
		this.dialog = azdata.window.createModelViewDialog(loc.addRemoteBook);
		this.dialog.registerContent(async view => {
			this.view = view;

			this.remoteLocationDropdown = this.view.modelBuilder.dropDown().withProperties({
				values: this.model.remoteLocationCategories,
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
		this.model.remoteLocation = this.remoteLocationValue;
		if (this.model.releases !== undefined && this.model.remoteLocation === loc.onGitHub) {
			this.releaseDropdown.enabled = true;
		} else {
			this.releaseDropdown.enabled = false;
		}
	}

	public async validate(): Promise<void> {
		try {
			let url = utils.getDropdownValue(this.githubRepoDropdown);
			url = url.trim().toLowerCase();
			this.model.remoteLocation = this.remoteLocationValue;
			if (this.model.remoteLocation === loc.onGitHub && url.length > 0) {
				//get the first group to extract /owner/repo/releases format
				let groupsRe = url.match(this.urlGithubRE);
				if (groupsRe !== null && groupsRe.length > 0) {
					url = groupsRe[0];
					let isValid = await this.model.getReleases(url);
					if (isValid) {
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
			if (this.model.remoteLocation === loc.onGitHub) {
				let selected_release = this.model.releases.filter(release =>
					release.name === this.releaseDropdown.value);
				let assets = await this.model.getListAssets(selected_release[0]);
				if (assets !== undefined && assets.length > 0) {
					let bookValues: string[] = [];
					assets.forEach(asset => {
						bookValues.push(asset.book);
					});
					this.bookDropdown.values = bookValues;
					await this.fillVersionDropdown();
					await this.fillLanguageDropdown();
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
			if (this.model.remoteLocation === loc.onGitHub) {
				let selected_asset = await this.getSelectedAsset(); //in controller
				await this.model.downloadLocalCopy(selected_asset.url, selected_asset);
			} else {
				let url = utils.getDropdownValue(this.githubRepoDropdown);
				let newUrl = new URL(url);
				await this.model.downloadLocalCopy(newUrl);
			}
			this.dialog.okButton.enabled = true;
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
		let versions: string[] = [];
		this.model.releases.forEach(release => {
			versions.push(release.name);
		});
		this.releaseDropdown.values = versions;
		this.releaseDropdown.value = ' ';
	}

	public async fillVersionDropdown(): Promise<void> {
		let versions: string[] = [];
		this.model.assets.forEach(asset => {
			if (asset.book === this.bookDropdown.value) {
				versions.push(asset.version);
			}
		});
		this.versionDropdown.values = versions;
	}

	public async fillLanguageDropdown(): Promise<void> {
		let languages: string[] = [];
		this.model.assets.forEach(asset => {
			if (asset.book === this.bookDropdown.value && asset.version === this.versionDropdown.value) {
				languages.push(asset.language);
			}
		});
		this.languageDropdown.values = languages;
	}

	public async getSelectedAsset(): Promise<IAssets> {
		let lang = this.languageDropdown.value;
		let book = this.bookDropdown.value;
		let version = this.versionDropdown.value;
		let assets: IAssets[] = [];
		this.model.assets.forEach(asset => {
			if (asset.book === book && asset.version === version && asset.language === lang) {
				if (asset.browser_download_url.href.endsWith('zip')) {
					asset.zip_url = asset.browser_download_url;
				} else {
					asset.tar_url = asset.browser_download_url;
				}
				assets.push(asset);
			}
		});
		if (assets.length > 1) {
			return { ...assets[0], ...assets[1] };
		}
		return assets[0];
	}
}
