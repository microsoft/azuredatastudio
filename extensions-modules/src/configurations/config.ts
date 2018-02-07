/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
const fs = require('fs');
import * as path from 'path';
import { IConfig } from '../languageservice/interfaces';
import { Constants } from '../models/constants';

/*
* Config class handles getting values from config.json.
*/
export default class Config implements IConfig {
    private _configJsonContent: any = undefined;

    private _extensionConfigSectionName: string = undefined;
    private _fromBuild: boolean = undefined;

     constructor(extensionConfigSectionName: string, private path: string, fromBuild?: boolean) {
        this._extensionConfigSectionName = extensionConfigSectionName;
        this._fromBuild = fromBuild;
     }

    public get configJsonContent(): any {
        if (this._configJsonContent === undefined) {
            this._configJsonContent = this.loadConfig();
        }
        return this._configJsonContent;
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
        let json = this.configJsonContent;
        let toolsConfig = json[Constants.serviceConfigKey];
        let configValue: string = undefined;
        if (toolsConfig !== undefined) {
            configValue = toolsConfig[configKey];
        }
        return configValue;
    }

    public getExtensionConfig(key: string, defaultValue?: any): any {
       let json = this.configJsonContent;
       let extensionConfig = json[this._extensionConfigSectionName];
       let configValue = extensionConfig[key];
       if (!configValue) {
           configValue = defaultValue;
       }
       return configValue;
    }

    public getWorkspaceConfig(key: string, defaultValue?: any): any {
       let json = this.configJsonContent;
       let configValue = json[key];
       if (!configValue) {
           configValue = defaultValue;
       }
       return configValue;
    }

    public loadConfig(): any {
        let configContent = undefined;
        if (this._fromBuild) {
            let remainingPath = '../../../extensions/' + this._extensionConfigSectionName + '/client/out/config.json';
            configContent = fs.readFileSync(path.join(__dirname, remainingPath));
        }
        else {
            configContent = fs.readFileSync(this.path);
        }
        return JSON.parse(configContent);
    }
}
