/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/// <reference path='../../../../src/vs/vscode.d.ts'/>
/// <reference path='../../../../src/sql/azdata.d.ts'/>
/// <reference path='../../../../src/sql/azdata.proposed.d.ts'/>
/// <reference types='@types/node'/>
declare module "sudo-prompt" {

	type SudoOptions = {
		name?: string;
		icon?: string;
		env: NodeJS.ProcessEnv;
	};

	export function exec(cmd: string, options: SudoOptions, callback: (error: string, stdout: string, stderr: string) => void): any;
}
