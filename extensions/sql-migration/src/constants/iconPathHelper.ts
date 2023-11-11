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
	public static sqlDatabaseNotReadyLogo: IconPath;
	public static sqlDatabaseReadyLogo: IconPath;
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
	public static emptyTable: IconPath;
	public static addAzureAccount: IconPath;
	public static retry: IconPath;
	public static redo: IconPath;
	public static edit: IconPath;
	public static restartDataCollection: IconPath;
	public static stop: IconPath;
	public static view: IconPath;
	public static sqlMigrationService: IconPath;
	public static addNew: IconPath;
	public static breadCrumb: IconPath;
	public static allTables: IconPath;
	public static notFound: IconPath;
	public static startDataCollection: IconPath;
	public static stopDataCollection: IconPath;
	public static import: IconPath;
	public static settings: IconPath;
	public static encryption: IconPath;
	public static openFolder: IconPath;
	public static emptyState: IconPath;

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
			light: context.asAbsolutePath('images/dashboardWatermark.svg'),
			dark: context.asAbsolutePath('images/dashboardWatermark.svg')
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
		IconPathHelper.sqlDatabaseNotReadyLogo = {
			light: context.asAbsolutePath('images/sqlDatabaseNotReady.svg'),
			dark: context.asAbsolutePath('images/sqlDatabaseNotReady.svg')
		};
		IconPathHelper.sqlDatabaseReadyLogo = {
			light: context.asAbsolutePath('images/sqlDatabaseReady.svg'),
			dark: context.asAbsolutePath('images/sqlDatabaseReady.svg')
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
		IconPathHelper.emptyTable = {
			light: context.asAbsolutePath('images/emptyTable.svg'),
			dark: context.asAbsolutePath('images/emptyTable.svg')
		};
		IconPathHelper.addAzureAccount = {
			light: context.asAbsolutePath('images/noAzureAccount.svg'),
			dark: context.asAbsolutePath('images/noAzureAccount.svg')
		};
		IconPathHelper.retry = {
			light: context.asAbsolutePath('images/retry.svg'),
			dark: context.asAbsolutePath('images/retry.svg')
		};
		IconPathHelper.redo = {
			light: context.asAbsolutePath('images/redo.svg'),
			dark: context.asAbsolutePath('images/redo.svg')
		};
		IconPathHelper.edit = {
			light: context.asAbsolutePath('images/edit.svg'),
			dark: context.asAbsolutePath('images/edit.svg')
		};
		IconPathHelper.restartDataCollection = {
			light: context.asAbsolutePath('images/restartDataCollection.svg'),
			dark: context.asAbsolutePath('images/restartDataCollection.svg')
		};
		IconPathHelper.stop = {
			light: context.asAbsolutePath('images/stop.svg'),
			dark: context.asAbsolutePath('images/stop.svg')
		};
		IconPathHelper.view = {
			light: context.asAbsolutePath('images/view.svg'),
			dark: context.asAbsolutePath('images/view.svg')
		};
		IconPathHelper.sqlMigrationService = {
			light: context.asAbsolutePath('images/sqlMigrationService.svg'),
			dark: context.asAbsolutePath('images/sqlMigrationService.svg'),
		};
		IconPathHelper.addNew = {
			light: context.asAbsolutePath('images/addNew.svg'),
			dark: context.asAbsolutePath('images/addNew.svg'),
		};
		IconPathHelper.breadCrumb = {
			light: context.asAbsolutePath('images/breadCrumb.svg'),
			dark: context.asAbsolutePath('images/breadCrumb.svg'),
		};
		IconPathHelper.allTables = {
			light: context.asAbsolutePath('images/allTables.svg'),
			dark: context.asAbsolutePath('images/allTables.svg'),
		};
		IconPathHelper.notFound = {
			light: context.asAbsolutePath('images/notFound.svg'),
			dark: context.asAbsolutePath('images/notFound.svg'),
		};
		IconPathHelper.startDataCollection = {
			light: context.asAbsolutePath('images/startDataCollection.svg'),
			dark: context.asAbsolutePath('images/startDataCollection.svg')
		};
		IconPathHelper.stopDataCollection = {
			light: context.asAbsolutePath('images/stopDataCollection.svg'),
			dark: context.asAbsolutePath('images/stopDataCollection.svg')
		};
		IconPathHelper.import = {
			light: context.asAbsolutePath('images/import.svg'),
			dark: context.asAbsolutePath('images/import.svg')
		};
		IconPathHelper.settings = {
			light: context.asAbsolutePath('images/settings.svg'),
			dark: context.asAbsolutePath('images/settings.svg')
		};
		IconPathHelper.encryption = {
			light: context.asAbsolutePath('images/encryption.svg'),
			dark: context.asAbsolutePath('images/encryption.svg')
		};
		IconPathHelper.openFolder = {
			light: context.asAbsolutePath('images/openFolder.svg'),
			dark: context.asAbsolutePath('images/openFolder.svg')
		};
		IconPathHelper.emptyState = {
			light: context.asAbsolutePath('images/blankCanvas.svg'),
			dark: context.asAbsolutePath('images/blankCanvas.svg')
		};
	}
}
