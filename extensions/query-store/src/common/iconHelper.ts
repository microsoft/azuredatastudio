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
	private static extensionContext: vscode.ExtensionContext;
	public static multipleWindows: IconPath;
	public static gear: IconPath;

	public static setExtensionContext(extensionContext: vscode.ExtensionContext) {
		IconPathHelper.extensionContext = extensionContext;

		IconPathHelper.gear = IconPathHelper.makeIcon('gear');
		IconPathHelper.multipleWindows = IconPathHelper.makeIcon('multiple-windows');
	}

	private static makeIcon(name: string, sameIcon: boolean = false) {
		const folder = 'images';

		if (sameIcon) {
			return {
				dark: IconPathHelper.extensionContext.asAbsolutePath(`${folder}/${name}.svg`),
				light: IconPathHelper.extensionContext.asAbsolutePath(`${folder}/${name}.svg`)
			};
		} else {
			return {
				dark: IconPathHelper.extensionContext.asAbsolutePath(`${folder}/dark/${name}.svg`),
				light: IconPathHelper.extensionContext.asAbsolutePath(`${folder}/light/${name}.svg`)
			};
		}
	}
}
