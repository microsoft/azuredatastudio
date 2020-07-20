/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as request from 'request';
import * as loc from '../common/localizedConstants';
import * as utils from '../common/utils';
import { RemoteBookDialogModel } from '../dialog/remoteBookDialog';
import { GitHubRemoteBook } from '../book/githubRemoteBook';
import { SharedRemoteBook } from '../book/sharedRemoteBook';

const assetNameRE = /([a-zA-Z0-9]+)(?:-|_)([a-zA-Z0-9.]+)(?:-|_)([a-zA-Z0-9]+).(zip|tar.gz|tgz)/;

export class RemoteBookController {
	constructor(public model: RemoteBookDialogModel) {
	}

	public async setRemoteBook(url: URL, remoteLocation: string, asset?: IAsset): Promise<void> {
		if (remoteLocation === 'GitHub') {
			this.model.remoteBook = new GitHubRemoteBook(url, asset);
		} else {
			this.model.remoteBook = new SharedRemoteBook(url);
		}
		return await this.model.remoteBook.createLocalCopy();
	}

	public async getReleases(url?: URL): Promise<IRelease[]> {
		if (this.model.releases) {
			return new Promise<IRelease[]>((resolve, reject) => {
				resolve(this.model.releases);
			});
		} else {
			let options = {
				headers: {
					'User-Agent': 'request'
				}
			};
			return new Promise<IRelease[]>((resolve, reject) => {
				request.get(url.href, options, (error, response, body) => {
					if (error) {
						return reject(error);
					}

					if (response.statusCode !== 200) {
						return reject(loc.httpRequestError(response.statusCode, response.statusMessage));
					}

					let releases = JSON.parse(body);
					let bookReleases: IRelease[] = [];
					if (releases?.length > 0) {
						let keys = Object.keys(releases);
						keys.forEach(key => {
							try {
								bookReleases.push({ name: releases[key].name, assetsUrl: new URL(releases[key].assets_url) });
							}
							catch (error) {
								return reject(error);
							}
						});
					}
					this.model.releases = bookReleases;
					if (bookReleases.length > 0) {
						resolve(bookReleases);
					} else {
						return reject(loc.msgReleaseNotFound);
					}
				});
			});
		}
	}

	public async getAssets(release?: IRelease): Promise<IAsset[]> {
		if (this.model.assets) {
			return new Promise<IAsset[]>((resolve, reject) => {
				resolve(this.model.assets);
			});
		} else {
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
				request.get(release.assetsUrl.href, options, (error, response, body) => {
					if (error) {
						return reject(error);
					}

					if (response.statusCode !== 200) {
						return reject(loc.httpRequestError(response.statusCode, response.statusMessage));
					}
					let assets = JSON.parse(body);
					let githubAssets: IAsset[] = [];
					if (assets) {
						let keys = Object.keys(assets);
						keys.forEach(key => {
							let asset = {} as IAsset;
							asset.url = new URL(assets[key].url);
							asset.name = assets[key].name;
							asset.browserDownloadUrl = new URL(assets[key].browser_download_url);
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
					return reject(loc.msgBookNotFound);
				});
			});
		}
	}
}

export interface IRelease {
	name: string;
	assetsUrl: URL;
}

export interface IAsset {
	name: string;
	book: string;
	version: string;
	language: string;
	format: string;
	url: URL;
	browserDownloadUrl: URL;
}
