/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as request from 'request';
import * as constants from './constants';

const DownloadTimeout = 20000;
const GetTimeout = 10000;
export class HttpClient {

	public async fetch(url: string): Promise<any> {
		return new Promise<any>((resolve, reject) => {
			request.get(url, { timeout: GetTimeout }, (error, response, body) => {
				if (error) {
					return reject(error);
				}

				if (response.statusCode === 404) {
					return reject(constants.resourceNotFoundError);
				}

				if (response.statusCode !== 200) {
					return reject(
						constants.httpGetRequestError(
							response.statusCode,
							response.statusMessage));
				}

				resolve(body);
			});
		});
	}

	public download(downloadUrl: string, targetPath: string, outputChannel: vscode.OutputChannel): Promise<void> {
		return new Promise((resolve, reject) => {

			let totalMegaBytes: number | undefined = undefined;
			let receivedBytes = 0;
			let printThreshold = 0.1;
			let downloadRequest = request.get(downloadUrl, { timeout: DownloadTimeout })
				.on('error', downloadError => {
					outputChannel.appendLine(constants.downloadError);
					reject(downloadError);
				})
				.on('response', (response) => {
					if (response.statusCode !== 200) {
						outputChannel.appendLine(constants.downloadError);
						return reject(response.statusMessage);
					}
					let contentLength = response.headers['content-length'];
					let totalBytes = parseInt(contentLength || '0');
					totalMegaBytes = totalBytes / (1024 * 1024);
					outputChannel.appendLine(`'Downloading' (0 / ${totalMegaBytes.toFixed(2)} MB)`);
				})
				.on('data', (data) => {
					receivedBytes += data.length;
					if (totalMegaBytes) {
						let receivedMegaBytes = receivedBytes / (1024 * 1024);
						let percentage = receivedMegaBytes / totalMegaBytes;
						if (percentage >= printThreshold) {
							outputChannel.appendLine(`${constants.downloadingProgress} (${receivedMegaBytes.toFixed(2)} / ${totalMegaBytes.toFixed(2)} MB)`);
							printThreshold += 0.1;
						}
					}
				});
			downloadRequest.pipe(fs.createWriteStream(targetPath))
				.on('close', async () => {
					resolve();
				})
				.on('error', (downloadError) => {
					reject(downloadError);
					downloadRequest.abort();
				});
		});
	}
}
