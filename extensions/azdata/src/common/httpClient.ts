/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as request from 'request';
import * as loc from '../localizedConstants';

const DownloadTimeout = 20000;

export namespace HttpClient {

	/**
	 * Downloads a file from the given URL
	 * @param downloadUrl The URL to download the file from
	 * @param targetPath The path to download the file to
	 * @param outputChannel Channel used to display diagnostic information
	 */
	export function download(downloadUrl: string, targetPath: string, outputChannel: vscode.OutputChannel): Promise<void> {
		return new Promise((resolve, reject) => {
			let totalMegaBytes: number | undefined = undefined;
			let receivedBytes = 0;
			let printThreshold = 0.1;
			let downloadRequest = request.get(downloadUrl, { timeout: DownloadTimeout })
				.on('error', downloadError => {
					outputChannel.appendLine(loc.downloadError);
					outputChannel.appendLine(downloadError?.message ?? downloadError);
					reject(downloadError);
				})
				.on('response', (response) => {
					if (response.statusCode !== 200) {
						outputChannel.appendLine(loc.downloadError);
						outputChannel.appendLine(response.statusMessage);
						return reject(response.statusMessage);
					}
					let contentLength = response.headers['content-length'];
					let totalBytes = parseInt(contentLength || '0');
					totalMegaBytes = totalBytes / (1024 * 1024);
					outputChannel.appendLine(loc.downloadingProgressMb('0', totalMegaBytes.toFixed(2)));
				})
				.on('data', (data) => {
					receivedBytes += data.length;
					if (totalMegaBytes) {
						let receivedMegaBytes = receivedBytes / (1024 * 1024);
						let percentage = receivedMegaBytes / totalMegaBytes;
						if (percentage >= printThreshold) {
							outputChannel.appendLine(loc.downloadingProgressMb(receivedMegaBytes.toFixed(2), totalMegaBytes.toFixed(2)));
							printThreshold += 0.1;
						}
					}
				});
			downloadRequest.pipe(fs.createWriteStream(targetPath))
				.on('close', async () => {
					outputChannel.appendLine(loc.downloadFinished);
					resolve();
				})
				.on('error', (downloadError) => {
					reject(downloadError);
					downloadRequest.abort();
				});
		});
	}
}
