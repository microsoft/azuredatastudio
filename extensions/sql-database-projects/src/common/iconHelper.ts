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

	public static setExtensionContext(extensionContext: vscode.ExtensionContext) {
		IconPathHelper.extensionContext = extensionContext;

		IconPathHelper.databaseProject = IconPathHelper.makeIcon('databaseProject');

		IconPathHelper.dataSourceGroup = IconPathHelper.makeIcon('dataSourceGroup');
		IconPathHelper.dataSourceSql = IconPathHelper.makeIcon('dataSource-sql');

		IconPathHelper.referenceGroup = IconPathHelper.makeIcon('referenceGroup');
		IconPathHelper.referenceDatabase = IconPathHelper.makeIcon('reference-database');
	}

	private static makeIcon(name: string) {
		const folder = 'images';

		return {
			dark: IconPathHelper.extensionContext.asAbsolutePath(`${folder}/dark/${name}.svg`),
			light: IconPathHelper.extensionContext.asAbsolutePath(`${folder}/light/${name}.svg`)
		};
	}
}
