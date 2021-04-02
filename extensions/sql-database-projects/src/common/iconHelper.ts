/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';

export interface IconPath {
	dark: string;
	light: string;
}

export class IconPathHelper {
	private static extensionContext: vscode.ExtensionContext;
	public static databaseProject: IconPath;
	public static colorfulSqlProject: IconPath;
	public static sqlEdgeProject: IconPath;

	public static dataSourceGroup: IconPath;
	public static dataSourceSql: IconPath;

	public static referenceGroup: IconPath;
	public static referenceDatabase: IconPath;

	public static refresh: IconPath;
	public static folder_blue: IconPath;
	public static selectConnection: IconPath;
	public static connect: IconPath;

	public static folder: IconPath;

	public static add: IconPath;
	public static build: IconPath;
	public static publish: IconPath;
	public static schemaCompare: IconPath;
	public static targetPlatform: IconPath;

	public static success: IconPath;
	public static error: IconPath;
	public static inProgress: IconPath;

	public static dashboardSqlProj: azdata.ThemedIconPath;

	public static setExtensionContext(extensionContext: vscode.ExtensionContext) {
		IconPathHelper.extensionContext = extensionContext;

		IconPathHelper.databaseProject = IconPathHelper.makeIcon('databaseProject');
		IconPathHelper.colorfulSqlProject = IconPathHelper.makeIcon('colorfulSqlProject', true);
		IconPathHelper.sqlEdgeProject = IconPathHelper.makeIcon('sqlEdgeProject', true);

		IconPathHelper.dataSourceGroup = IconPathHelper.makeIcon('dataSourceGroup');
		IconPathHelper.dataSourceSql = IconPathHelper.makeIcon('dataSource-sql');

		IconPathHelper.referenceGroup = IconPathHelper.makeIcon('referenceGroup');
		IconPathHelper.referenceDatabase = IconPathHelper.makeIcon('reference-database');

		IconPathHelper.refresh = IconPathHelper.makeIcon('refresh', true);
		IconPathHelper.folder_blue = IconPathHelper.makeIcon('folder_blue', true);
		IconPathHelper.selectConnection = IconPathHelper.makeIcon('selectConnection', true);
		IconPathHelper.connect = IconPathHelper.makeIcon('connect', true);

		IconPathHelper.folder = IconPathHelper.makeIcon('folder');

		IconPathHelper.add = IconPathHelper.makeIcon('add', true);
		IconPathHelper.build = IconPathHelper.makeIcon('build', true);
		IconPathHelper.publish = IconPathHelper.makeIcon('publish', true);
		IconPathHelper.schemaCompare = IconPathHelper.makeIcon('schemaCompare', true);
		IconPathHelper.targetPlatform = IconPathHelper.makeIcon('targetPlatform', true);

		IconPathHelper.success = IconPathHelper.makeIcon('success', true);
		IconPathHelper.error = IconPathHelper.makeIcon('error', true);
		IconPathHelper.inProgress = IconPathHelper.makeIcon('inProgress', true);

		IconPathHelper.dashboardSqlProj = IconPathHelper.makeIcon('dashboardSqlProj', true);
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
