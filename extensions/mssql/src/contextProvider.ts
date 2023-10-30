/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';

import * as types from './types';

enum BuiltInCommands {
	SetContext = 'setContext',
}

enum ContextKeys {
	ISCLOUD = 'mssql:iscloud',
	EDITIONID = 'mssql:engineedition',
	SERVERMAJORVERSION = 'mssql:servermajorversion'
}

const isCloudEditions = [
	azdata.DatabaseEngineEdition.SqlDatabase,
	azdata.DatabaseEngineEdition.SqlDataWarehouse,
	azdata.DatabaseEngineEdition.SqlOnDemand
];

function setCommandContext(key: ContextKeys | string, value: any) {
	return vscode.commands.executeCommand(BuiltInCommands.SetContext, key, value);
}

export default class ContextProvider {
	private _disposables = new Array<vscode.Disposable>();

	constructor() {
		this._disposables.push(azdata.workspace.onDidOpenDashboard(this.onDashboardOpen, this));
		this._disposables.push(azdata.workspace.onDidChangeToDashboard(this.onDashboardOpen, this));
	}

	public onDashboardOpen(e: azdata.DashboardDocument): void {
		let isCloud: boolean = false;
		let edition: number | undefined;
		let serverMajorVersion: number | undefined;
		if (e.profile.providerName.toLowerCase() === 'mssql' && !types.isUndefinedOrNull(e.serverInfo) && !types.isUndefinedOrNull(e.serverInfo.engineEditionId)) {
			isCloud = isCloudEditions.some(i => i === e.serverInfo.engineEditionId);
			edition = e.serverInfo.engineEditionId;
			serverMajorVersion = e.serverInfo.serverMajorVersion;
		}

		if (isCloud === true || isCloud === false) {
			void setCommandContext(ContextKeys.ISCLOUD, isCloud);
		}

		if (!types.isUndefinedOrNull(edition)) {
			void setCommandContext(ContextKeys.EDITIONID, edition);
		}

		if (!types.isUndefinedOrNull(serverMajorVersion)) {
			void setCommandContext(ContextKeys.SERVERMAJORVERSION, serverMajorVersion);
		}
	}

	dispose(): void {
		this._disposables.forEach(i => i.dispose());
		this._disposables = [];
	}
}
