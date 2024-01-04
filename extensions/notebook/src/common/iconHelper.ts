/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export interface IconPath {
	dark: string;
	light: string;
}

export class IconPathHelper {
	private static extensionContext: vscode.ExtensionContext;

	public static delete: IconPath;
	public static folder: IconPath;

	public static setExtensionContext(extensionContext: vscode.ExtensionContext) {
		IconPathHelper.extensionContext = extensionContext;
		IconPathHelper.delete = {
			dark: IconPathHelper.extensionContext.asAbsolutePath('resources/dark/delete_inverse.svg'),
			light: IconPathHelper.extensionContext.asAbsolutePath('resources/light/delete.svg')
		};
		IconPathHelper.folder = {
			dark: IconPathHelper.extensionContext.asAbsolutePath('resources/folder.svg'),
			light: IconPathHelper.extensionContext.asAbsolutePath('resources/folder.svg')
		};
	}
}
