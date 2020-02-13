/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ConnectionConstants from 'sql/platform/connection/common/constants';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

/**
 * Gets the 'sql' configuration section for use in looking up settings. Note that configs under
 * 'mssql' or other sections are not available from this.
 */
export function getSqlConfigSection(workspaceConfigService: IConfigurationService, sectionName: string): any {
	let config = workspaceConfigService.getValue<{ [key: string]: any }>(ConnectionConstants.sqlConfigSectionName);
	return config ? config[sectionName] : {};
}

export function getSqlConfigValue<T>(workspaceConfigService: IConfigurationService, configName: string): T {
	let config = workspaceConfigService.getValue<{ [key: string]: any }>(ConnectionConstants.sqlConfigSectionName);
	return config[configName];
}
