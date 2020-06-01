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
const msgTaskName = localize('msgTaskName', "Downloading selected Book");

export class RemoteBookController {
	private _book: RemoteBook;
	constructor() {
	}

	public async setRemoteBook(url: URL, remoteLocation: string, zipURL?: URL, tarURL?: URL): Promise<string[]> {
		if (remoteLocation === 'GitHub') {
			this._book = new GitHubRemoteBook(url, zipURL, tarURL);
		} else {
			this._book = new SharedRemoteBook(url);
		}
		return await this._book.createLocalCopy();
	}

	public openRemoteBook(book: string) {
		this._book.openRemoteBook(book);
	}

	public async getReleases(url: URL): Promise<IReleases[]> {
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
					return reject('Resource not found');
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
							release.remote_path = url;
							release.tag_name = releases[key].tag_name;
							release.tarURL = new URL(releases[key].tarball_url);
							release.zipURL = new URL(releases[key].zipball_url);
						}
						catch (error) {
							throw (error);
						}
						bookReleases.push(release);
					});
				}
				resolve(bookReleases);
			});
		});
	}
}

export interface IReleases {
	remote_path: URL;
	tag_name: string;
	zipURL: URL;
	tarURL: URL;
}

export abstract class RemoteBook {
	protected _book_name: string;
	protected _version: string;
	protected _lang_code: string;
	protected _local_path: URL;
	protected _tarURL: URL;
	protected _zipURL: URL;
	protected outputChannel: vscode.OutputChannel;
	protected apiWrapper: ApiWrapper;

	constructor(public remote_path: URL) {
		this.remote_path = remote_path;
		this.apiWrapper = new ApiWrapper();
		this.outputChannel = this.apiWrapper.createOutputChannel(msgTaskName);
	}

	public async abstract createLocalCopy(): Promise<string[]>;

	public openRemoteBook(selectedBook: string) {
		vscode.commands.executeCommand('bookTreeView.openBook', selectedBook, false, undefined);
	}

	public setLocalPath() {
		// Save directory on User directory
		if (vscode.workspace.workspaceFolders !== undefined) {
			// Get workspace root path
			let folders = vscode.workspace.workspaceFolders;
			try {
				this._local_path = new URL(folders[0].uri.fsPath);
			}
			catch (error) {
				throw (error);
			}
		} else {
			//If no workspace folder is opened then path is Users directory
			try {
				this._local_path = new URL(utils.getUserHome());
			}
			catch (error) {
				throw (error);
			}
		}
	}

	public loadBooks(dir: string, books: string[]): string[] {
		fs.readdirSync(dir).forEach(file => {
			let fullPath = path.join(dir, file);
			if (fs.lstatSync(fullPath).isDirectory()) {
				if (isBook(fullPath)) {
					books.push(fullPath);
				}
				return this.loadBooks(fullPath, books);
			}
			return [];
		});
		return books;
	}
}

class SharedRemoteBook extends RemoteBook {
	constructor(public remote_path: URL) {
		super(remote_path);
	}

	public async createLocalCopy(): Promise<string[]> {
		//compress it
		// copy it
		// to local path
		return [];
	}
}

export class GitHubRemoteBook extends RemoteBook {
	constructor(public remote_path: URL, public zipURL: URL, public tarURL: URL) {
		super(remote_path);
		this._zipURL = zipURL;
		this._tarURL = tarURL;
	}

	public async createLocalCopy(): Promise<string[]> {
		this.outputChannel.show(true);
		this.outputChannel.appendLine(msgRemoteBookDownloadProgress);
		return new Promise((resolve, reject) => {
			this.setLocalPath();
			let re = /\//g;
			let fileName = this._zipURL.pathname.substring(1).replace(re, '-').concat('-', utils.generateGuid());
			this._local_path = new URL(path.join(this._local_path.href, fileName));
			fs.mkdir(this._local_path.href, (err) => {
				if (err) {
					this.outputChannel.appendLine(msgRemoteBookDirectoryError);
					return reject(err);
				}

				let options = {
					headers: {
						'User-Agent': 'request'
					},
					timeout: 15000
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
						//unpack python zip/tar file
						this.outputChannel.appendLine(msgRemoteBookDownloadComplete);
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
						let books = this.loadBooks(this._local_path.href, []);
						resolve(books);
					})
					.on('error', (downloadError) => {
						this.outputChannel.appendLine(msgRemoteBookDownloadError);
						reject(downloadError);
						downloadRequest.abort();
					});
			});
		});

	}
}

function isBook(fullPath: string) {
	let contents: string[] = ['content', '_data', '_config.yml'];
	let files = fs.readdirSync(fullPath);
	if (files.includes(contents[0]) && files.includes(contents[1]) && files.includes(contents[2])) {
		return true;
	}
	return false;
}
