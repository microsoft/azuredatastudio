/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('fs');
const path = require("path");
const constants_1 = require("../models/constants");
/*
* Config class handles getting values from config.json.
*/
class Config {
    constructor(extensionConfigSectionName, path, fromBuild) {
        this.path = path;
        this._configJsonContent = undefined;
        this._extensionConfigSectionName = undefined;
        this._fromBuild = undefined;
        this._extensionConfigSectionName = extensionConfigSectionName;
        this._fromBuild = fromBuild;
    }
    get configJsonContent() {
        if (this._configJsonContent === undefined) {
            this._configJsonContent = this.loadConfig();
        }
        return this._configJsonContent;
    }
    getDownloadUrl() {
        return this.getConfigValue(constants_1.Constants.downloadUrlConfigKey);
    }
    getInstallDirectory() {
        return this.getConfigValue(constants_1.Constants.installDirConfigKey);
    }
    getExecutableFiles() {
        return this.getConfigValue(constants_1.Constants.executableFilesConfigKey);
    }
    getPackageVersion() {
        return this.getConfigValue(constants_1.Constants.versionConfigKey);
    }
    getConfigValue(configKey) {
        let json = this.configJsonContent;
        let toolsConfig = json[constants_1.Constants.serviceConfigKey];
        let configValue = undefined;
        if (toolsConfig !== undefined) {
            configValue = toolsConfig[configKey];
        }
        return configValue;
    }
    getExtensionConfig(key, defaultValue) {
        let json = this.configJsonContent;
        let extensionConfig = json[this._extensionConfigSectionName];
        let configValue = extensionConfig[key];
        if (!configValue) {
            configValue = defaultValue;
        }
        return configValue;
    }
    getWorkspaceConfig(key, defaultValue) {
        let json = this.configJsonContent;
        let configValue = json[key];
        if (!configValue) {
            configValue = defaultValue;
        }
        return configValue;
    }
    loadConfig() {
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
exports.default = Config;
//# sourceMappingURL=config.js.map