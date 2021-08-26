/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { URI } from 'vs/base/common/uri';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { refineServiceDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';
import { ResourceMap } from 'vs/base/common/map';

// {{SQL CARBON EDIT}}
export const FOLDER_CONFIG_FOLDER_NAME = '.azuredatastudio';
export const TASKS_FOLDER_CONFIG_FOLDER_NAME = '.vscode';
export const FOLDER_SETTINGS_NAME = 'settings';
export const FOLDER_SETTINGS_PATH = `${FOLDER_CONFIG_FOLDER_NAME}/${FOLDER_SETTINGS_NAME}.json`;

export const defaultSettingsSchemaId = 'vscode://schemas/settings/default';
export const userSettingsSchemaId = 'vscode://schemas/settings/user';
export const machineSettingsSchemaId = 'vscode://schemas/settings/machine';
export const workspaceSettingsSchemaId = 'vscode://schemas/settings/workspace';
export const folderSettingsSchemaId = 'vscode://schemas/settings/folder';
export const launchSchemaId = 'vscode://schemas/launch';
export const tasksSchemaId = 'vscode://schemas/tasks';

export const LOCAL_MACHINE_SCOPES = [ConfigurationScope.APPLICATION, ConfigurationScope.WINDOW, ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE];
export const REMOTE_MACHINE_SCOPES = [ConfigurationScope.MACHINE, ConfigurationScope.WINDOW, ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE, ConfigurationScope.MACHINE_OVERRIDABLE];
export const WORKSPACE_SCOPES = [ConfigurationScope.WINDOW, ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE, ConfigurationScope.MACHINE_OVERRIDABLE];
export const FOLDER_SCOPES = [ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE, ConfigurationScope.MACHINE_OVERRIDABLE];

export const TASKS_CONFIGURATION_KEY = 'tasks';
export const LAUNCH_CONFIGURATION_KEY = 'launch';

export const WORKSPACE_STANDALONE_CONFIGURATIONS = Object.create(null);
WORKSPACE_STANDALONE_CONFIGURATIONS[TASKS_CONFIGURATION_KEY] = `${TASKS_FOLDER_CONFIG_FOLDER_NAME}/${TASKS_CONFIGURATION_KEY}.json`;
WORKSPACE_STANDALONE_CONFIGURATIONS[LAUNCH_CONFIGURATION_KEY] = `${FOLDER_CONFIG_FOLDER_NAME}/${LAUNCH_CONFIGURATION_KEY}.json`;
export const USER_STANDALONE_CONFIGURATIONS = Object.create(null);
USER_STANDALONE_CONFIGURATIONS[TASKS_CONFIGURATION_KEY] = `${TASKS_CONFIGURATION_KEY}.json`;

export type ConfigurationKey = { type: 'user' | 'workspaces' | 'folder', key: string };

export interface IConfigurationCache {

	needsCaching(resource: URI): boolean;
	read(key: ConfigurationKey): Promise<string>;
	write(key: ConfigurationKey, content: string): Promise<void>;
	remove(key: ConfigurationKey): Promise<void>;

}

export type RestrictedSettings = {
	default: ReadonlyArray<string>;
	userLocal?: ReadonlyArray<string>;
	userRemote?: ReadonlyArray<string>;
	workspace?: ReadonlyArray<string>;
	workspaceFolder?: ResourceMap<ReadonlyArray<string>>;
};

export const IWorkbenchConfigurationService = refineServiceDecorator<IConfigurationService, IWorkbenchConfigurationService>(IConfigurationService);
export interface IWorkbenchConfigurationService extends IConfigurationService {
	/**
	 * Restricted settings defined in each configuraiton target
	 */
	readonly restrictedSettings: RestrictedSettings;

	/**
	 * Event that triggers when the restricted settings changes
	 */
	readonly onDidChangeRestrictedSettings: Event<RestrictedSettings>;

	/**
	 * A promise that resolves when the remote configuration is loaded in a remote window.
	 * The promise is resolved immediately if the window is not remote.
	 */
	whenRemoteConfigurationLoaded(): Promise<void>;
}

export const TASKS_DEFAULT = '{\n\t\"version\": \"2.0.0\",\n\t\"tasks\": []\n}';
