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
	public static discard: IconPath;
	public static refresh: IconPath;
	public static cutover: IconPath;
	public static sqlMigrationLogo: IconPath;
	public static sqlMiVideoThumbnail: IconPath;
	public static sqlVmVideoThumbnail: IconPath;
	public static migrationDashboardHeaderBackground: IconPath;
	public static inProgressMigration: IconPath;
	public static completedMigration: IconPath;
	public static notStartedMigration: IconPath;

	public static setExtensionContext(context: vscode.ExtensionContext) {
		IconPathHelper.copy = {
			light: context.asAbsolutePath('images/copy.svg'),
			dark: context.asAbsolutePath('images/copy.svg')
		};
		IconPathHelper.discard = {
			light: context.asAbsolutePath('images/discard.svg'),
			dark: context.asAbsolutePath('images/discard.svg')
		};
		IconPathHelper.refresh = {
			light: context.asAbsolutePath('images/refresh.svg'),
			dark: context.asAbsolutePath('images/refresh.svg')
		};
		IconPathHelper.sqlMiVideoThumbnail = {
			light: context.asAbsolutePath('images/sqlMiVideoThumbnail.svg'),
			dark: context.asAbsolutePath('images/sqlMiVideoThumbnail.svg')
		};
		IconPathHelper.sqlVmVideoThumbnail = {
			light: context.asAbsolutePath('images/sqlVmVideoThumbnail.svg'),
			dark: context.asAbsolutePath('images/sqlVmVideoThumbnail.svg')
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
