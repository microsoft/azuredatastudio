/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const platform_1 = require("../models/platform");
const path = require("path");
const interfaces_1 = require("./interfaces");
const constants_1 = require("../models/constants");
const tmp = require("tmp");
const fse = require('fs-extra');
/*
* Service Download Provider class which handles downloading the SQL Tools service.
*/
class ServiceDownloadProvider {
    constructor(_config, _logger, _statusView, _httpClient, _decompressProvider, _extensionConstants, _fromBuild) {
        this._config = _config;
        this._logger = _logger;
        this._statusView = _statusView;
        this._httpClient = _httpClient;
        this._decompressProvider = _decompressProvider;
        this._extensionConstants = _extensionConstants;
        this._fromBuild = _fromBuild;
        // Ensure our temp files get cleaned up in case of error.
        tmp.setGracefulCleanup();
    }
    /**
     * Returns the download url for given platform
     */
    getDownloadFileName(platform) {
        let fileNamesJson = this._config.getConfigValue('downloadFileNames');
        console.info('Platform: ', platform.toString());
        let fileName = fileNamesJson[platform.toString()];
        console.info('Filename: ', fileName);
        if (fileName === undefined) {
            if (process.platform === 'linux') {
                throw new Error('Unsupported linux distribution');
            }
            else {
                throw new Error(`Unsupported platform: ${process.platform}`);
            }
        }
        return fileName;
    }
    /**
     * Returns SQL tools service installed folder.
     */
    getInstallDirectory(platform, extensionConfigSectionName) {
        let basePath = this.getInstallDirectoryRoot(platform, extensionConfigSectionName);
        let versionFromConfig = this._config.getPackageVersion();
        basePath = basePath.replace('{#version#}', versionFromConfig);
        basePath = basePath.replace('{#platform#}', platform_1.getRuntimeDisplayName(platform));
        if (!fse.existsSync(basePath)) {
            fse.mkdirsSync(basePath);
        }
        return basePath;
    }
    getLocalUserFolderPath(platform) {
        if (platform) {
            switch (platform) {
                case platform_1.Runtime.Windows_64:
                case platform_1.Runtime.Windows_86:
                    return process.env.APPDATA;
                case platform_1.Runtime.OSX:
                    return process.env.HOME + '/Library/Preferences';
                default:
                    return process.env.HOME;
            }
        }
    }
    /**
     * Returns SQL tools service installed folder root.
     */
    getInstallDirectoryRoot(platform, extensionConfigSectionName) {
        let installDirFromConfig;
        installDirFromConfig = this._config.getInstallDirectory();
        if (!installDirFromConfig || installDirFromConfig === '') {
            let rootFolderName = '.sqlops';
            if (platform === platform_1.Runtime.Windows_64 || platform === platform_1.Runtime.Windows_86) {
                rootFolderName = 'sqlops';
            }
            installDirFromConfig = path.join(this.getLocalUserFolderPath(platform), `/${rootFolderName}/${this._extensionConstants.installFolderName}/{#version#}/{#platform#}`);
        }
        let basePath;
        if (path.isAbsolute(installDirFromConfig)) {
            basePath = installDirFromConfig;
        }
        else if (this._fromBuild) {
            basePath = path.join(__dirname, '../../../extensions/' + extensionConfigSectionName + '/' + installDirFromConfig);
        }
        else {
            // The path from config is relative to the out folder
            basePath = path.join(__dirname, '../../../../' + extensionConfigSectionName + '/' + installDirFromConfig);
        }
        return basePath;
    }
    getGetDownloadUrl(fileName) {
        let baseDownloadUrl = this._config.getDownloadUrl();
        let version = this._config.getPackageVersion();
        baseDownloadUrl = baseDownloadUrl.replace('{#version#}', version);
        baseDownloadUrl = baseDownloadUrl.replace('{#fileName#}', fileName);
        return baseDownloadUrl;
    }
    /**
     * Downloads the service and decompress it in the install folder.
     */
    installService(platform) {
        const proxy = this._config.getWorkspaceConfig('http.proxy');
        const strictSSL = this._config.getWorkspaceConfig('http.proxyStrictSSL', true);
        return new Promise((resolve, reject) => {
            const fileName = this.getDownloadFileName(platform);
            const installDirectory = this.getInstallDirectory(platform, this._extensionConstants.extensionConfigSectionName);
            this._logger.appendLine(`${this._extensionConstants.serviceInstallingTo} ${installDirectory}.`);
            const urlString = this.getGetDownloadUrl(fileName);
            this._logger.appendLine(`${constants_1.Constants.serviceDownloading} ${urlString}`);
            let pkg = {
                installPath: installDirectory,
                url: urlString,
                tmpFile: undefined
            };
            this.createTempFile(pkg).then(tmpResult => {
                pkg.tmpFile = tmpResult;
                this._httpClient.downloadFile(pkg.url, pkg, this._logger, this._statusView, proxy, strictSSL).then(_ => {
                    this._logger.logDebug(`Downloaded to ${pkg.tmpFile.name}...`);
                    this._logger.appendLine(' Done!');
                    this.install(pkg).then(result => {
                        resolve(true);
                    }).catch(installError => {
                        reject(installError);
                    });
                }).catch(downloadError => {
                    this._logger.appendLine(`[ERROR] ${downloadError}`);
                    reject(downloadError);
                });
            });
        });
    }
    createTempFile(pkg) {
        return new Promise((resolve, reject) => {
            tmp.file({ prefix: 'package-' }, (err, path, fd, cleanupCallback) => {
                if (err) {
                    return reject(new interfaces_1.PackageError('Error from tmp.file', pkg, err));
                }
                resolve({ name: path, fd: fd, removeCallback: cleanupCallback });
            });
        });
    }
    install(pkg) {
        this._logger.appendLine('Installing ...');
        this._statusView.installingService();
        return new Promise((resolve, reject) => {
            this._decompressProvider.decompress(pkg, this._logger).then(_ => {
                this._statusView.serviceInstalled();
                resolve();
            }).catch(err => {
                reject(err);
            });
        });
    }
}
exports.default = ServiceDownloadProvider;
//# sourceMappingURL=serviceDownloadProvider.js.map