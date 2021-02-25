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
	public static copy: IconPath;
	public static refresh: IconPath;
	public static sqlMiImportHelpThumbnail: IconPath;
	public static sqlVmImportHelpThumbnail: IconPath;
	public static migrationDashboardHeaderBackground: IconPath;
	public static sqlMigrationLogo: IconPath;
	public static inProgressMigration: IconPath;
	public static completedMigration: IconPath;
	public static notStartedMigration: IconPath;
	public static cutover: IconPath;

	public static setExtensionContext(context: vscode.ExtensionContext) {
		IconPathHelper.copy = {
			light: context.asAbsolutePath('images/copy.svg'),
			dark: context.asAbsolutePath('images/copy.svg')
		};
		IconPathHelper.refresh = {
			light: context.asAbsolutePath('images/refresh.svg'),
			dark: context.asAbsolutePath('images/refresh.svg')
		};
		IconPathHelper.sqlMiImportHelpThumbnail = {
			light: context.asAbsolutePath('images/sqlMiImportHelpThumbnail.svg'),
			dark: context.asAbsolutePath('images/sqlMiImportHelpThumbnail.svg')
		};
		IconPathHelper.sqlVmImportHelpThumbnail = {
			light: context.asAbsolutePath('images/sqlVmImportHelpThumbnail.svg'),
			dark: context.asAbsolutePath('images/sqlVmImportHelpThumbnail.svg')
		};
		IconPathHelper.migrationDashboardHeaderBackground = {
			light: context.asAbsolutePath('images/background.svg'),
			dark: context.asAbsolutePath('images/background.svg')
		};
		IconPathHelper.sqlMigrationLogo = {
			light: context.asAbsolutePath('images/migration.svg'),
			dark: context.asAbsolutePath('images/migration.svg')
		};
		IconPathHelper.inProgressMigration = {
			light: context.asAbsolutePath('images/inProgress.svg'),
			dark: context.asAbsolutePath('images/inProgress.svg')
		};
		IconPathHelper.completedMigration = {
			light: context.asAbsolutePath('images/succeeded.svg'),
			dark: context.asAbsolutePath('images/succeeded.svg')
		};
		IconPathHelper.notStartedMigration = {
			light: context.asAbsolutePath('images/notStarted.svg'),
			dark: context.asAbsolutePath('images/notStarted.svg')
		};
		IconPathHelper.cutover = {
			light: context.asAbsolutePath('images/cutover.svg'),
			dark: context.asAbsolutePath('images/cutover.svg')
		};
	}
}
