/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var child_process_1 = require("child_process");
var crypto = require("crypto");
var azure = require("azure-storage");
var mime = require("mime");
var minimist = require("minimist");
var documentdb_1 = require("documentdb");
// {{SQL CARBON EDIT}}
if (process.argv.length < 9) {
    console.error('Usage: node publish.js <product_quality> <platform> <file_type> <file_name> <version> <is_update> <file> [commit_id]');
    process.exit(-1);
}
function hashStream(hashName, stream) {
    return new Promise(function (c, e) {
        var shasum = crypto.createHash(hashName);
        stream
            .on('data', shasum.update.bind(shasum))
            .on('error', e)
            .on('close', function () { return c(shasum.digest('hex')); });
    });
}
function createDefaultConfig(quality) {
    return {
        id: quality,
        frozen: false
    };
}
function getConfig(quality) {
    var client = new documentdb_1.DocumentClient(process.env['AZURE_DOCUMENTDB_ENDPOINT'], { masterKey: process.env['AZURE_DOCUMENTDB_MASTERKEY'] });
    var collection = 'dbs/builds/colls/config';
    var query = {
        query: "SELECT TOP 1 * FROM c WHERE c.id = @quality",
        parameters: [
            { name: '@quality', value: quality }
        ]
    };
    return new Promise(function (c, e) {
        client.queryDocuments(collection, query).toArray(function (err, results) {
            if (err && err.code !== 409) {
                return e(err);
            }
            c(!results || results.length === 0 ? createDefaultConfig(quality) : results[0]);
        });
    });
}
function createOrUpdate(commit, quality, platform, type, release, asset, isUpdate) {
    var client = new documentdb_1.DocumentClient(process.env['AZURE_DOCUMENTDB_ENDPOINT'], { masterKey: process.env['AZURE_DOCUMENTDB_MASTERKEY'] });
    var collection = 'dbs/builds/colls/' + quality;
    var updateQuery = {
        query: 'SELECT TOP 1 * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: commit }]
    };
    var updateTries = 0;
    function update() {
        updateTries++;
        return new Promise(function (c, e) {
            client.queryDocuments(collection, updateQuery).toArray(function (err, results) {
                if (err) {
                    return e(err);
                }
                if (results.length !== 1) {
                    return e(new Error('No documents'));
                }
                var release = results[0];
                release.assets = release.assets.filter(function (a) { return !(a.platform === platform && a.type === type); }).concat([
                    asset
                ]);
                if (isUpdate) {
                    release.updates[platform] = type;
                }
                client.replaceDocument(release._self, release, function (err) {
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
    return new Promise(function (c, e) {
        client.createDocument(collection, release, function (err) {
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
function assertContainer(blobService, quality) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, new Promise(function (c, e) { return blobService.createContainerIfNotExists(quality, { publicAccessLevel: 'blob' }, function (err) { return err ? e(err) : c(); }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function doesAssetExist(blobService, quality, blobName) {
    return __awaiter(this, void 0, void 0, function () {
        var existsResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, new Promise(function (c, e) { return blobService.doesBlobExist(quality, blobName, function (err, r) { return err ? e(err) : c(r); }); })];
                case 1:
                    existsResult = _a.sent();
                    return [2 /*return*/, existsResult.exists];
            }
        });
    });
}
function uploadBlob(blobService, quality, blobName, file) {
    return __awaiter(this, void 0, void 0, function () {
        var blobOptions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    blobOptions = {
                        contentSettings: {
                            contentType: mime.lookup(file),
                            cacheControl: 'max-age=31536000, public'
                        }
                    };
                    return [4 /*yield*/, new Promise(function (c, e) { return blobService.createBlockBlobFromLocalFile(quality, blobName, file, blobOptions, function (err) { return err ? e(err) : c(); }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function publish(commit, quality, platform, type, name, version, _isUpdate, file, opts) {
    return __awaiter(this, void 0, void 0, function () {
        var isUpdate, queuedBy, sourceBranch, isReleased, stat, size, stream, _a, sha1hash, sha256hash, blobName, storageAccount, blobService, blobExists, promises, mooncakeBlobService, _b, blobExists_1, moooncakeBlobExists, promises_1, config, asset, release;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    isUpdate = _isUpdate === 'true';
                    queuedBy = process.env['BUILD_QUEUEDBY'];
                    sourceBranch = process.env['BUILD_SOURCEBRANCH'];
                    isReleased = quality === 'insider'
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
                    return [4 /*yield*/, new Promise(function (c, e) { return fs.stat(file, function (err, stat) { return err ? e(err) : c(stat); }); })];
                case 1:
                    stat = _c.sent();
                    size = stat.size;
                    console.log('Size:', size);
                    stream = fs.createReadStream(file);
                    return [4 /*yield*/, Promise.all([hashStream('sha1', stream), hashStream('sha256', stream)])];
                case 2:
                    _a = _c.sent(), sha1hash = _a[0], sha256hash = _a[1];
                    console.log('SHA1:', sha1hash);
                    console.log('SHA256:', sha256hash);
                    blobName = commit + '/' + name;
                    storageAccount = process.env['AZURE_STORAGE_ACCOUNT_2'];
                    blobService = azure.createBlobService(storageAccount, process.env['AZURE_STORAGE_ACCESS_KEY_2'])
                        .withFilter(new azure.ExponentialRetryPolicyFilter(20));
                    // {{SQL CARBON EDIT}}
                    return [4 /*yield*/, assertContainer(blobService, quality)];
                case 3:
                    // {{SQL CARBON EDIT}}
                    _c.sent();
                    return [4 /*yield*/, doesAssetExist(blobService, quality, blobName)];
                case 4:
                    blobExists = _c.sent();
                    promises = [];
                    if (!blobExists) {
                        promises.push(uploadBlob(blobService, quality, blobName, file));
                    }
                    if (!process.env['MOONCAKE_STORAGE_ACCESS_KEY']) return [3 /*break*/, 7];
                    mooncakeBlobService = azure.createBlobService(storageAccount, process.env['MOONCAKE_STORAGE_ACCESS_KEY'], storageAccount + ".blob.core.chinacloudapi.cn")
                        .withFilter(new azure.ExponentialRetryPolicyFilter(20));
                    // mooncake is fussy and far away, this is needed!
                    mooncakeBlobService.defaultClientRequestTimeoutInMs = 10 * 60 * 1000;
                    return [4 /*yield*/, Promise.all([
                            assertContainer(blobService, quality),
                            assertContainer(mooncakeBlobService, quality)
                        ])];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, Promise.all([
                            doesAssetExist(blobService, quality, blobName),
                            doesAssetExist(mooncakeBlobService, quality, blobName)
                        ])];
                case 6:
                    _b = _c.sent(), blobExists_1 = _b[0], moooncakeBlobExists = _b[1];
                    promises_1 = [];
                    if (!blobExists_1) {
                        promises_1.push(uploadBlob(blobService, quality, blobName, file));
                    }
                    if (!moooncakeBlobExists) {
                        promises_1.push(uploadBlob(mooncakeBlobService, quality, blobName, file));
                    }
                    return [3 /*break*/, 8];
                case 7:
                    console.log('Skipping Mooncake publishing.');
                    _c.label = 8;
                case 8:
                    if (promises.length === 0) {
                        console.log("Blob " + quality + ", " + blobName + " already exists, not publishing again.");
                        return [2 /*return*/];
                    }
                    console.log('Uploading blobs to Azure storage...');
                    return [4 /*yield*/, Promise.all(promises)];
                case 9:
                    _c.sent();
                    console.log('Blobs successfully uploaded.');
                    return [4 /*yield*/, getConfig(quality)];
                case 10:
                    config = _c.sent();
                    console.log('Quality config:', config);
                    asset = {
                        platform: platform,
                        type: type,
                        url: process.env['AZURE_CDN_URL'] + "/" + quality + "/" + blobName,
                        // {{SQL CARBON EDIT}}
                        mooncakeUrl: process.env['MOONCAKE_CDN_URL'] ? process.env['MOONCAKE_CDN_URL'] + "/" + quality + "/" + blobName : undefined,
                        hash: sha1hash,
                        sha256hash: sha256hash,
                        size: size
                    };
                    // Remove this if we ever need to rollback fast updates for windows
                    if (/win32/.test(platform)) {
                        asset.supportsFastUpdate = true;
                    }
                    console.log('Asset:', JSON.stringify(asset, null, '  '));
                    release = {
                        id: commit,
                        timestamp: (new Date()).getTime(),
                        version: version,
                        isReleased: config.frozen ? false : isReleased,
                        sourceBranch: sourceBranch,
                        queuedBy: queuedBy,
                        assets: [],
                        updates: {}
                    };
                    if (!opts['upload-only']) {
                        release.assets.push(asset);
                        if (isUpdate) {
                            release.updates[platform] = type;
                        }
                    }
                    return [4 /*yield*/, createOrUpdate(commit, quality, platform, type, release, asset, isUpdate)];
                case 11:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function main() {
    var opts = minimist(process.argv.slice(2), {
        boolean: ['upload-only']
    });
    // {{SQL CARBON EDIT}}
    var _a = opts._, quality = _a[0], platform = _a[1], type = _a[2], name = _a[3], version = _a[4], _isUpdate = _a[5], file = _a[6], commit = _a[7];
    if (!commit) {
        commit = child_process_1.execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    }
    publish(commit, quality, platform, type, name, version, _isUpdate, file, opts).catch(function (err) {
        console.error(err);
        process.exit(1);
    });
}
main();
