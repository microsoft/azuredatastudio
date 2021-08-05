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
	public static sqlVmLogo: IconPath;
	public static sqlMiLogo: IconPath;
	public static sqlServerLogo: IconPath;
	public static sqlDatabaseLogo: IconPath;
	public static sqlDatabaseWarningLogo: IconPath;
	public static cancel: IconPath;
	public static warning: IconPath;
	public static info: IconPath;
	public static error: IconPath;
	public static completingCutover: IconPath;
	public static migrationService: IconPath;
	public static sendFeedback: IconPath;
	public static expandButtonClosed: IconPath;
	public static expandButtonOpen: IconPath;
	public static newSupportRequest: IconPath;

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
		IconPathHelper.sqlMiLogo = {
			light: context.asAbsolutePath('images/sqlMI.svg'),
			dark: context.asAbsolutePath('images/sqlMI.svg')
		};
		IconPathHelper.sqlVmLogo = {
			light: context.asAbsolutePath('images/sqlVM.svg'),
			dark: context.asAbsolutePath('images/sqlVM.svg')
		};
		IconPathHelper.sqlServerLogo = {
			light: context.asAbsolutePath('images/sqlServer.svg'),
			dark: context.asAbsolutePath('images/sqlServer.svg')
		};
		IconPathHelper.sqlDatabaseLogo = {
			light: context.asAbsolutePath('images/sqlDatabase.svg'),
			dark: context.asAbsolutePath('images/sqlDatabase.svg')
		};
		IconPathHelper.sqlDatabaseWarningLogo = {
			light: context.asAbsolutePath('images/sqlDatabaseWarning.svg'),
			dark: context.asAbsolutePath('images/sqlDatabaseWarning.svg')
		};
		IconPathHelper.cancel = {
			light: context.asAbsolutePath('images/cancel.svg'),
			dark: context.asAbsolutePath('images/cancel.svg')
		};
		IconPathHelper.warning = {
			light: context.asAbsolutePath('images/warning.svg'),
			dark: context.asAbsolutePath('images/warning.svg')
		};
		IconPathHelper.info = {
			light: context.asAbsolutePath('images/info.svg'),
			dark: context.asAbsolutePath('images/info.svg')
		};
		IconPathHelper.error = {
			light: context.asAbsolutePath('images/error.svg'),
			dark: context.asAbsolutePath('images/error.svg')
		};
		IconPathHelper.completingCutover = {
			light: context.asAbsolutePath('images/completingCutover.svg'),
			dark: context.asAbsolutePath('images/completingCutover.svg')
		};
		IconPathHelper.migrationService = {
			light: context.asAbsolutePath('images/migrationService.svg'),
			dark: context.asAbsolutePath('images/migrationService.svg')
		};
		IconPathHelper.sendFeedback = {
			light: context.asAbsolutePath('images/sendFeedback.svg'),
			dark: context.asAbsolutePath('images/sendFeedback.svg')
		};
		IconPathHelper.expandButtonClosed = {
			light: context.asAbsolutePath('images/expandButtonClosedLight.svg'),
			dark: context.asAbsolutePath('images/expandButtonClosedDark.svg')
		};
		IconPathHelper.expandButtonOpen = {
			light: context.asAbsolutePath('images/expandButtonOpenLight.svg'),
			dark: context.asAbsolutePath('images/expandButtonOpenDark.svg')
		};
		IconPathHelper.newSupportRequest = {
			light: context.asAbsolutePath('images/newSupportRequest.svg'),
			dark: context.asAbsolutePath('images/newSupportRequest.svg')
		};
	}
}
