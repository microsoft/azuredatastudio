/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const crypto = require("crypto");
const mime = require("mime");
const minimist = require("minimist");
const documentdb_1 = require("documentdb");
const storage_blob_1 = require("@azure/storage-blob");
// {{SQL CARBON EDIT}}
if (process.argv.length < 9) {
    console.error('Usage: node publish.js <product_quality> <platform> <file_type> <file_name> <version> <is_update> <file> [commit_id]');
    process.exit(-1);
}
function hashStream(hashName, stream) {
    return new Promise((c, e) => {
        const shasum = crypto.createHash(hashName);
        stream
            .on('data', shasum.update.bind(shasum))
            .on('error', e)
            .on('close', () => c(shasum.digest('hex')));
    });
}
function createDefaultConfig(quality) {
    return {
        id: quality,
        frozen: false
    };
}
function getConfig(quality) {
    console.log(`Getting config for quality ${quality}`);
    const client = new documentdb_1.DocumentClient(process.env['AZURE_DOCUMENTDB_ENDPOINT'], { masterKey: process.env['AZURE_DOCUMENTDB_MASTERKEY'] });
    const collection = 'dbs/builds/colls/config';
    const query = {
        query: `SELECT TOP 1 * FROM c WHERE c.id = @quality`,
        parameters: [
            { name: '@quality', value: quality }
        ]
    };
    return retry(() => new Promise((c, e) => {
        client.queryDocuments(collection, query, { enableCrossPartitionQuery: true }).toArray((err, results) => {
            if (err && err.code !== 409) {
                return e(err);
            }
            c(!results || results.length === 0 ? createDefaultConfig(quality) : results[0]);
        });
    }));
}
function createOrUpdate(commit, quality, platform, type, release, asset, isUpdate) {
    const client = new documentdb_1.DocumentClient(process.env['AZURE_DOCUMENTDB_ENDPOINT'], { masterKey: process.env['AZURE_DOCUMENTDB_MASTERKEY'] });
    const collection = 'dbs/builds/colls/' + quality;
    const updateQuery = {
        query: 'SELECT TOP 1 * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: commit }]
    };
    let updateTries = 0;
    function update() {
        updateTries++;
        return new Promise((c, e) => {
            console.log(`Querying existing documents to update...`);
            client.queryDocuments(collection, updateQuery, { enableCrossPartitionQuery: true }).toArray((err, results) => {
                if (err) {
                    return e(err);
                }
                if (results.length !== 1) {
                    return e(new Error('No documents'));
                }
                const release = results[0];
                release.assets = [
                    ...release.assets.filter((a) => !(a.platform === platform && a.type === type)),
                    asset
                ];
                if (isUpdate) {
                    release.updates[platform] = type;
                }
                console.log(`Replacing existing document with updated version`);
                client.replaceDocument(release._self, release, err => {
                    if (err && err.code === 409 && updateTries < 5) {
                        return c(update());
                    }
                    if (err) {
                        return e(err);
                    }
                    console.log('Build successfully updated.');
                    c();
                });
            });
        });
    }
    return retry(() => new Promise((c, e) => {
        console.log(`Attempting to create document`);
        client.createDocument(collection, release, err => {
            if (err && err.code === 409) {
                return c(update());
            }
            if (err) {
                return e(err);
            }
            console.log('Build successfully published.');
            c();
        });
    }));
}
async function assertContainer(containerClient) {
    let containerResponse = await containerClient.createIfNotExists({ access: 'blob' });
    return containerResponse && !!containerResponse.errorCode;
}
async function uploadBlob(blobClient, file) {
    const result = await blobClient.uploadFile(file, {
        blobHTTPHeaders: {
            blobContentType: mime.lookup(file),
            blobCacheControl: 'max-age=31536000, public'
        }
    });
    if (result && !result.errorCode) {
        console.log(`Blobs uploaded successfully, response status: ${result?._response?.status}`);
    }
    else {
        console.error(`Blobs failed to upload, response status: ${result?._response?.status}, errorcode: ${result?.errorCode}`);
    }
}
async function publish(commit, quality, platform, type, name, version, _isUpdate, file, opts) {
    const isUpdate = _isUpdate === 'true';
    const queuedBy = process.env['BUILD_QUEUEDBY'];
    const sourceBranch = process.env['BUILD_SOURCEBRANCH'];
    console.log('Publishing...');
    console.log('Quality:', quality);
    console.log('Platform:', platform);
    console.log('Type:', type);
    console.log('Name:', name);
    console.log('Version:', version);
    console.log('Commit:', commit);
    console.log('Is Update:', isUpdate);
    console.log('File:', file);
    const stat = await new Promise((c, e) => fs.stat(file, (err, stat) => err ? e(err) : c(stat)));
    const size = stat.size;
    console.log('Size:', size);
    const stream = fs.createReadStream(file);
    const sha256hash = await hashStream('sha256', stream);
    console.log('SHA256:', sha256hash);
    const blobName = commit + '/' + name;
    const storageAccount = process.env['AZURE_STORAGE_ACCOUNT_2'];
    const storageKey = process.env['AZURE_STORAGE_ACCESS_KEY_2'];
    const connectionString = `DefaultEndpointsProtocol=https;AccountName=${storageAccount};AccountKey=${storageKey};EndpointSuffix=core.windows.net`;
    let blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connectionString, {
        retryOptions: {
            maxTries: 20,
            retryPolicyType: storage_blob_1.StorageRetryPolicyType.EXPONENTIAL
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
        const asset = {
            platform: platform,
            type: type,
            url: `${process.env['AZURE_CDN_URL']}/${quality}/${blobName}`,
            hash: sha256hash,
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
        const isReleased = (((quality === 'insider' && /^main$|^refs\/heads\/main$/.test(sourceBranch)) ||
            (quality === 'rc1' && /^release\/|^refs\/heads\/release\//.test(sourceBranch))) &&
            /Project Collection Service Accounts|Microsoft.VisualStudio.Services.TFS/.test(queuedBy));
        const release = {
            id: commit,
            timestamp: (new Date()).getTime(),
            version,
            isReleased: isReleased,
            sourceBranch,
            queuedBy,
            assets: [],
            updates: {}
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
async function retry(fn) {
    for (let run = 1; run <= RETRY_TIMES; run++) {
        try {
            return await fn();
        }
        catch (err) {
            if (!/ECONNRESET/.test(err.message)) {
                throw err;
            }
            console.log(`Caught error ${err} - ${run}/${RETRY_TIMES}`);
        }
    }
    throw new Error('Retried too many times');
}
function main() {
    const commit = process.env['BUILD_SOURCEVERSION'];
    if (!commit) {
        console.warn('Skipping publish due to missing BUILD_SOURCEVERSION');
        return;
    }
    const opts = minimist(process.argv.slice(2), {
        boolean: ['upload-only']
    });
    const [quality, platform, type, name, version, _isUpdate, file] = opts._;
    publish(commit, quality, platform, type, name, version, _isUpdate, file, opts).catch(err => {
        console.error(err);
        process.exit(1);
    });
}
main();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHVibGlzaC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInB1Ymxpc2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsWUFBWSxDQUFDOztBQUViLHlCQUF5QjtBQUV6QixpQ0FBaUM7QUFDakMsNkJBQTZCO0FBQzdCLHFDQUFxQztBQUNyQywyQ0FBeUQ7QUFDekQsc0RBQWtIO0FBRWxILHNCQUFzQjtBQUN0QixJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtJQUM1QixPQUFPLENBQUMsS0FBSyxDQUFDLHNIQUFzSCxDQUFDLENBQUM7SUFDdEksT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ2pCO0FBRUQsU0FBUyxVQUFVLENBQUMsUUFBZ0IsRUFBRSxNQUFnQjtJQUNyRCxPQUFPLElBQUksT0FBTyxDQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQ25DLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFM0MsTUFBTTthQUNKLEVBQUUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7YUFDdEMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7YUFDZCxFQUFFLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM5QyxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUM7QUFPRCxTQUFTLG1CQUFtQixDQUFDLE9BQWU7SUFDM0MsT0FBTztRQUNOLEVBQUUsRUFBRSxPQUFPO1FBQ1gsTUFBTSxFQUFFLEtBQUs7S0FDYixDQUFDO0FBQ0gsQ0FBQztBQUVELFNBQVMsU0FBUyxDQUFDLE9BQWU7SUFDakMsT0FBTyxDQUFDLEdBQUcs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
