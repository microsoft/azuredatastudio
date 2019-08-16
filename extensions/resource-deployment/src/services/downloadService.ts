/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as os from 'os';

export interface IDownloadService {
	download(url: string): Promise<string>;
}

export class DownloadService implements IDownloadService {
	download(url: string): Promise<string> {
		const self = this;
		const promise = new Promise<string>((resolve, reject) => {
			https.get(url, function (response) {
				if (response.statusCode === 301 || response.statusCode === 302) {
					// Redirect and download from new location
					self.download(response.headers.location!).then((result) => {
						resolve(result);
					}, (err) => {
						reject(err);
					});
					return;
				}
				if (response.statusCode !== 200) {
					reject('Response status was ' + response.statusCode);
					return;
				}
				const extension = path.extname(url);
				let fileName = path.basename(url, extension);
				const downloadFolder = path.join(os.homedir(), 'Downloads');
				let cnt = 1;
				while (fs.existsSync(path.join(downloadFolder, fileName + extension))) {
					fileName = `${fileName}-${cnt}`;
					cnt++;
				}
				fileName = path.join(downloadFolder, fileName + extension);
				const file = fs.createWriteStream(fileName);
				response.pipe(file);
				file.on('finish', () => {
					file.close();
					resolve(fileName);
				});
				file.on('error', (err) => {
					fs.unlink(fileName, () => { });
					reject(err.message);
				});
			});
		});
		return promise;
	}
}
