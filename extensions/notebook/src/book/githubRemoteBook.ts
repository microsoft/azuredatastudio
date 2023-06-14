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
import { RemoteBook } from './remoteBook';
import { IAsset } from './remoteBookController';
import * as constants from '../common/constants';

export class GitHubRemoteBook extends RemoteBook {
	constructor(remotePath: vscode.Uri, outputChannel: vscode.OutputChannel, public readonly asset: IAsset) {
		super(remotePath, outputChannel, asset);
	}

	public async createLocalCopy(): Promise<void> {
		this.outputChannel.show(true);
		this.setLocalPath();
		this.outputChannel.appendLine(loc.msgDownloadLocation(this.localPath.fsPath));
		this.outputChannel.appendLine(loc.msgRemoteBookDownloadProgress);
		await this.createDirectory();
		let notebookConfig = vscode.workspace.getConfiguration(constants.notebookConfigKey);
		let downloadTimeout = notebookConfig[constants.remoteBookDownloadTimeout];

		return new Promise((resolve, reject) => {
			let options = {
				headers: {
					'User-Agent': 'request',
					'timeout': downloadTimeout
				}
			};
			let downloadRequest = request.get(this.asset.browserDownloadUrl.toString(false), options)
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
			let remoteBookFullPath = vscode.Uri.file(this.localPath.fsPath.concat('.', this.asset.format));
			downloadRequest.pipe(fs.createWriteStream(remoteBookFullPath.fsPath))
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
		let fileName = this.asset.book.concat('-').concat(this.asset.version).concat('-').concat(this.asset.language);
		this.localPath = vscode.Uri.file(path.join(this.localPath.fsPath, fileName));
		try {
			let exists = await fs.pathExists(this.localPath.fsPath);
			if (exists) {
				await fs.remove(this.localPath.fsPath);
			}
			await fs.promises.mkdir(this.localPath.fsPath);
		} catch (error) {
			this.outputChannel.appendLine(loc.msgRemoteBookDirectoryError);
			this.outputChannel.appendLine(error.message);
		}
	}
	public async extractFiles(remoteBookFullPath: vscode.Uri): Promise<void> {
		try {
			if (process.platform === constants.winPlatform || process.platform === constants.macPlatform) {
				let zippedFile = new zip(remoteBookFullPath.fsPath);
				zippedFile.extractAllTo(this.localPath.fsPath);
			} else {
				await tar.extract({ file: remoteBookFullPath.fsPath, cwd: this.localPath.fsPath });
			}
			await fs.promises.unlink(remoteBookFullPath.fsPath);
			this.outputChannel.appendLine(loc.msgRemoteBookDownloadComplete);
			void vscode.commands.executeCommand('notebook.command.openNotebookFolder', this.localPath.fsPath, undefined, true);
		}
		catch (err) {
			this.outputChannel.appendLine(loc.msgRemoteBookUnpackingError);
			this.outputChannel.appendLine(err.message);
		}
	}
}
