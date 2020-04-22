/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from '../common/constants';
import * as templates from './templates';

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

export const script: string = 'script';
export const table: string = 'table';
export const view: string = 'view';
export const storedProcedure: string = 'storedProcedure';
export const folder: string = 'folder';

export const projectScriptTypes: ProjectScriptType[] = [
	new ProjectScriptType(script, constants.scriptFriendlyName, templates.newSqlScriptTemplate),
	new ProjectScriptType(table, constants.tableFriendlyName, templates.newSqlTableTemplate),
	new ProjectScriptType(view, constants.viewFriendlyName, templates.newSqlViewTemplate),
	new ProjectScriptType(storedProcedure, constants.storedProcedureFriendlyName, templates.newSqlStoredProcedureTemplate),
];

export const projectScriptTypeMap: Record<string, ProjectScriptType> = {};

for (const scriptType of projectScriptTypes) {
	if (Object.keys(projectScriptTypeMap).find(s => s === scriptType.type.toLocaleLowerCase() || s === scriptType.friendlyName.toLocaleLowerCase())) {
		throw new Error(`Script type map already contains ${scriptType.type} or its friendlyName.`);
	}

	projectScriptTypeMap[scriptType.type.toLocaleLowerCase()] = scriptType;
	projectScriptTypeMap[scriptType.friendlyName.toLocaleLowerCase()] = scriptType;
}
