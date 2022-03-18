/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export const refreshActionId = 'arc.refresh';

export const credentialNamespace = 'arcCredentials';

export const controllerTroubleshootDocsUrl = 'https://aka.ms/arc-data-tsg';
export const miaaTroubleshootDocsUrl = 'https://aka.ms/miaa-tsg';

export interface IconPath {
	dark: string;
	light: string;
}

export class IconPathHelper {
	private static context: vscode.ExtensionContext;

	public static add: IconPath;
	public static edit: IconPath;
	public static delete: IconPath;
	public static openInTab: IconPath;
	public static copy: IconPath;
	public static collapseUp: IconPath;
	public static collapseDown: IconPath;
	public static postgres: IconPath;
	public static extensions: IconPath;
	public static computeStorage: IconPath;
	public static connection: IconPath;
	public static backup: IconPath;
	public static properties: IconPath;
	public static networking: IconPath;
	public static pitr: IconPath;
	public static refresh: IconPath;
	public static reset: IconPath;
	public static support: IconPath;
	public static wrench: IconPath;
	public static miaa: IconPath;
	public static controller: IconPath;
	public static health: IconPath;
	public static success: IconPath;
	public static save: IconPath;
	public static discard: IconPath;
	public static fail: IconPath;
	public static information: IconPath;
	public static gearBlue: IconPath;
	public static gearGray: IconPath;

	public static setExtensionContext(context: vscode.ExtensionContext) {
		IconPathHelper.context = context;
		IconPathHelper.add = {
			light: IconPathHelper.context.asAbsolutePath('images/add.svg'),
			dark: IconPathHelper.context.asAbsolutePath('images/add.svg')
		};
		IconPathHelper.edit = {
			light: IconPathHelper.context.asAbsolutePath('images/edit.svg'),
			dark: IconPathHelper.context.asAbsolutePath('images/edit.svg')
		};
		IconPathHelper.delete = {
			light: IconPathHelper.context.asAbsolutePath('images/delete.svg'),
			dark: IconPathHelper.context.asAbsolutePath('images/delete.svg')
		};
		IconPathHelper.openInTab = {
			light: IconPathHelper.context.asAbsolutePath('images/open-in-tab.svg'),
			dark: IconPathHelper.context.asAbsolutePath('images/open-in-tab.svg')
		};
		IconPathHelper.copy = {
			light: IconPathHelper.context.asAbsolutePath('images/copy.svg'),
			dark: IconPathHelper.context.asAbsolutePath('images/copy.svg')
		};
		IconPathHelper.postgres = {
			light: IconPathHelper.context.asAbsolutePath('images/postgres.svg'),
			dark: IconPathHelper.context.asAbsolutePath('images/postgres.svg')
		};
		IconPathHelper.extensions = {
			light: IconPathHelper.context.asAbsolutePath('images/extensions.svg'),
			dark: IconPathHelper.context.asAbsolutePath('images/extensions.svg')
		};
		IconPathHelper.computeStorage = {
			light: context.asAbsolutePath('images/billing.svg'),
			dark: context.asAbsolutePath('images/billing.svg')
		};
		IconPathHelper.connection = {
			light: context.asAbsolutePath('images/connections.svg'),
			dark: context.asAbsolutePath('images/connections.svg')
		};
		IconPathHelper.backup = {
			light: context.asAbsolutePath('images/migrate.svg'),
			dark: context.asAbsolutePath('images/migrate.svg')
		};
		IconPathHelper.properties = {
			light: context.asAbsolutePath('images/properties.svg'),
			dark: context.asAbsolutePath('images/properties.svg')
		};
		IconPathHelper.networking = {
			light: context.asAbsolutePath('images/security.svg'),
			dark: context.asAbsolutePath('images/security.svg')
		};
		IconPathHelper.refresh = {
			light: context.asAbsolutePath('images/refresh.svg'),
			dark: context.asAbsolutePath('images/refresh.svg')
		};
		IconPathHelper.reset = {
			light: context.asAbsolutePath('images/reset.svg'),
			dark: context.asAbsolutePath('images/reset.svg')
		};
		IconPathHelper.support = {
			light: context.asAbsolutePath('images/support.svg'),
			dark: context.asAbsolutePath('images/support.svg')
		};
		IconPathHelper.wrench = {
			light: context.asAbsolutePath('images/wrench.svg'),
			dark: context.asAbsolutePath('images/wrench.svg')
		};
		IconPathHelper.miaa = {
			light: context.asAbsolutePath('images/miaa.svg'),
			dark: context.asAbsolutePath('images/miaa.svg'),
		};
		IconPathHelper.controller = {
			light: context.asAbsolutePath('images/data_controller.svg'),
			dark: context.asAbsolutePath('images/data_controller.svg'),
		};
		IconPathHelper.health = {
			light: context.asAbsolutePath('images/health.svg'),
			dark: context.asAbsolutePath('images/health.svg'),
		};
		IconPathHelper.success = {
			light: context.asAbsolutePath('images/success.svg'),
			dark: context.asAbsolutePath('images/success.svg'),
		};
		IconPathHelper.save = {
			light: context.asAbsolutePath('images/save.svg'),
			dark: context.asAbsolutePath('images/save.svg'),
		};
		IconPathHelper.discard = {
			light: context.asAbsolutePath('images/discard.svg'),
			dark: context.asAbsolutePath('images/discard.svg'),
		};
		IconPathHelper.fail = {
			light: context.asAbsolutePath('images/fail.svg'),
			dark: context.asAbsolutePath('images/fail.svg'),
		};
		IconPathHelper.information = {
			light: context.asAbsolutePath('images/information.svg'),
			dark: context.asAbsolutePath('images/information.svg'),
		};
		IconPathHelper.gearBlue = {
			light: context.asAbsolutePath('images/gear-colored-blue.svg'),
			dark: context.asAbsolutePath('images/gear-colored-blue.svg'),
		};
		IconPathHelper.gearGray = {
			light: context.asAbsolutePath('images/gear-colored-gray.svg'),
			dark: context.asAbsolutePath('images/gear-colored-gray.svg'),
		};
		IconPathHelper.pitr = {
			light: context.asAbsolutePath('images/pitr.svg'),
			dark: context.asAbsolutePath('images/pitr.svg'),
		};
	}
}


export const enum Endpoints {
	mgmtproxy = 'mgmtproxy',
	logsui = 'logsui',
	metricsui = 'metricsui',
	controller = 'controller'
}

export const enum ConnectionMode {
	direct = 'direct',
	indirect = 'indirect'
}

export namespace cssStyles {
	export const text = { 'user-select': 'text', 'cursor': 'text' };
	export const title = { ...text, 'font-weight': 'bold', 'font-size': '14px' };
	export const tableHeader = { ...text, 'text-align': 'left', 'border': 'none' };
	export const tableRow = { ...text, 'border-top': 'solid 1px #ccc', 'border-bottom': 'solid 1px #ccc', 'border-left': 'none', 'border-right': 'none' };
}

export const iconSize = '20px';
