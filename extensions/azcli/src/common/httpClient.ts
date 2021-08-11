/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as request from 'request';
import * as path from 'path';
import * as loc from '../localizedConstants';
import Logger from './logger';

const DownloadTimeout = 20000;

export namespace HttpClient {

	/**
	 * Downloads a file from the given URL, resolving to the full path of the downloaded file when complete
	 * @param downloadUrl The URL to download the file from
	 * @param targetFolder The folder to download the file to
	 * @returns a promise to a full path to the downloaded file
	 */
	export function downloadFile(downloadUrl: string, targetFolder: string): Promise<string> {
		return download(downloadUrl, targetFolder);
	}

	/**
	 * Downloads the text contents of the document at the given URL, resolving to a string containing the text when complete
	 * @param url The URL of the document whose contents need to be fetched
	 * @returns a promise to a string that has the contents of document at the provided url
	 */
	export async function getTextContent(url: string): Promise<string> {
		Logger.log(loc.gettingTextContentsOfUrl(url));
		return await download(url);
	}

	/**
	 * Gets a file/fileContents at the given URL.
	 * @param downloadUrl The URL to download the file from
	 * @param targetFolder The folder to download the file to. If not defined then return value is the contents of the downloaded file.
	 * @returns Full path to the downloaded file or the contents of the file at the given downloadUrl
	 */
	function download(downloadUrl: string, targetFolder?: string): Promise<string> {
		return new Promise((resolve, reject) => {
			let totalMegaBytes: number | undefined = undefined;
			let receivedBytes = 0;
			let printThreshold = 0.1;
			let strings: string[] = [];
			let downloadRequest = request.get(downloadUrl, { timeout: DownloadTimeout })
				.on('error', downloadError => {
					Logger.log(loc.downloadError);
					Logger.log(downloadError?.message ?? downloadError);
					reject(downloadError);
				})
				.on('response', (response) => {
					if (response.statusCode !== 200) {
						Logger.log(loc.downloadError);
						Logger.log(response.statusMessage);
						Logger.log(`response code: ${response.statusCode}`);
						return reject(response.statusMessage);
					}
					if (targetFolder !== undefined) {
						const filename = path.basename(response.request.path);
						const targetPath = path.join(targetFolder, filename);
						Logger.log(loc.downloadingTo(filename, downloadUrl, targetPath));
						// Wait to create the WriteStream until here so we can use the actual
						// filename based off of the URI.
						downloadRequest.pipe(fs.createWriteStream(targetPath))
							.on('close', async () => {
								Logger.log(loc.downloadFinished);
								resolve(targetPath);
							})
							.on('error', (downloadError) => {
								reject(downloadError);
								downloadRequest.abort();
							});
					} else {
						response.on('end', () => {
							Logger.log(loc.downloadFinished);
							resolve(strings.join(''));
						});
					}
					let contentLength = response.headers['content-length'];
					let totalBytes = parseInt(contentLength || '0');
					totalMegaBytes = totalBytes / (1024 * 1024);
					Logger.log(loc.downloadingProgressMb('0', totalMegaBytes.toFixed(2)));
				})
				.on('data', (data) => {
					if (targetFolder === undefined) {
						strings.push(data.toString('utf-8'));
					}
					receivedBytes += data.length;
					if (totalMegaBytes) {
						let receivedMegaBytes = receivedBytes / (1024 * 1024);
						let percentage = receivedMegaBytes / totalMegaBytes;
						if (percentage >= printThreshold) {
							Logger.log(loc.downloadingProgressMb(receivedMegaBytes.toFixed(2), totalMegaBytes.toFixed(2)));
							printThreshold += 0.1;
						}
					}
				});
		});
	}
}
