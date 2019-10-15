/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as vscode from 'vscode';
import * as azdata from 'azdata';

import * as types from './types';
import * as Constants from './constants';

export enum BuiltInCommands {
	SetContext = 'setContext',
}

export enum ContextKeys {
	ISCLOUD = 'mssql:iscloud',
	EDITIONID = 'mssql:engineedition',
	ISCLUSTER = 'mssql:iscluster',
	SERVERMAJORVERSION = 'mssql:servermajorversion',
	ISSQLONDEMAND = 'mssql:issqlondemand',
}

const isCloudEditions = [
	5,
	6,
	11
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
		let iscloud: boolean;
		let edition: number;
		let isCluster: boolean = false;
		let serverMajorVersion: number;
		let isSqlOnDemand: boolean = false;
		if (e.profile.providerName.toLowerCase() === 'mssql' && !types.isUndefinedOrNull(e.serverInfo) && !types.isUndefinedOrNull(e.serverInfo.engineEditionId)) {
			if (isCloudEditions.some(i => i === e.serverInfo.engineEditionId)) {
				iscloud = true;
			} else {
				iscloud = false;
			}

			edition = e.serverInfo.engineEditionId;

			if (edition === Constants.sqlOnDemand) {
				isSqlOnDemand = true;
			}

			if (!types.isUndefinedOrNull(e.serverInfo.options)) {
				let isBigDataCluster = e.serverInfo.options[Constants.isBigDataClusterProperty];
				if (isBigDataCluster) {
					isCluster = isBigDataCluster;
				}
			}
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

		if (isSqlOnDemand === true || isSqlOnDemand === false) {
			setCommandContext(ContextKeys.ISSQLONDEMAND, isSqlOnDemand);
		}
	}

	dispose(): void {
		this._disposables = this._disposables.map(i => i.dispose());
	}
}
