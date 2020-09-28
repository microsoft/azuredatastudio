/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../common/localizedConstants';
import { RemoteBookController, IAsset } from '../book/remoteBookController';
import * as utils from '../common/utils';
import * as vscode from 'vscode';

const tigerToolboxRepo = 'repos/microsoft/tigertoolbox';
const urlGithubRE = /^(?:https:\/\/(?:github\.com|api\.github\.com\/repos)|(?:\/)?(?:\/)?repos)([\w-.?!=&%*+:@\/]*)/g;

function apiGitHub(url: string): string {
	return `https://api.github.com/${url}/releases`;
}

function getRemoteLocationCategory(name: string): azdata.CategoryValue {
	if (name === loc.onGitHub) {
		return { name: name, displayName: loc.onGitHub };
	}
	return { name: name, displayName: loc.onSharedFile };
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
				values: [tigerToolboxRepo],
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

			this.languageDropdown.onValueChanged(async () => this.checkValues());
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
		this.dialog.okButton.enabled = false;
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
				let groupsRe = url.match(urlGithubRE);
				if (groupsRe?.length > 0) {
					url = apiGitHub(groupsRe[0]);
					let releases = await this.controller.getReleases(vscode.Uri.parse(url));
					if (releases) {
						this.releaseDropdown.enabled = true;
						await this.fillReleasesDropdown();
						this.setFieldsToEmpty();
					}
				} else {
					throw new Error(loc.urlGithubError);
				}
			}
		}
		catch (error) {
			await this.fillReleasesDropdown();
			this.setFieldsToEmpty();
			this.showErrorMessage(error.message);
		}
	}

	public async getAssets(): Promise<void> {
		try {
			if (this.remoteLocationValue === loc.onGitHub) {
				let releases = await this.controller.getReleases();
				let selected_release = releases.filter(release =>
					release.name === this.releaseDropdown.value);
				let assets = await this.controller.getAssets(selected_release[0]);
				if (assets?.length > 0) {
					this.bookDropdown.values = ['-'].concat([...new Set(assets.map(asset => asset.book))]);
				}
				this.checkValues();
			}
		}
		catch (error) {
			this.setFieldsToEmpty();
			this.showErrorMessage(error.message);
		}
	}

	public async download(): Promise<boolean> {
		try {
			if (this.remoteLocationValue === loc.onGitHub) {
				let selected_asset = await this.getSelectedAsset();
				if (!selected_asset) {
					throw new Error(loc.msgUndefinedAssetError);
				}
				await this.controller.setRemoteBook(selected_asset.url, this.remoteLocationValue, selected_asset);
			} else {
				let url = utils.getDropdownValue(this.githubRepoDropdown);
				let newUrl = vscode.Uri.parse(url);
				await this.controller.setRemoteBook(newUrl, this.remoteLocationValue);
			}
			return true;
		}
		catch (error) {
			this.showErrorMessage(error.message);
			return false;
		}
	}

	public async fillReleasesDropdown(): Promise<void> {
		this.releaseDropdown.values = ['-'].concat((await this.controller.getReleases()).map(release => release.name));
	}

	public async fillVersionDropdown(): Promise<void> {
		let filtered_assets = (await this.controller.getAssets()).filter(asset => asset.book === this.bookDropdown.value);
		this.versionDropdown.values = ['-'].concat(filtered_assets.map(asset => asset.version));
		this.checkValues();
	}

	public async fillLanguageDropdown(): Promise<void> {
		let filtered_assets = (await this.controller.getAssets()).filter(asset => asset.book === this.bookDropdown.value &&
			asset.version === this.versionDropdown.value);
		this.languageDropdown.values = ['-'].concat(filtered_assets.map(asset => asset.language));
		this.checkValues();
	}

	public async getSelectedAsset(): Promise<IAsset> {
		let lang = this.languageDropdown.value;
		let book = this.bookDropdown.value;
		let version = this.versionDropdown.value;
		return (await this.controller.getAssets()).filter(asset => asset.book === book && asset.version === version && asset.language === lang)[0];
	}

	public checkValues(): void {
		if (this.languageDropdown.value !== loc.invalidTextPlaceholder && this.versionDropdown.value !== loc.invalidTextPlaceholder &&
			this.bookDropdown.value !== loc.invalidTextPlaceholder) {
			this.dialog.okButton.enabled = true;
		} else {
			this.dialog.okButton.enabled = false;
		}
	}

	public get remoteLocationCategories(): azdata.CategoryValue[] {
		if (!this._remoteTypes) {
			this._remoteTypes = [getRemoteLocationCategory(loc.onGitHub)];
		}
		return this._remoteTypes;
	}

	public showErrorMessage(message: string): void {
		this.dialog.message = {
			text: message,
			level: azdata.window.MessageLevel.Error
		};
	}
}
