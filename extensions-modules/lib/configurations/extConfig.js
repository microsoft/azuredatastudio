/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const vscode_1 = require("vscode");
const constants_1 = require("../models/constants");
/*
* ExtConfig class handles getting values from workspace config or config.json.
*/
class ExtConfig {
    constructor(_extensionConfigSectionName, _config, path, _extensionConfig, _workspaceConfig) {
        this._extensionConfigSectionName = _extensionConfigSectionName;
        this._config = _config;
        this._extensionConfig = _extensionConfig;
        this._workspaceConfig = _workspaceConfig;
        if (this._config === undefined) {
            this._config = new config_1.default(_extensionConfigSectionName, path);
        }
        if (this._extensionConfig === undefined) {
            this._extensionConfig = vscode_1.workspace.getConfiguration(_extensionConfigSectionName);
        }
        if (this._workspaceConfig === undefined) {
            this._workspaceConfig = vscode_1.workspace.getConfiguration();
        }
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
        let configValue = this.getExtensionConfig(`${constants_1.Constants.serviceConfigKey}.${configKey}`);
        if (!configValue) {
            configValue = this._config.getConfigValue(configKey);
        }
        return configValue;
    }
    getExtensionConfig(key, defaultValue) {
        let configValue = this._extensionConfig.get(key);
        if (configValue === undefined) {
            configValue = defaultValue;
        }
        return configValue;
    }
    getWorkspaceConfig(key, defaultValue) {
        let configValue = this._workspaceConfig.get(key);
        if (configValue === undefined) {
            configValue = defaultValue;
        }
        return configValue;
    }
    updateWorkspaceConfig(configKey, configValue) {
        this._workspaceConfig.update(configKey, configValue, true);
    }
}
exports.default = ExtConfig;
//# sourceMappingURL=extConfig.js.map