/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as request from 'request';
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export class RemoteBookController {
	private _url: string;
	private _book: RemoteBook;
	constructor() {
	}

	public async setRemoteBook(_url: string, _remoteLocation: string): Promise<any> {
		if (_remoteLocation === 'GitHub') {
			_url = 'https://api.github.com/'.concat(_url);
			try {
				let url: URL = new URL(_url);
				if (url) {
					this._book = new GitHubRemoteBook(url);
					return await this._book.loadBookVersions();
				}
			}
			catch (error) {
				throw (error);
			}
		} else {
			this._url = _url;
			this._book = new SharedRemoteBook(new URL(this._url));
		}
		return [];

	}

	public updateBook(book: GitHubRemoteBook): void {
		this._book.zipURL = book.zipURL;
		this._book.tarURL = book.tarURL;
		this._book.version = book.version;
	}

	public async setLocalPath(): Promise<void> {
		// Save directory on User directory
		if (vscode.workspace.workspaceFolders !== undefined) {
			// Get workspace root path
			let folders = vscode.workspace.workspaceFolders;
			try {
				this._book.local_path = new URL(folders[0].uri.fsPath);
			}
			catch (error) {
				throw (error);
			}
		} else {
			//If no workspace folder is opened then path is Users directory
			try {
				this._book.local_path = new URL(os.homedir());
			}
			catch (error) {
				throw (error);
			}
		}

		this._book.createLocalCopy();
	}

	/**
	 * Unzip a .zip or .tar.gz
	 */
	private unzip(archivePath: string, extractDir: string) {
		if (archivePath.endsWith('.zip')) {
			if (process.platform === 'win32') {
				cp.spawnSync('powershell.exe', [
					'-NoProfile',
					'-ExecutionPolicy', 'Bypass',
					'-NonInteractive',
					'-NoLogo',
					'-Command',
					`Microsoft.PowerShell.Archive\\Expand-Archive -Path "${archivePath}" -DestinationPath "${extractDir}"`
				]);
			} else {
				cp.spawnSync('unzip', [archivePath, '-d', `${extractDir}`]);
			}
		} else {
			// tar does not create extractDir by default
			if (!fs.existsSync(extractDir)) {
				fs.mkdirSync(extractDir);
			}
			cp.spawnSync('tar', ['-xzf', archivePath, '-C', extractDir, '--strip-components', '1']);
		}
	}
}

export interface IRemoteBook {
	remote_path: URL;
	book_name?: string;
	version?: string;
	lang_code?: string;
	local_path?: URL;
	zipURL?: URL;
	tarURL?: URL;
}

export abstract class RemoteBook implements IRemoteBook {
	constructor(public remote_path: URL) {
		this.remote_path = remote_path;
	}

	public abstract createLocalCopy(): void;

	public abstract async loadBookVersions(): Promise<RemoteBook[]>;

	public abstract loadDirectoryContents(): void;

	public openRemoteBook() {
		vscode.commands.executeCommand('bookTreeView.openBook', path.join(this.local_path.href, this.version), false, undefined);
	}

	public set book_name(value: string) {
		this.book_name = value;
	}

	public set version(value: string) {
		this.version = value;
	}

	public set lang_code(value: string) {
		this.lang_code = value;
	}

	public set local_path(value: URL) {
		this.local_path = value;
	}
	public set zipURL(value: URL) {
		this.zipURL = value;
	}

	public set tarURL(value: URL) {
		this.tarURL = value;
	}

	public get book_name() {
		return this.book_name;
	}

	public get version() {
		return this.version;
	}

	public get lang_code() {
		return this.lang_code;
	}

	public get local_path() {
		return this.local_path;
	}
	public get tarURL() {
		return this.tarURL;
	}

	public get zipURL() {
		return this.zipURL;
	}
}

class SharedRemoteBook extends RemoteBook implements IRemoteBook {
	constructor(public remote_path: URL) {
		super(remote_path);
	}

	public createLocalCopy() {
		//compress it
		// copy it
		// to local path
	}


	public async loadBookVersions(): Promise<RemoteBook[]> {
		throw new Error('Not Implemented');
	}

	public loadDirectoryContents(): void {
	}

}

export class GitHubRemoteBook extends RemoteBook implements IRemoteBook {
	constructor(public remote_path: URL) {
		super(remote_path);
	}

	public async loadBookVersions(): Promise<GitHubRemoteBook[]> {
		let options = {
			headers: {
				'User-Agent': 'request'
			}
		};
		return new Promise<GitHubRemoteBook[]>((resolve, reject) => {
			request.get(this.remote_path.href, options, (error, response, body) => {
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
				let bookReleases: GitHubRemoteBook[] = [];
				if (releases) {
					let keys = Object.keys(releases);
					keys = keys.filter(key => {
						let release = {} as GitHubRemoteBook;
						try {
							release.version = releases[key].tag_name;
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

	public createLocalCopy() {
		// Downloading..
		if (process.platform === 'win32') {
			cp.spawnSync('powershell.exe', [
				'-NoProfile',
				'-ExecutionPolicy', 'Bypass',
				'-NonInteractive',
				'-NoLogo',
				'-Command',
				`Invoke-WebRequest -OutFile ${path.join(this.local_path.href, this.version)} ${this.zipURL.href}`
			]);
		} else if (process.platform === 'darwin') {
			cp.spawnSync(`curl -o ${path.join(this.local_path.href, this.version)} ${this.zipURL.href}`);
		} else {
			cp.spawnSync(`curl ${this.zipURL.href} | tar -xz -C ${path.join(this.local_path.href, this.version)} `);
		}

	}

	public loadDirectoryContents(): void {

	}
}
