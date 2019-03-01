/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as vscode from 'vscode';
import * as sqlops from 'sqlops';

import * as types from './types';
import * as Constants from './constants';

export enum BuiltInCommands {
	SetContext = 'setContext',
}

export enum ContextKeys {
	ISCLOUD = 'mssql:iscloud',
	EDITIONID = 'mssql:engineedition',
	ISCLUSTER = 'mssql:iscluster',
	SERVERMAJORVERSION = 'mssql:servermajorversion'
}

const isCloudEditions = [
	5,
	6
];

export function setCommandContext(key: ContextKeys | string, value: any) {
	return vscode.commands.executeCommand(BuiltInCommands.SetContext, key, value);
}

export default class ContextProvider {
	private _disposables = new Array<vscode.Disposable>();

	constructor() {
		this._disposables.push(sqlops.workspace.onDidOpenDashboard(this.onDashboardOpen, this));
		this._disposables.push(sqlops.workspace.onDidChangeToDashboard(this.onDashboardOpen, this));
	}

	public onDashboardOpen(e: sqlops.DashboardDocument): void {
		let iscloud: boolean;
		let edition: number;
		let isCluster: boolean = false;
		let serverMajorVersion: number;
		if (e.profile.providerName.toLowerCase() === 'mssql' && !types.isUndefinedOrNull(e.serverInfo) && !types.isUndefinedOrNull(e.serverInfo.engineEditionId)) {
			if (isCloudEditions.some(i => i === e.serverInfo.engineEditionId)) {
				iscloud = true;
			} else {
				iscloud = false;
			}

			edition = e.serverInfo.engineEditionId;

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
	}

	dispose(): void {
		this._disposables = this._disposables.map(i => i.dispose());
	}
}
