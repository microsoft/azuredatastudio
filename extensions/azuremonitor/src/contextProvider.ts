/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as azdata from 'azdata';

import * as types from './types';

export enum BuiltInCommands {
	SetContext = 'setContext',
}

export enum ContextKeys {
	ISCLOUD = 'azuremonitor:iscloud',
	EDITIONID = 'azuremonitor:engineedition',
	ISCLUSTER = 'azuremonitor:iscluster',
	SERVERMAJORVERSION = 'azuremonitor:servermajorversion'
}

const isCloudEditions = [
	azdata.DatabaseEngineEdition.SqlDatabase,
	azdata.DatabaseEngineEdition.SqlDataWarehouse,
	azdata.DatabaseEngineEdition.SqlOnDemand
];

export function setCommandContext(key: ContextKeys | string, value: any) {
	return vscode.commands.executeCommand(BuiltInCommands.SetContext, key, value);
}

export default class ContextProvider {
	private _disposables = new Array<vscode.Disposable>();

	constructor() {
		this._disposables.push(azdata.workspace.onDidOpenDashboard(this.onDashboardOpen, this));
		this._disposables.push(azdata.workspace.onDidChangeToDashboard(this.onDashboardOpen, this));
	}

	public onDashboardOpen(e: azdata.DashboardDocument): void {
		let iscloud: boolean = false;
		let edition: number | undefined;
		let isCluster: boolean = false;
		let serverMajorVersion: number | undefined;
		if (e.profile.providerName.toLowerCase() === 'loganalytics' && !types.isUndefinedOrNull(e.serverInfo) && !types.isUndefinedOrNull(e.serverInfo.engineEditionId)) {
			if (isCloudEditions.some(i => i === e.serverInfo.engineEditionId)) {
				iscloud = true;
			} else {
				iscloud = false;
			}

			edition = e.serverInfo.engineEditionId;

			serverMajorVersion = e.serverInfo.serverMajorVersion;
		}

		if (iscloud === true || iscloud === false) {
			setCommandContext(ContextKeys.ISCLOUD, iscloud);
		}

		if (!types.isUndefinedOrNull(edition)) {
			setCommandContext(ContextKeys.EDITIONID, edition);
		}

		if (!types.isUndefinedOrNull(isCluster)) {
			setCommandContext(ContextKeys.ISCLUSTER, isCluster);
		}

		if (!types.isUndefinedOrNull(serverMajorVersion)) {
			setCommandContext(ContextKeys.SERVERMAJORVERSION, serverMajorVersion);
		}
	}

	dispose(): void {
		this._disposables = this._disposables.map(i => i.dispose());
	}
}
