/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as request from 'request';
import * as loc from '../common/localizedConstants';
import * as utils from '../common/utils';
import * as vscode from 'vscode';
import { RemoteBookDialogModel } from '../dialog/remoteBookDialogModel';
import { GitHubRemoteBook } from '../book/githubRemoteBook';
import { SharedRemoteBook } from '../book/sharedRemoteBook';

const assetNameRE = /([a-zA-Z0-9]+)(?:-|_)([a-zA-Z0-9.]+)(?:-|_)([a-zA-Z0-9]+).(zip|tar.gz|tgz)/;

export class RemoteBookController {
	constructor(public model: RemoteBookDialogModel, public outputChannel: vscode.OutputChannel) {
	}

	public async setRemoteBook(url: vscode.Uri, remoteLocation: string, asset?: IAsset): Promise<void> {
		if (remoteLocation === 'GitHub') {
			this.model.remoteBook = new GitHubRemoteBook(url, this.outputChannel, asset);
		} else {
			this.model.remoteBook = new SharedRemoteBook(url, this.outputChannel);
		}
		return await this.model.remoteBook.createLocalCopy();
	}

	public async getReleases(url?: vscode.Uri): Promise<IRelease[]> {
		if (url) {
			this.model.releases = [];
			let options = {
				headers: {
					'User-Agent': 'request'
				}
			};
			return new Promise<IRelease[]>((resolve, reject) => {
				request.get(url.toString(false), options, (error, response, body) => {
					if (error) {
						return reject(error);
					}

					if (response.statusCode !== 200) {
						return reject(new Error(loc.httpRequestError(response.statusCode, response.statusMessage)));
					}

					let releases = JSON.parse(body);
					let bookReleases: IRelease[] = [];
					if (releases?.length > 0) {
						let keys = Object.keys(releases);
						keys.forEach(key => {
							try {
								bookReleases.push({ name: releases[key].name, assetsUrl: vscode.Uri.parse(releases[key].assets_url) });
							}
							catch (error) {
								return reject(error);
							}
						});
					}
					if (bookReleases.length > 0) {
						this.model.releases = bookReleases;
						resolve(bookReleases);
					} else {
						return reject(new Error(loc.msgReleaseNotFound));
					}
				});
			});
		} else {
			return this.model.releases;
		}
	}

	public async getAssets(release?: IRelease): Promise<IAsset[]> {
		if (release) {
			let format: string[] = [];
			if (utils.getOSPlatform() === utils.Platform.Windows || utils.getOSPlatform() === utils.Platform.Mac) {
				format = ['zip'];
			} else {
				format = ['tar.gz', 'tgz'];
			}
			let options = {
				headers: {
					'User-Agent': 'request'
				}
			};
			return new Promise<IAsset[]>((resolve, reject) => {
				request.get(release.assetsUrl.toString(false), options, (error, response, body) => {
					if (error) {
						return reject(error);
					}

					if (response.statusCode !== 200) {
						return reject(new Error(loc.httpRequestError(response.statusCode, response.statusMessage)));
					}
					let assets = JSON.parse(body);
					let githubAssets: IAsset[] = [];
					if (assets) {
						let keys = Object.keys(assets);
						keys.forEach(key => {
							let asset = {} as IAsset;
							asset.url = vscode.Uri.parse(assets[key].url);
							asset.name = assets[key].name;
							asset.browserDownloadUrl = vscode.Uri.parse(assets[key].browser_download_url);
							let groupsRe = asset.name.match(assetNameRE);
							if (groupsRe) {
								asset.book = groupsRe[1];
								asset.version = groupsRe[2];
								asset.language = groupsRe[3];
								asset.format = groupsRe[4];
								if (format.includes(asset.format)) {
									githubAssets.push(asset);
								}
							}
						});
					}
					this.model.assets = githubAssets;
					if (githubAssets.length > 0) {
						resolve(githubAssets);
					}
					return reject(new Error(loc.msgBookNotFound));
				});
			});
		} else {
			return this.model.assets;
		}
	}
}

export interface IRelease {
	name: string;
	assetsUrl: vscode.Uri;
}

export interface IAsset {
	name: string;
	book: string;
	version: string;
	language: string;
	format: string;
	url: vscode.Uri;
	browserDownloadUrl: vscode.Uri;
}
