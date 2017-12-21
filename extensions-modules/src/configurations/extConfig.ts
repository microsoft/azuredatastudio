/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import Config from './config';
import { workspace, WorkspaceConfiguration } from 'vscode';
import { IConfig } from '../languageservice/interfaces';
import { Constants } from '../models/constants';

/*
* ExtConfig class handles getting values from workspace config or config.json.
*/
export default class ExtConfig implements IConfig {

    constructor(private _extensionConfigSectionName: string, private _config?: IConfig,
                path?: string,
                private _extensionConfig?: WorkspaceConfiguration,
                private _workspaceConfig?: WorkspaceConfiguration) {
        if (this._config === undefined) {
            this._config = new Config(_extensionConfigSectionName, path);
        }
        if (this._extensionConfig === undefined) {
            this._extensionConfig = workspace.getConfiguration(_extensionConfigSectionName);
        }
        if (this._workspaceConfig === undefined) {
            this._workspaceConfig = workspace.getConfiguration();
        }
    }

    public getDownloadUrl(): string {
       return this.getConfigValue(Constants.downloadUrlConfigKey);
    }

    public getInstallDirectory(): string {
        return this.getConfigValue(Constants.installDirConfigKey);
    }

    public getExecutableFiles(): string[] {
        return this.getConfigValue(Constants.executableFilesConfigKey);
    }

    public getPackageVersion(): string {
        return this.getConfigValue(Constants.versionConfigKey);
    }

    public getConfigValue(configKey: string): any {
        let configValue: string = <string>this.getExtensionConfig(`${Constants.serviceConfigKey}.${configKey}`);
        if (!configValue) {
            configValue = this._config.getConfigValue(configKey);
        }
        return configValue;
    }

    public getExtensionConfig(key: string, defaultValue?: any): any {
        let configValue = this._extensionConfig.get(key);
        if (configValue === undefined) {
            configValue = defaultValue;
        }
        return configValue;
    }

    public getWorkspaceConfig(key: string, defaultValue?: any): any {
        let configValue =  this._workspaceConfig.get(key);
        if (configValue === undefined) {
            configValue = defaultValue;
        }
        return configValue;
    }

    public updateWorkspaceConfig(configKey: string, configValue: any) {
        this._workspaceConfig.update(configKey, configValue, true);
    }
}
