/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { setup as setupQueryEditorTests, setupWeb as setupQueryEditorWebTests } from './areas/queryEditor/queryEditor.test';
import { setup as setupNotebookTests } from './areas/notebook/notebook.test';
import { setup as setupNotebookViewTests } from './areas/notebook/notebookView.test';
import { setup as setupImportTests } from './areas/import/import.test';
import { setup as setupCreateBookDialogTests } from './areas/notebook/createBook.test';
import { setup as setupAddRemoteBookDialogTests } from './areas/notebook/addRemoteBook.test';
import { ApplicationOptions } from '../../../automation';
import * as yazl from 'yauzl';
import * as fs from 'fs';
import * as path from 'path';
import { request } from 'https';
import * as mkdirp from 'mkdirp';
import * as minimist from 'minimist';

export function main(opts: minimist.ParsedArgs): void {
	if (opts.web) {
		setupQueryEditorWebTests(opts);
		setupNotebookViewTests(opts);
		setupAddRemoteBookDialogTests(opts);
	} else {
		setupQueryEditorTests(opts);
		setupNotebookTests(opts);
		setupNotebookViewTests(opts);
		setupCreateBookDialogTests(opts);
		setupAddRemoteBookDialogTests(opts);
		setupImportTests(opts);
	}
}

/* eslint-disable no-sync */
/* eslint-disable no-console */
const PLATFORM = '${PLATFORM}';
const RUNTIME = '${RUNTIME}';
const VERSION = '${VERSION}';
const RELEASE_VERSION = '${RELEASE_VERSION}';

const sqliteUrl = `https://github.com/Microsoft/azuredatastudio-sqlite/releases/download/${RELEASE_VERSION}/azuredatastudio-sqlite-${PLATFORM}-${RUNTIME}-${VERSION}.zip`;

export async function setup(app: ApplicationOptions): Promise<void> {
	console.log('*** Downloading test extensions');
	const releaseVersion = '1.7.0';
	const requestUrl = sqliteUrl.replace(RELEASE_VERSION, releaseVersion).replace(PLATFORM, process.platform).replace(RUNTIME, getRuntime(app.web || app.remote || false)).replace(VERSION, getVersion(app.web || app.remote || false));
	const zip = await fetch(requestUrl);
	if (!zip) {
		throw new Error('Could not get extension for current platform');
	}
	return new Promise<void>((resolve, reject) => {
		yazl.fromBuffer(zip, (e, zipFile) => {
			if (e || !zipFile) {
				reject(e);
				return;
			}

			zipFile.on('entry', (entry: yazl.Entry) => {
				if (/\/$/.test(entry.fileName)) {
					return;
				}
				zipFile.openReadStream(entry, (err, readStream) => {
					if (err || !readStream) {
						reject(err);
						return;
					}
					const destination = path.join(app.extensionsPath, 'azuredatastudio-sqlite', entry.fileName);
					if (fs.existsSync(path.dirname(destination))) {
						readStream.pipe(fs.createWriteStream(destination));
						return;
					}

					mkdirp.sync(path.dirname(destination));
					readStream.pipe(fs.createWriteStream(destination));
				});
			}).once('end', () => resolve());
		});
	});
}

const root = path.dirname(path.dirname(path.dirname(path.dirname(__dirname))));

function getRuntime(remote: boolean) {
	// eslint-disable-next-line no-sync
	const yarnrc = fs.readFileSync(remote ? path.join(root, 'remote', '.yarnrc') : path.join(root, '.yarnrc'), 'utf8');
	const runtime = /^runtime "(.*)"$/m.exec(yarnrc)![1];
	return runtime;
}

function getVersion(remote: boolean) {
	// eslint-disable-next-line no-sync
	const yarnrc = fs.readFileSync(remote ? path.join(root, 'remote', '.yarnrc') : path.join(root, '.yarnrc'), 'utf8');
	const target = /^target "(.*)"$/m.exec(yarnrc)![1];
	return target;
}

function fetch(url: string): Promise<Buffer | undefined> {
	return new Promise<Buffer | undefined>((resolve, reject) => {
		const buffers: Buffer[] = [];
		const req = request(url, res => {
			if (res.headers.location) {
				resolve(fetch(res.headers.location));
			} else if (res.statusCode === 404) {
				reject(`${url}: ${res.statusMessage}`);
			} else {
				res.on('data', chunk => buffers.push(chunk));
				res.on('end', () => {
					if (buffers.length > 0) {
						resolve(Buffer.concat(buffers));
					} else {
						resolve(undefined);
					}
				});
				res.on('error', e => reject(e));
			}
		});

		req.end();
	});
}
