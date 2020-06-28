/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export enum BdcItemType {
	controllerRoot = 'bigDataClusters.itemType.controllerRootNode',
	controller = 'bigDataClusters.itemType.controllerNode',
	loadingController = 'bigDataClusters.itemType.loadingControllerNode'
}

export interface IconPath {
	dark: string;
	light: string;
}

export class IconPathHelper {
	private static extensionContext: vscode.ExtensionContext;

	public static controllerNode: IconPath;
	public static copy: IconPath;
	public static refresh: IconPath;
	public static status_ok: IconPath;
	public static status_warning: IconPath;
	public static notebook: IconPath;
	public static status_circle_red: IconPath;
	public static status_circle_blank: IconPath;

	public static setExtensionContext(extensionContext: vscode.ExtensionContext) {
		IconPathHelper.extensionContext = extensionContext;
		IconPathHelper.controllerNode = {
			dark: IconPathHelper.extensionContext.asAbsolutePath('resources/dark/bigDataCluster_controller.svg'),
			light: IconPathHelper.extensionContext.asAbsolutePath('resources/light/bigDataCluster_controller.svg')
		};
		IconPathHelper.copy = {
			light: IconPathHelper.extensionContext.asAbsolutePath('resources/light/copy.svg'),
			dark: IconPathHelper.extensionContext.asAbsolutePath('resources/dark/copy_inverse.svg')
		};
		IconPathHelper.refresh = {
			light: IconPathHelper.extensionContext.asAbsolutePath('resources/light/refresh.svg'),
			dark: IconPathHelper.extensionContext.asAbsolutePath('resources/dark/refresh_inverse.svg')
		};
		IconPathHelper.status_ok = {
			light: IconPathHelper.extensionContext.asAbsolutePath('resources/light/status_ok_light.svg'),
			dark: IconPathHelper.extensionContext.asAbsolutePath('resources/dark/status_ok_dark.svg')
		};
		IconPathHelper.status_warning = {
			light: IconPathHelper.extensionContext.asAbsolutePath('resources/light/status_warning_light.svg'),
			dark: IconPathHelper.extensionContext.asAbsolutePath('resources/dark/status_warning_dark.svg')
		};
		IconPathHelper.notebook = {
			light: IconPathHelper.extensionContext.asAbsolutePath('resources/light/notebook.svg'),
			dark: IconPathHelper.extensionContext.asAbsolutePath('resources/dark/notebook_inverse.svg')
		};
		IconPathHelper.status_circle_red = {
			light: IconPathHelper.extensionContext.asAbsolutePath('resources/status_circle_red.svg'),
			dark: IconPathHelper.extensionContext.asAbsolutePath('resources/status_circle_red.svg')
		};
		IconPathHelper.status_circle_blank = {
			light: IconPathHelper.extensionContext.asAbsolutePath('resources/status_circle_blank.svg'),
			dark: IconPathHelper.extensionContext.asAbsolutePath('resources/status_circle_blank.svg')
		};
	}
}

export namespace cssStyles {
	export const title = { 'font-size': '14px', 'font-weight': '600' };
	export const tableHeader = { 'text-align': 'left', 'font-weight': 'bold', 'text-transform': 'uppercase', 'font-size': '10px', 'user-select': 'text' };
	export const text = { 'margin-block-start': '0px', 'margin-block-end': '0px' };
	export const lastUpdatedText = { ...text, 'color': '#595959' };
	export const errorText = { ...text, 'color': 'red' };
}

export const clusterEndpointsProperty = 'clusterEndpoints';
export const controllerEndpointName = 'controller';
