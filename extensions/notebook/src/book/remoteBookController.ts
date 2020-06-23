/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as request from 'request';
import * as fs from 'fs';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as path from 'path';
import * as zip from 'adm-zip';
import * as tar from 'tar';
import { ApiWrapper } from '../common/apiWrapper';
import * as utils from '../common/utils';

const localize = nls.loadMessageBundle();
const msgRemoteBookDownloadProgress = localize('msgRemoteBookDownloadProgress', "Remote Book download is in progress");
const msgRemoteBookDownloadComplete = localize('msgRemoteBookDownloadComplete', "Remote Book download is complete");
const msgRemoteBookDownloadError = localize('msgRemoteBookDownloadError', "Error while downloading remote Book");
const msgRemoteBookUnpackingError = localize('msgRemoteBookUnpackingError', "Error while decompressing remote Book");
const msgRemoteBookDirectoryError = localize('msgRemoteBookDirectoryError', "Error while creating remote book directory");
const msgTaskName = localize('msgTaskName', "Downloading Remote Book");

const msgResourceNotFound = localize('msgResourceNotFound', 'Resource not Found');
const msgBookNotFound = localize('msgBookNotFound', 'Books not Found');

export class RemoteBookController {
	private _book: RemoteBook;
	constructor(public apiWrapper: ApiWrapper) {
	}

	public async setRemoteBook(url: URL, remoteLocation: string, asset?: IAssets): Promise<void> {
		if (remoteLocation === 'GitHub') {
			this._book = new GitHubRemoteBook(this.apiWrapper, url, asset.zip_url, asset.tar_url);
		} else {
			this._book = new SharedRemoteBook(this.apiWrapper, url);
		}
		return await this._book.createLocalCopy();
	}
}

export interface IReleases {
	name: string;
	assets_url: URL;
}

export interface IAssets {
	name: string;
	book: string;
	version: string;
	language: string;
	url: URL;
	browser_download_url: URL;
	zip_url?: URL;
	tar_url?: URL;
}

export abstract class RemoteBook {
	protected _book_name: string;
	protected _version: string;
	protected _lang_code: string;
	protected _local_path: URL;
	protected outputChannel: vscode.OutputChannel;

	constructor(public apiWrapper: ApiWrapper, public remote_path: URL, protected _zipURL?: URL, protected _tarURL?: URL) {
		this.remote_path = remote_path;
		this.outputChannel = apiWrapper.createOutputChannel(msgTaskName);
	}

	public async abstract createLocalCopy(): Promise<void>;

	public setLocalPath() {
		// Save directory on User directory
		if (vscode.workspace.workspaceFolders !== undefined) {
			// Get workspace root path
			let folders = vscode.workspace.workspaceFolders;
			this._local_path = new URL(folders[0].uri.fsPath);
		} else {
			//If no workspace folder is opened then path is Users directory
			this._local_path = new URL(utils.getUserHome());
		}
	}
}

class SharedRemoteBook extends RemoteBook {
	constructor(public apiWrapper: ApiWrapper, public remote_path: URL) {
		super(apiWrapper, remote_path);
	}

	// TODO: Not yet supported
	public async createLocalCopy(): Promise<void> {
		throw new Error('Not yet supported');
	}
}

export class GitHubRemoteBook extends RemoteBook {
	static readonly assetNameRE = /([a-zA-Z0-9]+)(?:-|_)([a-zA-Z0-9.]+)(?:-|_)([a-zA-Z0-9]+).(zip|tar.gz)/g;
	readonly re = /\//g;

	constructor(public apiWrapper: ApiWrapper, public remote_path: URL, protected _zipURL: URL, protected _tarURL: URL) {
		super(apiWrapper, remote_path, _zipURL, _tarURL);
	}

	public async createLocalCopy(): Promise<void> {
		this.outputChannel.show(true);
		this.outputChannel.appendLine(msgRemoteBookDownloadProgress);
		this.setLocalPath();
		let fileName = this._zipURL.pathname.substring(1).replace(this.re, '-').concat('-', utils.generateGuid());
		this._local_path = new URL(path.join(this._local_path.href, fileName));

		return new Promise((resolve, reject) => {
			fs.mkdir(this._local_path.href, (err) => {
				if (err) {
					this.outputChannel.appendLine(msgRemoteBookDirectoryError);
					return reject(err);
				}

				let options = {
					headers: {
						'User-Agent': 'request'
					},
					timeout: 800
				};
				let downloadRequest = request.get(this._zipURL.href, options)
					.on('error', (downloadError) => {
						this.outputChannel.appendLine(msgRemoteBookDownloadError);
						reject(downloadError);
					})
					.on('response', (response) => {
						if (response.statusCode !== 200) {
							this.outputChannel.appendLine(msgRemoteBookDownloadError);
							return reject(response.statusMessage);
						}
					});
				let remoteBookFullPath = new URL(this._local_path.href.concat('.zip'));
				downloadRequest.pipe(fs.createWriteStream(remoteBookFullPath.href))
					.on('close', async () => {
						if (utils.getOSPlatform() === utils.Platform.Windows || utils.getOSPlatform() === utils.Platform.Mac) {
							try {
								let zippedFile = new zip(remoteBookFullPath.href);
								zippedFile.extractAllTo(this._local_path.href);
							} catch (err) {
								this.outputChannel.appendLine(msgRemoteBookDownloadError);
								reject(err);
							}
							// Delete zip file
							fs.unlink(remoteBookFullPath.href, (err) => {
								if (err) {
									this.outputChannel.appendLine(msgRemoteBookUnpackingError);
									reject(err);
								}
							});
							this.outputChannel.appendLine(msgRemoteBookDownloadComplete);

						} else {
							tar.extract({ file: remoteBookFullPath.href, cwd: this._local_path.href }).then(() => {
								// Delete tar file
								fs.unlink(remoteBookFullPath.href, (err) => {
									if (err) {
										this.outputChannel.appendLine(msgRemoteBookUnpackingError);
										reject(err);
									}
								});
								this.outputChannel.appendLine(msgRemoteBookDownloadComplete);
							}).catch(err => {
								this.outputChannel.appendLine(msgRemoteBookUnpackingError);
								reject(err);
							});
						}
						//vscode.commands.executeCommand('notebook.command.openNotebookFolder', 'C:\\Users\\bavaldez\\dev\\SQLNewHireOnboarding\\SQLNewHireOnboarding\\Aris');
						vscode.commands.executeCommand('notebook.command.openNotebookFolder', this._local_path.href);
						resolve();
					})
					.on('error', (downloadError) => {
						this.outputChannel.appendLine(msgRemoteBookDownloadError);
						reject(downloadError);
						downloadRequest.abort();
					});
			});
		});
	}

	public static async getReleases(url: URL): Promise<IReleases[]> {
		let options = {
			headers: {
				'User-Agent': 'request'
			}
		};
		return new Promise<IReleases[]>((resolve, reject) => {
			request.get(url.href, options, (error, response, body) => {
				if (error) {
					return reject(error);
				}

				if (response.statusCode === 404) {
					return reject(msgResourceNotFound);
				}

				if (response.statusCode !== 200) {
					return reject(response.statusCode);
				}
				let releases = JSON.parse(body);
				let bookReleases: IReleases[] = [];
				if (releases) {
					let keys = Object.keys(releases);
					keys = keys.filter(key => {
						let release = {} as IReleases;
						try {
							release.name = releases[key].name;
							release.assets_url = new URL(releases[key].assets_url);
						}
						catch (error) {
						}
						bookReleases.push(release);
					});
				}
				resolve(bookReleases);
			});
		});
	}

	public static async getListAssets(release: IReleases): Promise<IAssets[]> {
		let options = {
			headers: {
				'User-Agent': 'request'
			}
		};
		return new Promise<IAssets[]>((resolve, reject) => {
			request.get(release.assets_url.href, options, (error, response, body) => {
				if (error) {
					return reject(error);
				}

				if (response.statusCode === 404) {
					return reject(msgResourceNotFound);
				}

				if (response.statusCode !== 200) {
					return reject(response.statusCode);
				}
				let assets = JSON.parse(body);
				let githubAssets: IAssets[] = [];
				if (assets) {
					let keys = Object.keys(assets);
					keys = keys.filter(key => {
						let asset = {} as IAssets;
						asset.url = new URL(assets[key].url);
						asset.name = assets[key].name;
						asset.browser_download_url = new URL(assets[key].browser_download_url);
						let groupsRe = asset.name.match(this.assetNameRE);
						if (groupsRe !== null) {
							asset.book = groupsRe[0];
							asset.version = groupsRe[1];
							asset.language = groupsRe[2];
							githubAssets.push(asset);
						}
					});
				}
				if (githubAssets.length > 0) {
					resolve(githubAssets);
				}
				return reject(msgBookNotFound);
			});
		});
	}
}
