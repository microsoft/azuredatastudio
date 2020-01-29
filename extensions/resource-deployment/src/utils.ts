/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ITool, NoteBookEnvironmentVariablePrefix } from './interfaces';
import * as path from 'path';
import { ToolsInstallPath } from './ui/deployClusterWizard/constants';

export function getErrorMessage(error: any): string {
	return (error instanceof Error)
		? (typeof error.message === 'string' ? error.message : '')
		: typeof error === 'string' ? error : `${JSON.stringify(error, undefined, '\t')}`;
}

export function getDateTimeString(): string {
	return new Date().toISOString().slice(0, 19).replace(/[^0-9]/g, ''); // Take the date time information and only leaving the numbers
}


export function getRuntimeBinaryPathEnvironmentVariableName(toolName: string): string {
	return `${NoteBookEnvironmentVariablePrefix}${toolName.toUpperCase().replace(/ |-/g, '_')}`;
}

export function setEnvironmentVariablesForInstallPaths(tools: ITool[]): void {
	// Use Set class to make sure the collection only contains unique values.
	let installationPaths: Set<string> = new Set<string>();
	tools.forEach(t => {
		if (t.installationPathOrAdditionalInformation) {

			// construct an env variable name with NoteBookEnvironmentVariablePrefix prefix
			// and tool.name as suffix, making sure of using all uppercase characters and only _ as separator
			const envVarName = getRuntimeBinaryPathEnvironmentVariableName(t.name);
			process.env[envVarName] = t.installationPathOrAdditionalInformation;
			installationPaths.add(path.dirname(t.installationPathOrAdditionalInformation));
		}
	});
	if (installationPaths.size > 0) {
		const envVarToolsInstallationPath: string = [...installationPaths.values()].join(path.delimiter);
		process.env[ToolsInstallPath] = envVarToolsInstallationPath;
	}
}
