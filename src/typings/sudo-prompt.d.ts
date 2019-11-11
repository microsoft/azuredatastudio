/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'sudo-prompt' {
	type SudoOptions = {
		name?: string;
		icns?: string;
		env?: NodeJS.ProcessEnv;
	};
	export function exec(cmd: string, options: SudoOptions, callback: (error: string, stdout: string, stderr: string) => void): void;
}
