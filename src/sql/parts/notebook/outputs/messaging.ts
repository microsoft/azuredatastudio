/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

export interface MessagePoster {
	/**
	 * Post a message to the markdown extension
	 */
	postMessage(type: string, body: object): void;


	/**
	 * Post a command to be executed to the markdown extension
	 */
	postCommand(command: string, args: any[]): void;
}

export const createPosterForVsCode = (vscode: any) => {
	return new class implements MessagePoster {
		postMessage(type: string, body: object): void {
			vscode.postMessage({
				type,
				body
			});
		}
		postCommand(command: string, args: any[]) {
			this.postMessage('command', { command, args });
		}
	};
};

