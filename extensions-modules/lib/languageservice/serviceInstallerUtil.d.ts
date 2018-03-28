import { Runtime } from '../models/platform';
import { IExtensionConstants } from '../models/contracts/contracts';
export declare class ServiceInstaller {
    private _config;
    private _logger;
    private _statusView;
    private _httpClient;
    private _decompressProvider;
    private _downloadProvider;
    private _serverProvider;
    private _extensionConstants;
    constructor(extensionConstants: IExtensionConstants, path?: string);
    installService(): Promise<String>;
    getServiceInstallDirectory(runtime: Runtime): Promise<string>;
    getServiceInstallDirectoryRoot(runtime: Runtime): Promise<string>;
}
