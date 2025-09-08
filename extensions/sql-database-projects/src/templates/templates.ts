/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as constants from '../common/constants';
import { promises as fs } from 'fs';
import { ItemType } from 'sqldbproj';

export let newSqlProjectTemplate: string;
export let newSdkSqlProjectTemplate: string;

// Object maps

let scriptTypeMap: Map<string, ProjectScriptType> = new Map();

export function get(key: string): ProjectScriptType {
	if (scriptTypeMap.size === 0) {
		throw new Error('Templates must be loaded from file before attempting to use.');
	}

	return scriptTypeMap.get(key.toLocaleLowerCase())!;
}

let scriptTypes: ProjectScriptType[] = [];

export function projectScriptTypes(): ProjectScriptType[] {
	if (scriptTypes.length === 0) {
		throw new Error('Templates must be loaded from file before attempting to use.');
	}

	return scriptTypes;
}

export async function loadTemplates(templateFolderPath: string) {
	reset();

	await Promise.all([
		Promise.resolve(newSqlProjectTemplate = await loadTemplate(templateFolderPath, 'newSqlProjectTemplate.xml')),
		Promise.resolve(newSdkSqlProjectTemplate = await loadTemplate(templateFolderPath, 'newSdkSqlProjectTemplate.xml')),
		loadObjectTypeInfo(ItemType.script, constants.scriptFriendlyName, templateFolderPath, 'newTsqlScriptTemplate.sql'),
		loadObjectTypeInfo(ItemType.table, constants.tableFriendlyName, templateFolderPath, 'newTsqlTableTemplate.sql'),
		loadObjectTypeInfo(ItemType.view, constants.viewFriendlyName, templateFolderPath, 'newTsqlViewTemplate.sql'),
		loadObjectTypeInfo(ItemType.storedProcedure, constants.storedProcedureFriendlyName, templateFolderPath, 'newTsqlStoredProcedureTemplate.sql'),
		loadObjectTypeInfo(ItemType.preDeployScript, constants.preDeployScriptFriendlyName, templateFolderPath, 'newTsqlPreDeployScriptTemplate.sql'),
		loadObjectTypeInfo(ItemType.postDeployScript, constants.postDeployScriptFriendlyName, templateFolderPath, 'newTsqlPostDeployScriptTemplate.sql'),
		loadObjectTypeInfo(ItemType.dataSource, constants.dataSourceFriendlyName, templateFolderPath, 'newTsqlDataSourceTemplate.sql'),
		loadObjectTypeInfo(ItemType.fileFormat, constants.fileFormatFriendlyName, templateFolderPath, 'newTsqlFileFormatTemplate.sql'),
		loadObjectTypeInfo(ItemType.externalStream, constants.externalStreamFriendlyName, templateFolderPath, 'newTsqlExternalStreamTemplate.sql'),
		loadObjectTypeInfo(ItemType.externalStreamingJob, constants.externalStreamingJobFriendlyName, templateFolderPath, 'newTsqlExternalStreamingJobTemplate.sql'),
		loadObjectTypeInfo(ItemType.publishProfile, constants.publishProfileFriendlyName, templateFolderPath, 'newPublishProfileTemplate.publish.xml'),
		loadObjectTypeInfo(ItemType.tasks, constants.tasksJsonFriendlyName, templateFolderPath, 'tasksTemplate.json')
	]);

	for (const scriptType of scriptTypes) {
		if (scriptTypeMap.has(scriptType.type.toLocaleLowerCase()) || scriptTypeMap.has(scriptType.friendlyName.toLocaleLowerCase())) {
			throw new Error(`Script type map already contains ${scriptType.type} or its friendlyName.`);
		}

		scriptTypeMap.set(scriptType.type.toLocaleLowerCase(), scriptType);
		scriptTypeMap.set(scriptType.friendlyName.toLocaleLowerCase(), scriptType);
	}
}

export function macroExpansion(template: string, macroDict: Map<string, string>): string {
	const macroIndicator = '@@';
	let output = template;

	for (const macro of macroDict.keys()) {
		// check if value contains the macroIndicator, which could break expansion for successive macros
		if (macroDict.get(macro)!.includes(macroIndicator)) {
			throw new Error(`Macro value ${macroDict.get(macro)} is invalid because it contains ${macroIndicator}`);
		}

		output = output.replace(new RegExp(macroIndicator + macro + macroIndicator, 'g'), macroDict.get(macro)!);
	}

	return output;
}

async function loadObjectTypeInfo(key: ItemType, friendlyName: string, templateFolderPath: string, fileName: string): Promise<string> {
	const template = await loadTemplate(templateFolderPath, fileName);
	scriptTypes.push(new ProjectScriptType(key, friendlyName, template));

	return key;
}

async function loadTemplate(templateFolderPath: string, fileName: string): Promise<string> {
	return (await fs.readFile(path.join(templateFolderPath, fileName))).toString();
}

export class ProjectScriptType {
	type: ItemType;
	friendlyName: string;
	templateScript: string;

	constructor(type: ItemType, friendlyName: string, templateScript: string) {
		this.type = type;
		this.friendlyName = friendlyName;
		this.templateScript = templateScript;
	}
}

/**
 * For testing purposes only
 */
export function reset() {
	scriptTypeMap = new Map();
	scriptTypes = [];
}
