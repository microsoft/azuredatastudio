/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ConnectionConstants from 'sql/platform/connection/common/constants';
import { QueryInput } from 'sql/workbench/parts/query/common/queryInput';

import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { URI } from 'vs/base/common/uri';
import { IEditorInput } from 'vs/workbench/common/editor';

/**
 * Gets the 'sql' configuration section for use in looking up settings. Note that configs under
 * 'mssql' or other sections are not available from this.
 */
export function getSqlConfigSection(workspaceConfigService: IConfigurationService, sectionName: string): any {
	let config = workspaceConfigService.getValue(ConnectionConstants.sqlConfigSectionName);
	return config ? config[sectionName] : {};
}

export function getSqlConfigValue<T>(workspaceConfigService: IConfigurationService, configName: string): T {
	let config = workspaceConfigService.getValue(ConnectionConstants.sqlConfigSectionName);
	return config[configName];
}

export function getEditorUri(input: IEditorInput): string {
	let uri: URI;
	if (input instanceof QueryInput) {
		let queryCast: QueryInput = <QueryInput>input;
		if (queryCast) {
			uri = queryCast.getResource();
		}
	}

	if (uri) {
		return uri.toString();
	}
	return undefined;
}
