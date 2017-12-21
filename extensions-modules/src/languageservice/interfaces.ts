/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as tmp from 'tmp';
import { ILogger } from '../models/interfaces';

export interface IStatusView {
    installingService(): void;
    serviceInstalled(): void;
    serviceInstallationFailed(): void;
    updateServiceDownloadingProgress(downloadPercentage: number): void;
}

export interface IConfig {
    getDownloadUrl(): string;
    getInstallDirectory(): string;
    getExecutableFiles(): string[];
    getPackageVersion(): string;
    getExtensionConfig(key: string, defaultValue?: any): any;
    getWorkspaceConfig(key: string, defaultValue?: any): any;
    getConfigValue(configKey: string): any;
}

export interface IPackage {
    url: string;
    installPath?: string;
    tmpFile: tmp.SynchronousResult;
}

export class PackageError extends Error {
    // Do not put PII (personally identifiable information) in the 'message' field as it will be logged to telemetry
    constructor(public message: string,
                public pkg: IPackage = undefined,
                public innerError: any = undefined) {
        super(message);
    }
}

export interface IHttpClient {
    downloadFile(urlString: string, pkg: IPackage, logger: ILogger, statusView: IStatusView, proxy: string, strictSSL: boolean): Promise<void>;
}

export interface IDecompressProvider {
    decompress(pkg: IPackage, logger: ILogger): Promise<void>;
}
