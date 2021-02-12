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
	public static databaseProject: IconPath;

	public static dataSourceGroup: IconPath;
	public static dataSourceSql: IconPath;

	public static referenceGroup: IconPath;
	public static referenceDatabase: IconPath;

	public static refresh: IconPath;
	public static folder_blue: IconPath;
	public static selectConnection: IconPath;
	public static connect: IconPath;

	public static folder: IconPath;

	public static setExtensionContext(extensionContext: vscode.ExtensionContext) {
		IconPathHelper.extensionContext = extensionContext;

		IconPathHelper.databaseProject = IconPathHelper.makeIcon('databaseProject');

		IconPathHelper.dataSourceGroup = IconPathHelper.makeIcon('dataSourceGroup');
		IconPathHelper.dataSourceSql = IconPathHelper.makeIcon('dataSource-sql');

		IconPathHelper.referenceGroup = IconPathHelper.makeIcon('referenceGroup');
		IconPathHelper.referenceDatabase = IconPathHelper.makeIcon('reference-database');

		IconPathHelper.refresh = IconPathHelper.makeIcon('refresh', true);
		IconPathHelper.folder_blue = IconPathHelper.makeIcon('folder_blue', true);
		IconPathHelper.selectConnection = IconPathHelper.makeIcon('selectConnection', true);
		IconPathHelper.connect = IconPathHelper.makeIcon('connect', true);

		IconPathHelper.folder = IconPathHelper.makeIcon('folder');
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
