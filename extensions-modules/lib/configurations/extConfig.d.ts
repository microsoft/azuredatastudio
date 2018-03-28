import { WorkspaceConfiguration } from 'vscode';
import { IConfig } from '../languageservice/interfaces';
export default class ExtConfig implements IConfig {
    private _extensionConfigSectionName;
    private _config;
    private _extensionConfig;
    private _workspaceConfig;
    constructor(_extensionConfigSectionName: string, _config?: IConfig, path?: string, _extensionConfig?: WorkspaceConfiguration, _workspaceConfig?: WorkspaceConfiguration);
    getDownloadUrl(): string;
    getInstallDirectory(): string;
    getExecutableFiles(): string[];
    getPackageVersion(): string;
    getConfigValue(configKey: string): any;
    getExtensionConfig(key: string, defaultValue?: any): any;
    getWorkspaceConfig(key: string, defaultValue?: any): any;
    updateWorkspaceConfig(configKey: string, configValue: any): void;
}
