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

let scriptTypeMap: Record<string, ProjectScriptType> = {};

export function projectScriptTypeMap(): Record<string, ProjectScriptType> {
	if (Object.keys(scriptTypeMap).length === 0) {
		throw new Error('Templates must be loaded from file before attempting to use.');
	}

	return scriptTypeMap;
}

let scriptTypes: ProjectScriptType[] = [];

export function projectScriptTypes(): ProjectScriptType[] {
	if (scriptTypes.length === 0) {
		throw new Error('Templates must be loaded from file before attempting to use.');
	}

	return scriptTypes;
}

export async function loadTemplates(templateFolderPath: string) {
	await Promise.all([
		Promise.resolve(newSqlProjectTemplate = await loadTemplate(templateFolderPath, 'newSqlProjectTemplate.xml')),
		loadObjectTypeInfo(script, constants.scriptFriendlyName, templateFolderPath, 'newTsqlScriptTemplate.sql'),
		loadObjectTypeInfo(table, constants.tableFriendlyName, templateFolderPath, 'newTsqlTableTemplate.sql'),
		loadObjectTypeInfo(view, constants.viewFriendlyName, templateFolderPath, 'newTsqlViewTemplate.sql'),
		loadObjectTypeInfo(storedProcedure, constants.storedProcedureFriendlyName, templateFolderPath, 'newTsqlStoredProcedureTemplate.sql')
	]);

	for (const scriptType of scriptTypes) {
		if (Object.keys(projectScriptTypeMap).find(s => s === scriptType.type.toLocaleLowerCase() || s === scriptType.friendlyName.toLocaleLowerCase())) {
			throw new Error(`Script type map already contains ${scriptType.type} or its friendlyName.`);
		}

		scriptTypeMap[scriptType.type.toLocaleLowerCase()] = scriptType;
		scriptTypeMap[scriptType.friendlyName.toLocaleLowerCase()] = scriptType;
	}
}

async function loadObjectTypeInfo(key: string, friendlyName: string, templateFolderPath: string, fileName: string) {
	const template = await loadTemplate(templateFolderPath, fileName);
	scriptTypes.push(new ProjectScriptType(key, friendlyName, template));
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

/**
 * For testing purposes only
 */
export function reset() {
	scriptTypeMap = {};
	scriptTypes = [];
}
