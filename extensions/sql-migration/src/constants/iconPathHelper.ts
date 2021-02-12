/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export interface IconPath {
	dark: string;
	light: string;
}

export class IconPathHelper {
	private static context: vscode.ExtensionContext;

	public static copy: IconPath;
	public static refresh: IconPath;

	public static setExtensionContext(context: vscode.ExtensionContext) {
		IconPathHelper.context = context;
		IconPathHelper.copy = {
			light: IconPathHelper.context.asAbsolutePath('images/copy.svg'),
			dark: IconPathHelper.context.asAbsolutePath('images/copy.svg')
		};
		IconPathHelper.refresh = {
			light: context.asAbsolutePath('images/refresh.svg'),
			dark: context.asAbsolutePath('images/refresh.svg')
		};

	}
}
