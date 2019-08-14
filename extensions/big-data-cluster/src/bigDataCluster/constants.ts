/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';

export enum BdcItemType {
	controllerRoot = 'bigDataClusters.itemType.controllerRootNode',
	controller = 'bigDataClusters.itemType.controllerNode',
	folder = 'bigDataClusters.itemType.folderNode',
	sqlMaster = 'bigDataClusters.itemType.sqlMasterNode',
	EndPoint = 'bigDataClusters.itemType.endPointNode',
	addController = 'bigDataClusters.itemType.addControllerNode',
	loadingController = 'bigDataClusters.itemType.loadingControllerNode'
}

export class IconPath {
	private static extensionContext: vscode.ExtensionContext;

	public static controllerNode: { dark: string, light: string };
	public static folderNode: { dark: string, light: string };
	public static sqlMasterNode: { dark: string, light: string };

	public static setExtensionContext(extensionContext: vscode.ExtensionContext) {
		IconPath.extensionContext = extensionContext;
		IconPath.controllerNode = {
			dark: IconPath.extensionContext.asAbsolutePath('resources/dark/bigDataCluster_controller.svg'),
			light: IconPath.extensionContext.asAbsolutePath('resources/light/bigDataCluster_controller.svg')
		};
		IconPath.folderNode = {
			dark: IconPath.extensionContext.asAbsolutePath('resources/dark/folder_inverse.svg'),
			light: IconPath.extensionContext.asAbsolutePath('resources/light/folder.svg')
		};
		IconPath.sqlMasterNode = {
			dark: IconPath.extensionContext.asAbsolutePath('resources/dark/sql_bigdata_cluster_inverse.svg'),
			light: IconPath.extensionContext.asAbsolutePath('resources/light/sql_bigdata_cluster.svg')
		};
	}
}