import { Runtime } from '../models/platform';
import { IConfig, IStatusView, IHttpClient, IDecompressProvider } from './interfaces';
import { ILogger } from '../models/interfaces';
import { IExtensionConstants } from '../models/contracts/contracts';
export default class ServiceDownloadProvider {
    private _config;
    private _logger;
    private _statusView;
    private _httpClient;
    private _decompressProvider;
    private _extensionConstants;
    private _fromBuild;
    constructor(_config: IConfig, _logger: ILogger, _statusView: IStatusView, _httpClient: IHttpClient, _decompressProvider: IDecompressProvider, _extensionConstants: IExtensionConstants, _fromBuild: boolean);
    /**
     * Returns the download url for given platform
     */
    getDownloadFileName(platform: Runtime): string;
    /**
     * Returns SQL tools service installed folder.
     */
    getInstallDirectory(platform: Runtime, extensionConfigSectionName: string): string;
    private getLocalUserFolderPath(platform);
    /**
     * Returns SQL tools service installed folder root.
     */
    getInstallDirectoryRoot(platform: Runtime, extensionConfigSectionName: string): string;
    private getGetDownloadUrl(fileName);
    /**
     * Downloads the service and decompress it in the install folder.
     */
    installService(platform: Runtime): Promise<boolean>;
    private createTempFile(pkg);
    private install(pkg);
}
