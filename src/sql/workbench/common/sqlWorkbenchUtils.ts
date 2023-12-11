/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
	return config ? config[configName] : undefined;
}

/**
 * Wraps provided string using \n that qualifies as line break to wrap text in title attributes (tooltips).
 * @param str string to be wrapped
 * @param maxWidth max width to be allowed for wrapped text
 * @returns wrapped string
 */
export function wrapStringWithNewLine(str: string | undefined, maxWidth: number): string | undefined {
	if (!str) {
		return str;
	}
	let newLineStr = `\n`;
	let res = '';
	while (str.length > maxWidth) {
		let found = false;
		// Inserts new line at first whitespace of the line
		for (let i = maxWidth - 1; i >= 0; i--) {
			if (testWhitespace(str.charAt(i))) {
				res = res + [str.slice(0, i), newLineStr].join('');
				str = str.slice(i + 1);
				found = true;
				break;
			}
		}
		// Inserts new line at maxWidth position, the word is too long to wrap
		if (!found) {
			res += [str.slice(0, maxWidth), newLineStr].join('');
			str = str.slice(maxWidth);
		}
	}
	return res + str;
}

function testWhitespace(x: string) {
	var white = new RegExp(/^\s$/);
	return white.test(x.charAt(0));
}
