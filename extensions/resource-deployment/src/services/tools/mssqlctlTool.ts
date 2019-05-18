/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ToolType, ITool, ToolInstallationStatus } from '../../interfaces';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class MSSQLCtlTool implements ITool {
	get name(): string {
		return 'mssqlctl';
	}

	get description(): string {
		return localize('resourceDeployment.MSSQLCTLDescription', 'Command-line tool for installing and managing the SQL Server big data cluster');
	}

	get type(): ToolType {
		return ToolType.MSSQLCtl;
	}

	get displayName(): string {
		return localize('resourceDeployment.MSSQLCTLDisplayName', 'mssqlctl');
	}

	isInstalled(versionExpression: string): Thenable<boolean> {
		let promise = new Promise<boolean>(resolve => {
			setTimeout(() => {
				resolve(true);
			}, 500);
		});
		return promise;
	}

	get supportAutoInstall(): boolean {
		return true;
	}

	install(version: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	getInstallationStatus(versionExpression: string): Thenable<ToolInstallationStatus> {
		let promise = new Promise<ToolInstallationStatus>(resolve => {
			setTimeout(() => {
				resolve(ToolInstallationStatus.Installed);
			}, 500);
		});
		return promise;
	}
}