"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const platform_1 = require("../models/platform");
const config_1 = require("../configurations/config");
const serviceDownloadProvider_1 = require("./serviceDownloadProvider");
const decompressProvider_1 = require("./decompressProvider");
const httpClient_1 = require("./httpClient");
const server_1 = require("./server");
class StubStatusView {
    installingService() {
        console.log('...');
    }
    serviceInstalled() {
        console.log('Service installed');
    }
    serviceInstallationFailed() {
        console.log('Service installation failed');
    }
    updateServiceDownloadingProgress(downloadPercentage) {
        if (downloadPercentage === 100) {
            process.stdout.write('100%');
        }
    }
}
class StubLogger {
    logDebug(message) {
        console.log(message);
    }
    increaseIndent() {
        console.log('increaseIndent');
    }
    decreaseIndent() {
        console.log('decreaseIndent');
    }
    append(message) {
        process.stdout.write(message);
    }
    appendLine(message) {
        console.log(message);
    }
}
class ServiceInstaller {
    constructor(extensionConstants, path) {
        this._config = undefined;
        this._logger = new StubLogger();
        this._statusView = new StubStatusView();
        this._httpClient = new httpClient_1.default();
        this._decompressProvider = new decompressProvider_1.default();
        this._downloadProvider = undefined;
        this._serverProvider = undefined;
        this._extensionConstants = undefined;
        this._extensionConstants = extensionConstants;
        this._config = new config_1.default(extensionConstants.extensionConfigSectionName, path, true);
        this._downloadProvider = new serviceDownloadProvider_1.default(this._config, this._logger, this._statusView, this._httpClient, this._decompressProvider, extensionConstants, true);
        this._serverProvider = new server_1.default(this._downloadProvider, this._config, this._statusView, extensionConstants.extensionConfigSectionName);
    }
    /*
    * Installs the service for the given platform if it's not already installed.
    */
    installService() {
        return platform_1.PlatformInformation.getCurrent(this._extensionConstants.getRuntimeId, this._extensionConstants.extensionName).then(platformInfo => {
            if (platformInfo.isValidRuntime()) {
                return this._serverProvider.getOrDownloadServer(platformInfo.runtimeId);
            }
            else {
                throw new Error('unsupported runtime');
            }
        });
    }
    /*
    * Returns the install folder path for given platform.
    */
    getServiceInstallDirectory(runtime) {
        return new Promise((resolve, reject) => {
            if (runtime === undefined) {
                platform_1.PlatformInformation.getCurrent(this._extensionConstants.getRuntimeId, this._extensionConstants.extensionName).then(platformInfo => {
                    if (platformInfo.isValidRuntime()) {
                        resolve(this._downloadProvider.getInstallDirectory(platformInfo.runtimeId));
                    }
                    else {
                        reject('unsupported runtime');
                    }
                }).catch(error => {
                    reject(error);
                });
            }
            else {
                resolve(this._downloadProvider.getInstallDirectory(runtime));
            }
        });
    }
    /*
    * Returns the path to the root folder of service install location.
    */
    getServiceInstallDirectoryRoot(runtime) {
        return new Promise((resolve, reject) => {
            if (runtime === undefined) {
                platform_1.PlatformInformation.getCurrent(this._extensionConstants.getRuntimeId, this._extensionConstants.extensionName).then(platformInfo => {
                    if (platformInfo.isValidRuntime()) {
                        let directoryPath = this._downloadProvider.getInstallDirectoryRoot(platformInfo, this._extensionConstants.extensionName);
                        directoryPath = directoryPath.replace('\\{#version#}', '');
                        directoryPath = directoryPath.replace('\\{#platform#}', '');
                        directoryPath = directoryPath.replace('/{#platform#}', '');
                        directoryPath = directoryPath.replace('/{#version#}', '');
                        resolve(directoryPath);
                    }
                    else {
                        reject('unsupported runtime');
                    }
                }).catch(error => {
                    reject(error);
                });
            }
            else {
                resolve(this._downloadProvider.getInstallDirectory(runtime));
            }
        });
    }
}
exports.ServiceInstaller = ServiceInstaller;
//# sourceMappingURL=serviceInstallerUtil.js.map