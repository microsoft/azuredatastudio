/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as request from 'request';
// import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export class RemoteBookController {
	private _book: RemoteBook;
	constructor() {
	}

	public async setRemoteBook(url: URL, remoteLocation: string, zipURL?: URL, tarURL?: URL): Promise<boolean> {
		if (remoteLocation === 'GitHub') {
			this._book = new GitHubRemoteBook(url, zipURL, tarURL);
		} else {
			this._book = new SharedRemoteBook(url);
		}
		return this._book.createLocalCopy();
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

	public setLocalPath(): void {
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
	}

	/**
	 * Unzip a .zip or .tar.gz
	 */
	// private unzip(archivePath: string, extractDir: string) {
	// 	if (archivePath.endsWith('.zip')) {
	// 		if (process.platform === 'win32') {
	// 			cp.spawnSync('powershell.exe', [
	// 				'-NoProfile',
	// 				'-ExecutionPolicy', 'Bypass',
	// 				'-NonInteractive',
	// 				'-NoLogo',
	// 				'-Command',
	// 				`Microsoft.PowerShell.Archive\\Expand-Archive -Path "${archivePath}" -DestinationPath "${extractDir}"`
	// 			]);
	// 		} else {
	// 			cp.spawnSync('unzip', [archivePath, '-d', `${extractDir}`]);
	// 		}
	// 	} else {
	// 		// tar does not create extractDir by default
	// 		if (!fs.existsSync(extractDir)) {
	// 			fs.mkdirSync(extractDir);
	// 		}
	// 		cp.spawnSync('tar', ['-xzf', archivePath, '-C', extractDir, '--strip-components', '1']);
	// 	}
	// }
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
export interface IReleases {
	remote_path: URL;
	tag_name: string;
	zipURL: URL;
	tarURL: URL;
}

export abstract class RemoteBook implements IRemoteBook {
	private _book_name: string;
	private _version: string;
	private _lang_code: string;
	private _local_path: URL;
	private _tarURL: URL;
	private _zipURL: URL;

	constructor(public remote_path: URL) {
		this.remote_path = remote_path;
	}

	public async abstract createLocalCopy(): Promise<boolean>;

	public abstract loadDirectoryContents(): void;

	public openRemoteBook() {
		vscode.commands.executeCommand('bookTreeView.openBook', path.join(this.local_path.href, this.version), false, undefined);
	}

	public set book_name(value: string) {
		this._book_name = value;
	}

	public set version(value: string) {
		this._version = value;
	}

	public set lang_code(value: string) {
		this._lang_code = value;
	}

	public set local_path(value: URL) {
		this._local_path = value;
	}
	public set zipURL(value: URL) {
		this._zipURL = value;
	}
	public set tarURL(value: URL) {
		this._tarURL = value;
	}

	public get book_name() {
		return this._book_name;
	}

	public get version() {
		return this._version;
	}

	public get lang_code() {
		return this._lang_code;
	}

	public get local_path() {
		return this._local_path;
	}

	public get tarURL() {
		return this._tarURL;
	}

	public get zipURL() {
		return this._zipURL;
	}
}

class SharedRemoteBook extends RemoteBook implements IRemoteBook {
	constructor(public remote_path: URL) {
		super(remote_path);
	}

	public async createLocalCopy(): Promise<boolean> {
		//compress it
		// copy it
		// to local path
		return true;
	}

	public loadDirectoryContents(): void {
	}

}

export class GitHubRemoteBook extends RemoteBook implements IRemoteBook {
	constructor(public remote_path: URL, public zipURL: URL, public tarURL: URL) {
		super(remote_path);
	}

	public async createLocalCopy(): Promise<boolean> {
		let cmd;
		return new Promise<boolean>((resolve, reject) => {
			if (process.platform === 'win32') {

				cmd = cp.spawn('powershell.exe', [
					'-NoProfile',
					'-ExecutionPolicy', 'Bypass',
					'-NonInteractive',
					'-NoLogo',
					'-Command',
					`Invoke-WebRequest -OutFile ${path.join(this.local_path.href, this.version)} ${this.zipURL.href}`
				]);

			} else if (process.platform === 'darwin') {
				cmd = cp.spawn(`curl -o ${path.join(this.local_path.href, this.version)} ${this.zipURL.href}`);
			} else {
				cmd = cp.spawn(`curl ${this.tarURL.href} | tar -xz -C ${path.join(this.local_path.href, this.version)} `);
			}
			cmd.on('exit', function (code) {
				console.log(`Child exited with code ${code}`);
				return true;
			});

			cmd.on('error', function (error) {
				throw (error);
			});
		});
	}

	public loadDirectoryContents(): void {

	}
}
