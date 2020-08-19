/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as request from 'request';
import * as path from 'path';
import * as loc from '../localizedConstants';

const DownloadTimeout = 20000;

export namespace HttpClient {

	/**
	 * Downloads a file from the given URL, resolving to the full path of the downloaded file when complete
	 * @param downloadUrl The URL to download the file from
	 * @param targetFolder The folder to download the file to
	 * @param outputChannel Channel used to display diagnostic information
	 * @returns Full path to the downloaded file
	 */
	export function downloadFile(downloadUrl: string, outputChannel: vscode.OutputChannel, targetFolder: string): Promise<string> {
		return dowload(downloadUrl, outputChannel, targetFolder);
	}

	/**
	 * Downloads a file from the given URL, resolving to the full path of the downloaded file when complete
	 * @param downloadUrl The URL to download the file from
	 * @param targetFolder The folder to download the file to
	 * @param outputChannel Channel used to display diagnostic information
	 * @returns Full path to the downloaded file
	 */
	export async function getFileContents(downloadUrl: string, outputChannel: vscode.OutputChannel): Promise<string> {
		console.log(`downloadUrl`, downloadUrl);
		const fileContents = await dowload(downloadUrl, outputChannel);
		console.log(`TCL::: fileContents`, fileContents);
		return fileContents;
	}

	function dowload(downloadUrl: string, outputChannel: vscode.OutputChannel, targetFolder?: string): Promise<string> {
		return new Promise((resolve, reject) => {
			let totalMegaBytes: number | undefined = undefined;
			let receivedBytes = 0;
			let printThreshold = 0.1;
			let strings: string[] = [];
			let downloadRequest = request.get(downloadUrl, { timeout: DownloadTimeout })
				.on('error', downloadError => {
					console.log(`in downloader's on error callback`);
					console.log(`downloadError: ${downloadError}`);
					outputChannel.appendLine(loc.downloadError);
					outputChannel.appendLine(downloadError?.message ?? downloadError);

					reject(downloadError);
				})
				.on('response', (response) => {
					//					console.log(`in downloader's on response callback`);
					if (response.statusCode !== 200) {
						outputChannel.appendLine(loc.downloadError);
						outputChannel.appendLine(response.statusMessage);
						outputChannel.appendLine(`response code: ${response.statusCode}`);
						return reject(response.statusMessage);
					}
					if (targetFolder !== undefined) {
						const filename = path.basename(response.request.path);
						const targetPath = path.join(targetFolder, filename);
						outputChannel.appendLine(loc.downloadingTo(filename, targetPath));
						// Wait to create the WriteStream until here so we can use the actual
						// filename based off of the URI.
						downloadRequest.pipe(fs.createWriteStream(targetPath))
							.on('close', async () => {
								outputChannel.appendLine(loc.downloadFinished);
								resolve(targetPath);
							})
							.on('error', (downloadError) => {
								reject(downloadError);
								downloadRequest.abort();
							});
					}
					let contentLength = response.headers['content-length'];
					let totalBytes = parseInt(contentLength || '0');
					totalMegaBytes = totalBytes / (1024 * 1024);
					outputChannel.appendLine(loc.downloadingProgressMb('0', totalMegaBytes.toFixed(2)));
				})
				.on('data', (data) => {
					//console.log(`in downloader's on data callback`);
					if (targetFolder === undefined) {
						strings.push(data.toString('utf-8'));
						//						console.log(`in downloader's on data callback: strings.length:${strings.length}`);
					}
					receivedBytes += data.length;
					if (totalMegaBytes) {
						let receivedMegaBytes = receivedBytes / (1024 * 1024);
						let percentage = receivedMegaBytes / totalMegaBytes;
						if (percentage >= printThreshold) {
							outputChannel.appendLine(loc.downloadingProgressMb(receivedMegaBytes.toFixed(2), totalMegaBytes.toFixed(2)));
							printThreshold += 0.1;
						}
					}
				})
				.on('close', async () => {
					console.log(`in downloader's on close callback, targetfolder:${targetFolder}`);
					if (targetFolder === undefined) {
						console.log(`in downloader's on close callback: strings.length:${strings.length}`);
						console.log(`in downloader's on close callback: strings:${JSON.stringify(strings)}`);
						outputChannel.appendLine(loc.downloadFinished);
						const fileContents = strings.join('');
						console.log(`fileContents: ${fileContents}`);
						resolve(fileContents);
					}
				});
		});
	}

	/**
	 * Gets the filename for the specified URL - following redirects as needed
	 * @param url The URL to get the filename of
	 */
	export async function getFilename(url: string, outputChannel: vscode.OutputChannel): Promise<string> {
		outputChannel.appendLine(loc.gettingFilenameOfUrl(url));
		return new Promise((resolve, reject) => {
			let httpRequest = request.get(url, { timeout: DownloadTimeout })
				.on('error', downloadError => {
					reject(downloadError);
				})
				.on('response', (response) => {
					if (response.statusCode !== 200) {
						return reject(response.statusMessage);
					}
					// We don't want to actually download the file so abort the request now
					httpRequest.abort();
					const filename = path.basename(response.request.path);
					outputChannel.appendLine(loc.gotFilenameOfUrl(response.request.path, filename));
					resolve(filename);
				});
		});
	}
}
