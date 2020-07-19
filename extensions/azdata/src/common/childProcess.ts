/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as loc from '../localizedConstants';

/**
 * Wrapper error for when an unexpected exit code was recieved
 */
export class ExitCodeError extends Error {
	constructor(public code: number) {
		super(`Unexpected exit code ${code}`);
	}
}

/**
 *
 * @param command The command to execute
 * @param args Optional args to pass, every arg and arg value must be a separate item in the array
 * @param outputChannel Channel used to display diagnostic information
 */
export async function executeCommand(command: string, args?: string[], outputChannel?: vscode.OutputChannel): Promise<string> {
	return new Promise((resolve, reject) => {
		outputChannel?.appendLine(loc.executingCommand(command, args ?? []));
		const buffers: Buffer[] = [];
		const child = cp.spawn(command, args);
		child.stdout.on('data', (b: Buffer) => buffers.push(b));
		child.on('error', reject);
		child.on('exit', code => code ? reject(new ExitCodeError(code)) : resolve(Buffer.concat(buffers).toString('utf8').trim()));
	});
}
