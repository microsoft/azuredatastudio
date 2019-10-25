/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ITool, NoteBookEnvironmentVariablePrefix } from './interfaces';

export function getErrorMessage(error: any): string {
	return (error instanceof Error)
		? (typeof error.message === 'string' ? error.message : '')
		: typeof error === 'string' ? error : `${JSON.stringify(error, undefined, '\t')}`;
}

export function getDateTimeString(): string {
	return new Date().toISOString().slice(0, 19).replace(/[^0-9]/g, ''); // Take the date time information and only leaving the numbers
}

export function setNoteBookEnvironmentVariableForInstallPaths(tools: ITool[]): void {
	tools.forEach(t => {
		// construct an env variable name with NoteBookEnvironmentVariablePrefix prefix
		// and tool.name as suffix, making sure of using all uppercase characters and only _ as separator
		const envVarName: string = `${NoteBookEnvironmentVariablePrefix}${t.name.toUpperCase().replace(/ |-/, '_')}`;
		process.env[envVarName] = t.installationPath;
		console.log(`setting env var:'${envVarName}' to: '${t.installationPath}'`);
	});
}
