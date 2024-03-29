/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class ExtensionContextHelper {
	public static extensionContext: vscode.ExtensionContext;

	public static setExtensionContext(extensionContext: vscode.ExtensionContext) {
		ExtensionContextHelper.extensionContext = extensionContext;
	}
}
