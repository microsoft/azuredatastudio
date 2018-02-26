import { IConfig } from '../languageservice/interfaces';
export default class Config implements IConfig {
    private path;
    private _configJsonContent;
    private _extensionConfigSectionName;
    private _fromBuild;
    constructor(extensionConfigSectionName: string, path: string, fromBuild?: boolean);
    readonly configJsonContent: any;
    getDownloadUrl(): string;
    getInstallDirectory(): string;
    getExecutableFiles(): string[];
    getPackageVersion(): string;
    getConfigValue(configKey: string): any;
    getExtensionConfig(key: string, defaultValue?: any): any;
    getWorkspaceConfig(key: string, defaultValue?: any): any;
    loadConfig(): any;
}
