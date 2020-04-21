/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as constants from '../common/constants';
import { promises as fs } from 'fs';

export let newSqlProjectTemplate: string;

// Object types

export const script: string = 'script';
export const table: string = 'table';
export const view: string = 'view';
export const storedProcedure: string = 'storedProcedure';
export const folder: string = 'folder';

// Object maps

export const projectScriptTypeMap: Record<string, ProjectScriptType> = {};
export const projectScriptTypes: ProjectScriptType[] = [];

export async function loadTemplates(templateFolderPath: string) {

	newSqlProjectTemplate = await loadTemplate(templateFolderPath, 'newSqlProjectTemplate.xml');

	await loadObjectTypeInfo(script, constants.scriptFriendlyName, templateFolderPath, 'newTsqlScriptTemplate.sql');
	await loadObjectTypeInfo(table, constants.tableFriendlyName, templateFolderPath, 'newTsqlTableTemplate.sql');
	await loadObjectTypeInfo(view, constants.viewFriendlyName, templateFolderPath, 'newTsqlViewTemplate.sql');
	await loadObjectTypeInfo(storedProcedure, constants.storedProcedureFriendlyName, templateFolderPath, 'newTsqlStoredProcedureTemplate.sql');

	for (const scriptType of projectScriptTypes) {
		if (Object.keys(projectScriptTypeMap).find(s => s === scriptType.type.toLocaleLowerCase() || s === scriptType.friendlyName.toLocaleLowerCase())) {
			throw new Error(`Script type map already contains ${scriptType.type} or its friendlyName.`);
		}

		projectScriptTypeMap[scriptType.type.toLocaleLowerCase()] = scriptType;
		projectScriptTypeMap[scriptType.friendlyName.toLocaleLowerCase()] = scriptType;
	}
}

async function loadObjectTypeInfo(key: string, friendlyName: string, templateFolderPath: string, fileName: string) {
	const template = await loadTemplate(templateFolderPath, fileName);
	projectScriptTypes.push(new ProjectScriptType(key, friendlyName, template));
}

async function loadTemplate(templateFolderPath: string, fileName: string): Promise<string> {
	return (await fs.readFile(path.join(templateFolderPath, fileName))).toString();
}

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
