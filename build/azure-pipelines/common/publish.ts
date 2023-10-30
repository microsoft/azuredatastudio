/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs';
import { Readable } from 'stream';
import * as crypto from 'crypto';
import * as mime from 'mime';
import * as minimist from 'minimist';
import { DocumentClient, NewDocument } from 'documentdb';
import { BlobServiceClient, BlockBlobClient, ContainerClient, StorageRetryPolicyType } from '@azure/storage-blob';

// {{SQL CARBON EDIT}}
if (process.argv.length < 9) {
	console.error('Usage: node publish.js <product_quality> <platform> <file_type> <file_name> <version> <is_update> <file> [commit_id]');
	process.exit(-1);
}

function hashStream(hashName: string, stream: Readable): Promise<string> {
	return new Promise<string>((c, e) => {
		const shasum = crypto.createHash(hashName);

		stream
			.on('data', shasum.update.bind(shasum))
			.on('error', e)
			.on('close', () => c(shasum.digest('hex')));
	});
}

interface Config {
	id: string;
	frozen: boolean;
}

function createDefaultConfig(quality: string): Config {
	return {
		id: quality,
		frozen: false
	};
}

function getConfig(quality: string): Promise<Config> {
	console.log(`Getting config for quality ${quality}`);
	const client = new DocumentClient(process.env['AZURE_DOCUMENTDB_ENDPOINT']!, { masterKey: process.env['AZURE_DOCUMENTDB_MASTERKEY'] });
	const collection = 'dbs/builds/colls/config';
	const query = {
		query: `SELECT TOP 1 * FROM c WHERE c.id = @quality`,
		parameters: [
			{ name: '@quality', value: quality }
		]
	};

	return retry(() => new Promise<Config>((c, e) => {
		client.queryDocuments(collection, query, { enableCrossPartitionQuery: true }).toArray((err, results) => {
			if (err && err.code !== 409) { return e(err); }

			c(!results || results.length === 0 ? createDefaultConfig(quality) : results[0] as any as Config);
		});
	}));
}

interface Asset {
	platform: string;
	type: string;
	url: string;
	mooncakeUrl?: string;
	hash: string;
	sha256hash: string;
	size: number;
	supportsFastUpdate?: boolean;
}

function createOrUpdate(commit: string, quality: string, platform: string, type: string, release: NewDocument, asset: Asset, isUpdate: boolean): Promise<void> {
	const client = new DocumentClient(process.env['AZURE_DOCUMENTDB_ENDPOINT']!, { masterKey: process.env['AZURE_DOCUMENTDB_MASTERKEY'] });
	const collection = 'dbs/builds/colls/' + quality;
	const updateQuery = {
		query: 'SELECT TOP 1 * FROM c WHERE c.id = @id',
		parameters: [{ name: '@id', value: commit }]
	};

	let updateTries = 0;

	function update(): Promise<void> {
		updateTries++;

		return new Promise<void>((c, e) => {
			console.log(`Querying existing documents to update...`);
			client.queryDocuments(collection, updateQuery, { enableCrossPartitionQuery: true }).toArray((err, results) => {
				if (err) { return e(err); }
				if (results.length !== 1) { return e(new Error('No documents')); }

				const release = results[0];

				release.assets = [
					...release.assets.filter((a: any) => !(a.platform === platform && a.type === type)),
					asset
				];

				if (isUpdate) {
					release.updates[platform] = type;
				}

				console.log(`Replacing existing document with updated version`);
				client.replaceDocument(release._self, release, err => {
					if (err && err.code === 409 && updateTries < 5) { return c(update()); }
					if (err) { return e(err); }

					console.log('Build successfully updated.');
					c();
				});
			});
		});
	}

	return retry(() => new Promise<void>((c, e) => {
		console.log(`Attempting to create document`);
		client.createDocument(collection, release, err => {
			if (err && err.code === 409) { return c(update()); }
			if (err) { return e(err); }

			console.log('Build successfully published.');
			c();
		});
	}));
}

async function assertContainer(containerClient: ContainerClient): Promise<boolean> {
	let containerResponse = await containerClient.createIfNotExists({ access: 'blob' });
	return containerResponse && !!containerResponse.errorCode;
}

async function uploadBlob(blobClient: BlockBlobClient, file: string): Promise<void> {
	const result = await blobClient.uploadFile(file, {
		blobHTTPHeaders: {
			blobContentType: mime.lookup(file),
			blobCacheControl: 'max-age=31536000, public'
		}
	});
	if (result && !result.errorCode) {
		console.log(`Blobs uploaded successfully, response status: ${result?._response?.status}`);
	} else {
		console.error(`Blobs failed to upload, response status: ${result?._response?.status}, errorcode: ${result?.errorCode}`)
	}
}

interface PublishOptions {
	'upload-only': boolean;
}

async function publish(commit: string, quality: string, platform: string, type: string, name: string, version: string, _isUpdate: string, file: string, opts: PublishOptions): Promise<void> {
	const isUpdate = _isUpdate === 'true';

	const queuedBy = process.env['BUILD_QUEUEDBY']!;
	const sourceBranch = process.env['BUILD_SOURCEBRANCH']!;

	console.log('Publishing...');
	console.log('Quality:', quality);
	console.log('Platform:', platform);
	console.log('Type:', type);
	console.log('Name:', name);
	console.log('Version:', version);
	console.log('Commit:', commit);
	console.log('Is Update:', isUpdate);
	console.log('File:', file);

	const stat = await new Promise<fs.Stats>((c, e) => fs.stat(file, (err, stat) => err ? e(err) : c(stat)));
	const size = stat.size;

	console.log('Size:', size);

	const stream = fs.createReadStream(file);
	const [sha1hash, sha256hash] = await Promise.all([hashStream('sha1', stream), hashStream('sha256', stream)]);

	console.log('SHA1:', sha1hash);
	console.log('SHA256:', sha256hash);

	const blobName = commit + '/' + name;
	const storageAccount = process.env['AZURE_STORAGE_ACCOUNT_2']!;
	const storageKey = process.env['AZURE_STORAGE_ACCESS_KEY_2']!;
	const connectionString = `DefaultEndpointsProtocol=https;AccountName=${storageAccount};AccountKey=${storageKey};EndpointSuffix=core.windows.net`;

	let blobServiceClient = BlobServiceClient.fromConnectionString(connectionString, {
		retryOptions: {
			maxTries: 20,
			retryPolicyType: StorageRetryPolicyType.EXPONENTIAL
		}
	});

	let containerClient = blobServiceClient.getContainerClient(quality);
	if (await assertContainer(containerClient)) {
		const blobClient = containerClient.getBlockBlobClient(blobName);
		const blobExists = await blobClient.exists();

		if (blobExists) {
			console.log(`Blob ${quality}, ${blobName} already exists, not publishing again.`);
			return;
		}

		console.log('Uploading blobs to Azure storage...');
		await uploadBlob(blobClient, file);
		const config = await getConfig(quality);

		console.log('Quality config:', config);
		const asset: Asset = {
			platform: platform,
			type: type,
			url: `${process.env['AZURE_CDN_URL']}/${quality}/${blobName}`,
			hash: sha1hash,
			sha256hash,
			size
		};

		// Remove this if we ever need to rollback fast updates for windows
		if (/win32/.test(platform)) {
			asset.supportsFastUpdate = true;
		}

		console.log('Asset:', JSON.stringify(asset, null, '  '));

		// {{SQL CARBON EDIT}}
		// Insiders: nightly build from main
		const isReleased = (
			(
				(quality === 'insider' && /^main$|^refs\/heads\/main$/.test(sourceBranch)) ||
				(quality === 'rc1' && /^release\/|^refs\/heads\/release\//.test(sourceBranch))
			) &&
			/Project Collection Service Accounts|Microsoft.VisualStudio.Services.TFS/.test(queuedBy)
		);

		const release = {
			id: commit,
			timestamp: (new Date()).getTime(),
			version,
			isReleased: isReleased,
			sourceBranch,
			queuedBy,
			assets: [] as Array<Asset>,
			updates: {} as any
		};

		if (!opts['upload-only']) {
			release.assets.push(asset);

			if (isUpdate) {
				release.updates[platform] = type;
			}
		}

		await createOrUpdate(commit, quality, platform, type, release, asset, isUpdate);
	}
}

const RETRY_TIMES = 10;
async function retry<T>(fn: () => Promise<T>): Promise<T> {
	for (let run = 1; run <= RETRY_TIMES; run++) {
		try {
			return await fn();
		} catch (err) {
			if (!/ECONNRESET/.test(err.message)) {
				throw err;
			}
			console.log(`Caught error ${err} - ${run}/${RETRY_TIMES}`);
		}
	}

	throw new Error('Retried too many times');
}

function main(): void {
	const commit = process.env['BUILD_SOURCEVERSION'];

	if (!commit) {
		console.warn('Skipping publish due to missing BUILD_SOURCEVERSION');
		return;
	}

	const opts = minimist<PublishOptions>(process.argv.slice(2), {
		boolean: ['upload-only']
	});

	const [quality, platform, type, name, version, _isUpdate, file] = opts._;

	publish(commit, quality, platform, type, name, version, _isUpdate, file, opts).catch(err => {
		console.error(err);
		process.exit(1);
	});
}

main();
