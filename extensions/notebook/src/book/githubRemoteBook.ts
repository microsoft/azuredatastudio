/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as request from 'request';
import * as fs from 'fs-extra';
import * as loc from '../common/localizedConstants';
import * as vscode from 'vscode';
import * as path from 'path';
import * as zip from 'adm-zip';
import * as tar from 'tar';
import * as utils from '../common/utils';
import { RemoteBook } from './remoteBook';
import { IAsset } from './remoteBookController';
import * as constants from '../common/constants';

export class GitHubRemoteBook extends RemoteBook {
	constructor(public remotePath: URL, public outputChannel: vscode.OutputChannel, protected _asset: IAsset) {
		super(remotePath, outputChannel, _asset);
	}

	public async createLocalCopy(): Promise<void> {
		this.outputChannel.show(true);
		this.setLocalPath();
		this.outputChannel.appendLine(loc.msgDownloadLocation(this.localPath.href));
		this.outputChannel.appendLine(loc.msgRemoteBookDownloadProgress);
		this.createDirectory();
		let notebookConfig = vscode.workspace.getConfiguration(constants.notebookConfigKey);
		let downloadTimeout = notebookConfig[constants.remoteBookDownloadTimeout];

		return new Promise((resolve, reject) => {
			let options = {
				headers: {
					'User-Agent': 'request',
					'timeout': downloadTimeout
				}
			};
			let downloadRequest = request.get(this._asset.browserDownloadUrl.href, options)
				.on('error', (error) => {
					this.outputChannel.appendLine(loc.msgRemoteBookDownloadError);
					this.outputChannel.appendLine(error.message);
					reject(error);
				})
				.on('response', (response) => {
					if (response.statusCode !== 200) {
						this.outputChannel.appendLine(loc.msgRemoteBookDownloadError);
						return reject(new Error(loc.httpRequestError(response.statusCode, response.statusMessage)));
					}
				});
			let remoteBookFullPath = new URL(this.localPath.href.concat('.zip'));
			downloadRequest.pipe(fs.createWriteStream(remoteBookFullPath.href))
				.on('close', async () => {
					resolve(this.extractFiles(remoteBookFullPath));
				})
				.on('error', (error) => {
					this.outputChannel.appendLine(loc.msgRemoteBookDownloadError);
					this.outputChannel.appendLine(error.message);
					reject(error);
					downloadRequest.abort();
				});
		});
	}
	public async createDirectory(): Promise<void> {
		let fileName = this._asset.book.concat('-').concat(this._asset.version).concat('-').concat(this._asset.language);
		this.localPath = new URL(path.join(this.localPath.href, fileName));
		try {
			let exists = await fs.pathExists(this.localPath.href);
			if (exists) {
				await fs.remove(this.localPath.href);
			}
			await fs.promises.mkdir(this.localPath.href);
		} catch (error) {
			this.outputChannel.appendLine(loc.msgRemoteBookDirectoryError);
			this.outputChannel.appendLine(error.message);
		}
	}
	public async extractFiles(remoteBookFullPath: URL): Promise<void> {
		try {
			if (utils.getOSPlatform() === utils.Platform.Windows || utils.getOSPlatform() === utils.Platform.Mac) {
				let zippedFile = new zip(remoteBookFullPath.href);
				zippedFile.extractAllTo(this.localPath.href);
			} else {
				tar.extract({ file: remoteBookFullPath.href, cwd: this.localPath.href }).catch(error => {
					this.outputChannel.appendLine(loc.msgRemoteBookUnpackingError);
					this.outputChannel.appendLine(error.message);
				});
			}
			await fs.promises.unlink(remoteBookFullPath.href);
			this.outputChannel.appendLine(loc.msgRemoteBookDownloadComplete);
			vscode.commands.executeCommand('notebook.command.openNotebookFolder', this.localPath.href, undefined, true);
		}
		catch (err) {
			this.outputChannel.appendLine(err.message);
		}
	}
}
