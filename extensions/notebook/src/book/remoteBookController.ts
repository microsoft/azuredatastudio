/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as request from 'request';
import * as fs from 'fs';
import * as loc from '../common/localizedConstants';
import * as vscode from 'vscode';
import * as path from 'path';
import * as zip from 'adm-zip';
import * as tar from 'tar';
import * as utils from '../common/utils';
import { RemoteBookDialogModel } from '../dialog/remoteBookDialog';

const assetNameRE = /([a-zA-Z0-9]+)(?:-|_)([a-zA-Z0-9.]+)(?:-|_)([a-zA-Z0-9]+).(zip|tar.gz|tgz)/;

export class RemoteBookController {
	private _book: RemoteBook;
	constructor(public model: RemoteBookDialogModel) {
	}

	public async setRemoteBook(url: URL, remoteLocation: string, asset?: IAsset): Promise<void> {
		if (remoteLocation === 'GitHub') {
			this._book = new GitHubRemoteBook(url, asset.browserDownloadUrl);
		} else {
			this._book = new SharedRemoteBook(url);
		}
		return await this._book.createLocalCopy();
	}

	public async fetchGithubReleases(url: URL): Promise<IRelease[]> {
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
				if (releases !== undefined && releases.length > 0) {
					let keys = Object.keys(releases);
					keys = keys.filter(key => {
						let release = {} as IRelease;
						try {
							release.name = releases[key].name;
							release.assetsUrl = new URL(releases[key].assets_url);
						}
						catch (error) {
							return reject(error);
						}
						bookReleases.push(release);
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

	public async fecthListAssets(release: IRelease): Promise<IAsset[]> {
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
					keys = keys.filter(key => {
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
				if (githubAssets.length > 0) {
					this.model.assets = githubAssets;
					resolve(githubAssets);
				}
				return reject(loc.msgBookNotFound);
			});
		});
	}

	public getReleases(): IRelease[] {
		return this.model.releases;
	}

	public getAssets(): IAsset[] {
		return this.model.assets;
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

export abstract class RemoteBook {
	protected _localPath: URL;
	protected outputChannel: vscode.OutputChannel;

	constructor(public remotePath: URL, protected _assetURL?: URL) {
		this.remotePath = remotePath;
		this.outputChannel = vscode.window.createOutputChannel(loc.msgTaskName);
	}

	public async abstract createLocalCopy(): Promise<void>;

	public setLocalPath(): void {
		// Save directory on User directory
		if (vscode.workspace.workspaceFolders !== undefined) {
			// Get workspace root path
			let folders = vscode.workspace.workspaceFolders;
			this._localPath = new URL(folders[0].uri.fsPath);
		} else {
			//If no workspace folder is opened then path is Users directory
			this._localPath = new URL(utils.getUserHome());
		}
	}
}

class SharedRemoteBook extends RemoteBook {
	constructor(public remotePath: URL) {
		super(remotePath);
	}

	// TODO: Not yet supported
	public async createLocalCopy(): Promise<void> {
		throw new Error('Not yet supported');
	}
}

export class GitHubRemoteBook extends RemoteBook {
	readonly re = /\//g;

	constructor(public remotePath: URL, protected _assetUrl: URL) {
		super(remotePath, _assetUrl);
	}

	public async createLocalCopy(): Promise<void> {
		this.outputChannel.show(true);
		this.outputChannel.appendLine(loc.msgRemoteBookDownloadProgress);
		this.setLocalPath();
		let fileName = this._assetUrl.pathname.substring(1).replace(this.re, '-').concat('-', utils.generateGuid());
		this._localPath = new URL(path.join(this._localPath.href, fileName));

		return new Promise((resolve, reject) => {
			fs.mkdir(this._localPath.href, (err) => {
				if (err) {
					this.outputChannel.appendLine(loc.msgRemoteBookDirectoryError);
					return reject(err);
				}

				let options = {
					headers: {
						'User-Agent': 'request'
					},
					timeout: 800
				};
				let downloadRequest = request.get(this._assetUrl.href, options)
					.on('error', (downloadError) => {
						this.outputChannel.appendLine(loc.msgRemoteBookDownloadError);
						reject(downloadError);
					})
					.on('response', (response) => {
						if (response.statusCode !== 200) {
							this.outputChannel.appendLine(loc.msgRemoteBookDownloadError);
							return reject(response.statusMessage);
						}
					});
				let remoteBookFullPath = new URL(this._localPath.href.concat('.zip'));
				downloadRequest.pipe(fs.createWriteStream(remoteBookFullPath.href))
					.on('close', async () => {
						resolve(this.extractFiles(remoteBookFullPath));
					})
					.on('error', (downloadError) => {
						this.outputChannel.appendLine(loc.msgRemoteBookDownloadError);
						reject(downloadError);
						downloadRequest.abort();
					});
			});
		});
	}

	public extractFiles(remoteBookFullPath: URL): void {
		if (utils.getOSPlatform() === utils.Platform.Windows || utils.getOSPlatform() === utils.Platform.Mac) {
			try {
				let zippedFile = new zip(remoteBookFullPath.href);
				zippedFile.extractAllTo(this._localPath.href);
			} catch (err) {
				this.outputChannel.appendLine(loc.msgRemoteBookUnpackingError);
			}
			// Delete zip file
			fs.unlink(remoteBookFullPath.href, (err) => {
				if (err) {
					this.outputChannel.appendLine(loc.msgRemoteBookUnpackingError);
				}
			});
			this.outputChannel.appendLine(loc.msgRemoteBookDownloadComplete);

		} else {
			tar.extract({ file: remoteBookFullPath.href, cwd: this._localPath.href }).then(() => {
				// Delete tar file
				fs.unlink(remoteBookFullPath.href, (err) => {
					if (err) {
						this.outputChannel.appendLine(loc.msgRemoteBookUnpackingError);
					}
				});
				this.outputChannel.appendLine(loc.msgRemoteBookDownloadComplete);
			}).catch(err => {
				this.outputChannel.appendLine(loc.msgRemoteBookUnpackingError);
			});
		}
		vscode.commands.executeCommand('notebook.command.openNotebookFolder', this._localPath.href);
	}
}
