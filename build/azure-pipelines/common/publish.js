/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const child_process_1 = require("child_process");
const crypto = require("crypto");
const azure = require("azure-storage");
const mime = require("mime");
const minimist = require("minimist");
const documentdb_1 = require("documentdb");
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
    const client = new documentdb_1.DocumentClient(process.env['AZURE_DOCUMENTDB_ENDPOINT'], { masterKey: process.env['AZURE_DOCUMENTDB_MASTERKEY'] });
    const collection = 'dbs/builds/colls/config';
    const query = {
        query: `SELECT TOP 1 * FROM c WHERE c.id = @quality`,
        parameters: [
            { name: '@quality', value: quality }
        ]
    };
    return new Promise((c, e) => {
        client.queryDocuments(collection, query).toArray((err, results) => {
            if (err && err.code !== 409) {
                return e(err);
            }
            c(!results || results.length === 0 ? createDefaultConfig(quality) : results[0]);
        });
    });
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
            client.queryDocuments(collection, updateQuery).toArray((err, results) => {
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
    return new Promise((c, e) => {
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
    });
}
async function assertContainer(blobService, quality) {
    await new Promise((c, e) => blobService.createContainerIfNotExists(quality, { publicAccessLevel: 'blob' }, err => err ? e(err) : c()));
}
async function doesAssetExist(blobService, quality, blobName) {
    const existsResult = await new Promise((c, e) => blobService.doesBlobExist(quality, blobName, (err, r) => err ? e(err) : c(r)));
    return existsResult.exists;
}
async function uploadBlob(blobService, quality, blobName, file) {
    const blobOptions = {
        contentSettings: {
            contentType: mime.lookup(file),
            cacheControl: 'max-age=31536000, public'
        }
    };
    await new Promise((c, e) => blobService.createBlockBlobFromLocalFile(quality, blobName, file, blobOptions, err => err ? e(err) : c()));
}
async function publish(commit, quality, platform, type, name, version, _isUpdate, file, opts) {
    const isUpdate = _isUpdate === 'true';
    const queuedBy = process.env['BUILD_QUEUEDBY'];
    const sourceBranch = process.env['BUILD_SOURCEBRANCH'];
    const isReleased = quality === 'insider'
        && /^master$|^refs\/heads\/master$/.test(sourceBranch)
        && /Project Collection Service Accounts|Microsoft.VisualStudio.Services.TFS/.test(queuedBy);
    console.log('Publishing...');
    console.log('Quality:', quality);
    console.log('Platform:', platform);
    console.log('Type:', type);
    console.log('Name:', name);
    console.log('Version:', version);
    console.log('Commit:', commit);
    console.log('Is Update:', isUpdate);
    console.log('Is Released:', isReleased);
    console.log('File:', file);
    const stat = await new Promise((c, e) => fs.stat(file, (err, stat) => err ? e(err) : c(stat)));
    const size = stat.size;
    console.log('Size:', size);
    const stream = fs.createReadStream(file);
    const [sha1hash, sha256hash] = await Promise.all([hashStream('sha1', stream), hashStream('sha256', stream)]);
    console.log('SHA1:', sha1hash);
    console.log('SHA256:', sha256hash);
    const blobName = commit + '/' + name;
    const storageAccount = process.env['AZURE_STORAGE_ACCOUNT_2'];
    const blobService = azure.createBlobService(storageAccount, process.env['AZURE_STORAGE_ACCESS_KEY_2'])
        .withFilter(new azure.ExponentialRetryPolicyFilter(20));
    // {{SQL CARBON EDIT}}
    await assertContainer(blobService, quality);
    const blobExists = await doesAssetExist(blobService, quality, blobName);
    const promises = [];
    if (!blobExists) {
        promises.push(uploadBlob(blobService, quality, blobName, file));
    }
    // {{SQL CARBON EDIT}}
    if (process.env['MOONCAKE_STORAGE_ACCESS_KEY']) {
        const mooncakeBlobService = azure.createBlobService(storageAccount, process.env['MOONCAKE_STORAGE_ACCESS_KEY'], `${storageAccount}.blob.core.chinacloudapi.cn`)
            .withFilter(new azure.ExponentialRetryPolicyFilter(20));
        // mooncake is fussy and far away, this is needed!
        mooncakeBlobService.defaultClientRequestTimeoutInMs = 10 * 60 * 1000;
        await Promise.all([
            assertContainer(blobService, quality),
            assertContainer(mooncakeBlobService, quality)
        ]);
        const [blobExists, moooncakeBlobExists] = await Promise.all([
            doesAssetExist(blobService, quality, blobName),
            doesAssetExist(mooncakeBlobService, quality, blobName)
        ]);
        const promises = [];
        if (!blobExists) {
            promises.push(uploadBlob(blobService, quality, blobName, file));
        }
        if (!moooncakeBlobExists) {
            promises.push(uploadBlob(mooncakeBlobService, quality, blobName, file));
        }
    }
    else {
        console.log('Skipping Mooncake publishing.');
    }
    if (promises.length === 0) {
        console.log(`Blob ${quality}, ${blobName} already exists, not publishing again.`);
        return;
    }
    console.log('Uploading blobs to Azure storage...');
    await Promise.all(promises);
    console.log('Blobs successfully uploaded.');
    const config = await getConfig(quality);
    console.log('Quality config:', config);
    const asset = {
        platform: platform,
        type: type,
        url: `${process.env['AZURE_CDN_URL']}/${quality}/${blobName}`,
        // {{SQL CARBON EDIT}}
        mooncakeUrl: process.env['MOONCAKE_CDN_URL'] ? `${process.env['MOONCAKE_CDN_URL']}/${quality}/${blobName}` : undefined,
        hash: sha1hash,
        sha256hash,
        size
    };
    // Remove this if we ever need to rollback fast updates for windows
    if (/win32/.test(platform)) {
        asset.supportsFastUpdate = true;
    }
    console.log('Asset:', JSON.stringify(asset, null, '  '));
    const release = {
        id: commit,
        timestamp: (new Date()).getTime(),
        version,
        isReleased: config.frozen ? false : isReleased,
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
function main() {
    if (process.env['VSCODE_BUILD_SKIP_PUBLISH']) {
        console.warn('Skipping publish due to VSCODE_BUILD_SKIP_PUBLISH');
        return;
    }
    const opts = minimist(process.argv.slice(2), {
        boolean: ['upload-only']
    });
    // {{SQL CARBON EDIT}}
    let [quality, platform, type, name, version, _isUpdate, file, commit] = opts._;
    if (!commit) {
        commit = child_process_1.execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    }
    publish(commit, quality, platform, type, name, version, _isUpdate, file, opts).catch(err => {
        console.error(err);
        process.exit(1);
    });
}
main();
