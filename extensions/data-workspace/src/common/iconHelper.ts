/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export interface IconPath {
	dark: string;
	light: string;
}

export class IconHelper {
	private static extensionContext: vscode.ExtensionContext;
	public static localFileSystem: IconPath;

	public static setExtensionContext(extensionContext: vscode.ExtensionContext) {
		IconHelper.extensionContext = extensionContext;
		IconHelper.localFileSystem = IconHelper.makeIcon('file');
	}

	private static makeIcon(name: string, sameIcon: boolean = false) {
		const folder = 'images';

		if (sameIcon) {
			return {
				dark: IconHelper.extensionContext.asAbsolutePath(`${folder}/${name}.svg`),
				light: IconHelper.extensionContext.asAbsolutePath(`${folder}/${name}.svg`)
			};
		} else {
			return {
				dark: IconHelper.extensionContext.asAbsolutePath(`${folder}/dark/${name}.svg`),
				light: IconHelper.extensionContext.asAbsolutePath(`${folder}/light/${name}.svg`)
			};
		}
	}
}
