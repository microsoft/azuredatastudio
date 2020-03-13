/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from '../common/constants';

import { newSqlTableTemplate } from './newTableTemplate';
import { newSqlViewTemplate } from './newViewTemplate';
import { newSqlStoredProcedureTemplate } from './newStoredProcedureTemplate';

export class ProjectScriptType {
	type: string;
	friendlyName: string;
	templateScript: string;

	constructor(type: string, friendlyName: string, templateScript: string) {
		this.type = type;
		this.friendlyName = friendlyName;
		this.templateScript = templateScript;
	}
}

export const table: string = 'table';
export const view: string = 'view';
export const storedProcedure: string = 'storedProcedure';

export const projectScriptTypes: ProjectScriptType[] = [
	new ProjectScriptType(table, constants.tableFriendlyName, newSqlTableTemplate),
	new ProjectScriptType(view, constants.viewFriendlyName, newSqlViewTemplate),
	new ProjectScriptType(storedProcedure, constants.storedProcedureFriendlyName, newSqlStoredProcedureTemplate),
];

export const projectScriptTypeMap: Record<string, ProjectScriptType> = {};

for (const scriptType of projectScriptTypes) {
	projectScriptTypeMap[scriptType.type] = scriptType;
}
