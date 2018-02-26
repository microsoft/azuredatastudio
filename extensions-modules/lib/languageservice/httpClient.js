/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const interfaces_1 = require("./interfaces");
const url_1 = require("url");
const https = require("https");
const http = require("http");
const proxy_1 = require("./proxy");
const fs = require('fs');
/*
 * Http client class to handle downloading files using http or https urls
 */
class HttpClient {
    /*
     * Downloads a file and stores the result in the temp file inside the package object
     */
    downloadFile(urlString, pkg, logger, statusView, proxy, strictSSL) {
        const url = url_1.parse(urlString);
        let options = this.getHttpClientOptions(url, proxy, strictSSL);
        let clientRequest = url.protocol === 'http:' ? http.request : https.request;
        return new Promise((resolve, reject) => {
            if (!pkg.tmpFile || pkg.tmpFile.fd === 0) {
                return reject(new interfaces_1.PackageError('Temporary package file unavailable', pkg));
            }
            let request = clientRequest(options, response => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    // Redirect - download from new location
                    return resolve(this.downloadFile(response.headers.location, pkg, logger, statusView, proxy, strictSSL));
                }
                if (response.statusCode !== 200) {
                    // Download failed - print error message
                    logger.appendLine(`failed (error code '${response.statusCode}')`);
                    return reject(new interfaces_1.PackageError(response.statusCode.toString(), pkg));
                }
                // If status code is 200
                this.handleSuccessfulResponse(pkg, response, logger, statusView).then(_ => {
                    resolve();
                }).catch(err => {
                    reject(err);
                });
            });
            request.on('error', error => {
                // reject(new PackageError(`Request error: ${error.code || 'NONE'}`, pkg, error));
                reject(new interfaces_1.PackageError(`Request error: ${error.name || 'NONE'}`, pkg, error));
            });
            // Execute the request
            request.end();
        });
    }
    getHttpClientOptions(url, proxy, strictSSL) {
        const agent = proxy_1.getProxyAgent(url, proxy, strictSSL);
        let options = {
            host: url.hostname,
            path: url.path,
            agent: agent,
            port: +url.port
        };
        if (url.protocol === 'https:') {
            let httpsOptions = {
                host: url.hostname,
                path: url.path,
                agent: agent,
                port: +url.port
            };
            options = httpsOptions;
        }
        return options;
    }
    /*
     * Calculate the download percentage and stores in the progress object
     */
    handleDataReceivedEvent(progress, data, logger, statusView) {
        progress.downloadedBytes += data.length;
        // Update status bar item with percentage
        if (progress.packageSize > 0) {
            let newPercentage = Math.ceil(100 * (progress.downloadedBytes / progress.packageSize));
            if (newPercentage !== progress.downloadPercentage) {
                statusView.updateServiceDownloadingProgress(progress.downloadPercentage);
                progress.downloadPercentage = newPercentage;
            }
            // Update dots after package name in output console
            let newDots = Math.ceil(progress.downloadPercentage / 5);
            if (newDots > progress.dots) {
                logger.append('.'.repeat(newDots - progress.dots));
                progress.dots = newDots;
            }
        }
        return;
    }
    handleSuccessfulResponse(pkg, response, logger, statusView) {
        return new Promise((resolve, reject) => {
            let progress = {
                packageSize: parseInt(response.headers['content-length'], 10),
                dots: 0,
                downloadedBytes: 0,
                downloadPercentage: 0
            };
            logger.append(`(${Math.ceil(progress.packageSize / 1024)} KB) `);
            response.on('data', data => {
                this.handleDataReceivedEvent(progress, data, logger, statusView);
            });
            let tmpFile = fs.createWriteStream(undefined, { fd: pkg.tmpFile.fd });
            response.on('end', () => {
                resolve();
            });
            response.on('error', err => {
                reject(new interfaces_1.PackageError(`Response error: ${err.name || 'NONE'}`, pkg, err));
            });
            // Begin piping data from the response to the package file
            response.pipe(tmpFile, { end: false });
        });
    }
}
exports.default = HttpClient;
//# sourceMappingURL=httpClient.js.map