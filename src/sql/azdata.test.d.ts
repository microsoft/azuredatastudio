/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is the place for APIs used for testing

import * as vscode from 'vscode';

declare module 'azdata' {

	export namespace extensions {
		export function install(vsixPath: string): Thenable<string>;
	}

	export namespace objectexplorer {
		/**
		 * get object explorer node context menu actions
		 */
		export function getNodeActions(connectionId: string, nodePath: string): Thenable<string[]>;
	}
}
