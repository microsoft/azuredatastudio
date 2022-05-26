/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const url = require("url");
const crypto = require("crypto");
const mime = require("mime");
const cosmos_1 = require("@azure/cosmos");
const retry_1 = require("./retry");
const storage_blob_1 = require("@azure/storage-blob");
if (process.argv.length !== 8) {
    console.error('Usage: node createAsset.js PRODUCT OS ARCH TYPE NAME FILE');
    process.exit(-1);
}
// Contains all of the logic for mapping details to our actual product names in CosmosDB
function getPlatform(product, os, arch, type) {
    switch (os) {
        case 'win32':
            switch (product) {
                case 'client':
                    const asset = arch === 'ia32' ? 'win32' : `win32-${arch}`;
                    switch (type) {
                        case 'archive':
                            return `${asset}-archive`;
                        case 'setup':
                            return asset;
                        case 'user-setup':
                            return `${asset}-user`;
                        default:
                            throw `Unrecognized: ${product} ${os} ${arch} ${type}`;
                    }
                case 'server':
                    if (arch === 'arm64') {
                        throw `Unrecognized: ${product} ${os} ${arch} ${type}`;
                    }
                    return arch === 'ia32' ? 'server-win32' : `server-win32-${arch}`;
                case 'web':
                    if (arch === 'arm64') {
                        throw `Unrecognized: ${product} ${os} ${arch} ${type}`;
                    }
                    return arch === 'ia32' ? 'server-win32-web' : `server-win32-${arch}-web`;
                default:
                    throw `Unrecognized: ${product} ${os} ${arch} ${type}`;
            }
        case 'linux':
            switch (type) {
                case 'snap':
                    return `linux-snap-${arch}`;
                case 'archive-unsigned':
                    switch (product) {
                        case 'client':
                            return `linux-${arch}`;
                        case 'server':
                            return `server-linux-${arch}`;
                        case 'web':
                            return arch === 'standalone' ? 'web-standalone' : `server-linux-${arch}-web`;
                        default:
                            throw `Unrecognized: ${product} ${os} ${arch} ${type}`;
                    }
                case 'deb-package':
                    return `linux-deb-${arch}`;
                case 'rpm-package':
                    return `linux-rpm-${arch}`;
                default:
                    throw `Unrecognized: ${product} ${os} ${arch} ${type}`;
            }
        case 'darwin':
            switch (product) {
                case 'client':
                    if (arch === 'x64') {
                        return 'darwin';
                    }
                    return `darwin-${arch}`;
                case 'server':
                    return 'server-darwin';
                case 'web':
                    if (arch !== 'x64') {
                        throw `What should the platform be?: ${product} ${os} ${arch} ${type}`;
                    }
                    return 'server-darwin-web';
                default:
                    throw `Unrecognized: ${product} ${os} ${arch} ${type}`;
            }
        default:
            throw `Unrecognized: ${product} ${os} ${arch} ${type}`;
    }
}
// Contains all of the logic for mapping types to our actual types in CosmosDB
function getRealType(type) {
    switch (type) {
        case 'user-setup':
            return 'setup';
        case 'deb-package':
        case 'rpm-package':
            return 'package';
        default:
            return type;
    }
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
async function doesAssetExist(containerClient, blobName) {
    return await containerClient.getBlobClient(blobName).exists();
}
async function uploadBlob(containerClient, blobName, filePath, fileName) {
    const blobClient = containerClient.getBlockBlobClient(blobName);
    await blobClient.uploadFile(filePath, {
        metadata: {
            ontentType: mime.lookup(filePath),
            contentDisposition: `attachment; filename="${fileName}"`,
            cacheControl: 'max-age=31536000, public'
        }
    });
}
function getEnv(name) {
    const result = process.env[name];
    if (typeof result === 'undefined') {
        throw new Error('Missing env: ' + name);
    }
    return result;
}
async function main() {
    const [, , product, os, arch, unprocessedType, fileName, filePath] = process.argv;
    // getPlatform needs the unprocessedType
    const platform = getPlatform(product, os, arch, unprocessedType);
    const type = getRealType(unprocessedType);
    const quality = getEnv('VSCODE_QUALITY');
    const commit = getEnv('BUILD_SOURCEVERSION');
    console.log('Creating asset...');
    const stat = await new Promise((c, e) => fs.stat(filePath, (err, stat) => err ? e(err) : c(stat)));
    const size = stat.size;
    console.log('Size:', size);
    const stream = fs.createReadStream(filePath);
    const [sha1hash, sha256hash] = await Promise.all([hashStream('sha1', stream), hashStream('sha256', stream)]);
    console.log('SHA1:', sha1hash);
    console.log('SHA256:', sha256hash);
    const blobName = commit + '/' + fileName;
    const storageAccount = process.env['AZURE_STORAGE_ACCOUNT_2'];
    const storageAccountKey = process.env['AZURE_STORAGE_ACCESS_KEY_2'];
    const sharedKeyCredential = new storage_blob_1.StorageSharedKeyCredential(storageAccount, storageAccountKey);
    const blobContainerClient = new storage_blob_1.ContainerClient(`https://${storageAccount}.blob.core.windows.net/${quality}`, sharedKeyCredential, {
        retryOptions: {
            retryPolicyType: storage_blob_1.StorageRetryPolicyType.EXPONENTIAL,
            tryTimeoutInMs: 10 * 60 * 1000,
            maxTries: 20
        }
    });
    const blobExists = await doesAssetExist(blobContainerClient, blobName);
    if (blobExists) {
        console.log(`Blob ${quality}, ${blobName} already exists, not publishing again.`);
        return;
    }
    const mooncakeAccountKey = process.env['MOONCAKE_STORAGE_ACCESS_KEY'];
    const mooncakeKeyCredential = new storage_blob_1.StorageSharedKeyCredential(storageAccount, mooncakeAccountKey);
    const mooncakeBlobContainerClient = new storage_blob_1.ContainerClient(`https://${storageAccount}.blob.core.chinacloudapi.cn/${quality}`, mooncakeKeyCredential, {
        retryOptions: {
            retryPolicyType: storage_blob_1.StorageRetryPolicyType.EXPONENTIAL,
            tryTimeoutInMs: 10 * 60 * 1000,
            maxTries: 20
        }
    });
    console.log('Uploading blobs to Azure storage and Mooncake Azure storage...');
    await (0, retry_1.retry)(() => Promise.all([
        uploadBlob(blobContainerClient, blobName, filePath, fileName),
        uploadBlob(mooncakeBlobContainerClient, blobName, filePath, fileName)
    ]));
    console.log('Blobs successfully uploaded.');
    // TODO: Understand if blobName and blobPath are the same and replace blobPath with blobName if so.
    const assetUrl = `${process.env['AZURE_CDN_URL']}/${quality}/${blobName}`;
    const blobPath = url.parse(assetUrl).path;
    const mooncakeUrl = `${process.env['MOONCAKE_CDN_URL']}${blobPath}`;
    const asset = {
        platform,
        type,
        url: assetUrl,
        hash: sha1hash,
        mooncakeUrl,
        sha256hash,
        size
    };
    // Remove this if we ever need to rollback fast updates for windows
    if (/win32/.test(platform)) {
        asset.supportsFastUpdate = true;
    }
    console.log('Asset:', JSON.stringify(asset, null, '  '));
    const client = new cosmos_1.CosmosClient({ endpoint: process.env['AZURE_DOCUMENTDB_ENDPOINT'], key: process.env['AZURE_DOCUMENTDB_MASTERKEY'] });
    const scripts = client.database('builds').container(quality).scripts;
    await (0, retry_1.retry)(() => scripts.storedProcedure('createAsset').execute('', [commit, asset, true]));
    console.log(`  Done ✔️`);
}
main().then(() => {
    console.log('Asset successfully created');
    process.exit(0);
}, err => {
    console.error(err);
    process.exit(1);
});
