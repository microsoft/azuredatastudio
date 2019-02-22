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
var request = require("request");
var fs_1 = require("fs");
var github = require("github-releases");
var path_1 = require("path");
var os_1 = require("os");
var util_1 = require("util");
var BASE_URL = 'https://rink.hockeyapp.net/api/2/';
var HOCKEY_APP_TOKEN_HEADER = 'X-HockeyAppToken';
var Platform;
(function (Platform) {
    Platform["WIN_32"] = "win32-ia32";
    Platform["WIN_64"] = "win32-x64";
    Platform["LINUX_32"] = "linux-ia32";
    Platform["LINUX_64"] = "linux-x64";
    Platform["MAC_OS"] = "darwin-x64";
})(Platform || (Platform = {}));
function symbolsZipName(platform, electronVersion, insiders) {
    return (insiders ? 'insiders' : 'stable') + "-symbols-v" + electronVersion + "-" + platform + ".zip";
}
var SEED = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function tmpFile(name) {
    return __awaiter(this, void 0, void 0, function () {
        var res, i, tmpParent;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    res = '';
                    for (i = 0; i < 8; i++) {
                        res += SEED.charAt(Math.floor(Math.random() * SEED.length));
                    }
                    tmpParent = path_1.join(os_1.tmpdir(), res);
                    return [4 /*yield*/, util_1.promisify(fs_1.mkdir)(tmpParent)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, path_1.join(tmpParent, name)];
            }
        });
    });
}
function getVersions(accessor) {
    var _a;
    return asyncRequest({
        url: BASE_URL + "/apps/" + accessor.appId + "/app_versions",
        method: 'GET',
        headers: (_a = {},
            _a[HOCKEY_APP_TOKEN_HEADER] = accessor.accessToken,
            _a)
    });
}
function createVersion(accessor, version) {
    var _a;
    return asyncRequest({
        url: BASE_URL + "/apps/" + accessor.appId + "/app_versions/new",
        method: 'POST',
        headers: (_a = {},
            _a[HOCKEY_APP_TOKEN_HEADER] = accessor.accessToken,
            _a),
        formData: {
            bundle_version: version
        }
    });
}
function updateVersion(accessor, symbolsPath) {
    var _a;
    return asyncRequest({
        url: BASE_URL + "/apps/" + accessor.appId + "/app_versions/" + accessor.id,
        method: 'PUT',
        headers: (_a = {},
            _a[HOCKEY_APP_TOKEN_HEADER] = accessor.accessToken,
            _a),
        formData: {
            dsym: fs_1.createReadStream(symbolsPath)
        }
    });
}
function asyncRequest(options) {
    return new Promise(function (resolve, reject) {
        request(options, function (error, response, body) {
            if (error) {
                reject(error);
            }
            else {
                resolve(JSON.parse(body));
            }
        });
    });
}
function downloadAsset(repository, assetName, targetPath, electronVersion) {
    return new Promise(function (resolve, reject) {
        repository.getReleases({ tag_name: "v" + electronVersion }, function (err, releases) {
            if (err) {
                reject(err);
            }
            else {
                var asset = releases[0].assets.filter(function (asset) { return asset.name === assetName; })[0];
                if (!asset) {
                    reject(new Error("Asset with name " + assetName + " not found"));
                }
                else {
                    repository.downloadAsset(asset, function (err, reader) {
                        if (err) {
                            reject(err);
                        }
                        else {
                            var writer = fs_1.createWriteStream(targetPath);
                            writer.on('error', reject);
                            writer.on('close', resolve);
                            reader.on('error', reject);
                            reader.pipe(writer);
                        }
                    });
                }
            }
        });
    });
}
function ensureVersionAndSymbols(options) {
    return __awaiter(this, void 0, void 0, function () {
        var versions, symbolsName, symbolsPath, version;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Check version does not exist
                    console.log("HockeyApp: checking for existing version " + options.versions.code + " (" + options.platform + ")");
                    return [4 /*yield*/, getVersions({ accessToken: options.access.hockeyAppToken, appId: options.access.hockeyAppId })];
                case 1:
                    versions = _a.sent();
                    if (versions.app_versions.some(function (v) { return v.version === options.versions.code; })) {
                        console.log("HockeyApp: Returning without uploading symbols because version " + options.versions.code + " (" + options.platform + ") was already found");
                        return [2 /*return*/];
                    }
                    symbolsName = symbolsZipName(options.platform, options.versions.electron, options.versions.insiders);
                    return [4 /*yield*/, tmpFile('symbols.zip')];
                case 2:
                    symbolsPath = _a.sent();
                    console.log("HockeyApp: downloading symbols " + symbolsName + " for electron " + options.versions.electron + " (" + options.platform + ") into " + symbolsPath);
                    return [4 /*yield*/, downloadAsset(new github({ repo: options.repository, token: options.access.githubToken }), symbolsName, symbolsPath, options.versions.electron)];
                case 3:
                    _a.sent();
                    // Create version
                    console.log("HockeyApp: creating new version " + options.versions.code + " (" + options.platform + ")");
                    return [4 /*yield*/, createVersion({ accessToken: options.access.hockeyAppToken, appId: options.access.hockeyAppId }, options.versions.code)];
                case 4:
                    version = _a.sent();
                    // Upload symbols
                    console.log("HockeyApp: uploading symbols for version " + options.versions.code + " (" + options.platform + ")");
                    return [4 /*yield*/, updateVersion({ id: String(version.id), accessToken: options.access.hockeyAppToken, appId: options.access.hockeyAppId }, symbolsPath)];
                case 5:
                    _a.sent();
                    // Cleanup
                    return [4 /*yield*/, util_1.promisify(fs_1.unlink)(symbolsPath)];
                case 6:
                    // Cleanup
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Environment
var pakage = require('../../../package.json');
var product = require('../../../product.json');
var repository = product.electronRepository;
var electronVersion = require('../../lib/electron').getElectronVersion();
var insiders = product.quality !== 'stable';
var codeVersion = pakage.version;
if (insiders) {
    codeVersion = codeVersion + "-insider";
}
var githubToken = process.argv[2];
var hockeyAppToken = process.argv[3];
var is64 = process.argv[4] === 'x64';
var hockeyAppId = process.argv[5];
var platform;
if (process.platform === 'darwin') {
    platform = Platform.MAC_OS;
}
else if (process.platform === 'win32') {
    platform = is64 ? Platform.WIN_64 : Platform.WIN_32;
}
else {
    platform = is64 ? Platform.LINUX_64 : Platform.LINUX_32;
}
// Create version and upload symbols in HockeyApp
if (repository && codeVersion && electronVersion && (product.quality === 'stable' || product.quality === 'insider')) {
    ensureVersionAndSymbols({
        repository: repository,
        platform: platform,
        versions: {
            code: codeVersion,
            insiders: insiders,
            electron: electronVersion
        },
        access: {
            githubToken: githubToken,
            hockeyAppToken: hockeyAppToken,
            hockeyAppId: hockeyAppId
        }
    }).then(function () {
        console.log('HockeyApp: done');
    }).catch(function (error) {
        console.error("HockeyApp: error (" + error + ")");
    });
}
else {
    console.log("HockeyApp: skipping due to unexpected context (repository: " + repository + ", codeVersion: " + codeVersion + ", electronVersion: " + electronVersion + ", quality: " + product.quality + ")");
}
