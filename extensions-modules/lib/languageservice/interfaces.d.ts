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
export declare class PackageError extends Error {
    message: string;
    pkg: IPackage;
    innerError: any;
    constructor(message: string, pkg?: IPackage, innerError?: any);
}
export interface IHttpClient {
    downloadFile(urlString: string, pkg: IPackage, logger: ILogger, statusView: IStatusView, proxy: string, strictSSL: boolean): Promise<void>;
}
export interface IDecompressProvider {
    decompress(pkg: IPackage, logger: ILogger): Promise<void>;
}
