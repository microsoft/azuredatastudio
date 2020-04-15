/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { promises as fs } from 'fs';

// Project templates
export let newSqlProjectTemplate: string;

// Script templates

export let newSqlScriptTemplate: string;
export let newSqlTableTemplate: string;
export let newSqlViewTemplate: string;
export let newSqlStoredProcedureTemplate: string;

export async function loadTemplates(templateFolderPath: string) {
	newSqlProjectTemplate = await loadTemplate(templateFolderPath, 'newSqlProjectTemplate.xml');

	newSqlScriptTemplate = await loadTemplate(templateFolderPath, 'newTSqlScriptTemplate.sql');
	newSqlTableTemplate = await loadTemplate(templateFolderPath, 'newTSqlTableTemplate.sql');
	newSqlViewTemplate = await loadTemplate(templateFolderPath, 'newTSqlViewTemplate.sql');
	newSqlStoredProcedureTemplate = await loadTemplate(templateFolderPath, 'newTSqlStoredProcedureTemplate.sql');
}

async function loadTemplate(templateFolderPath: string, fileName: string): Promise<string> {
	return (await fs.readFile(path.join(templateFolderPath, fileName))).toString();
}
