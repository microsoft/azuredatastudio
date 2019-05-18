/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ToolType, ITool, ToolInstallationStatus } from '../../interfaces';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class AzCliTool implements ITool {
	get name(): string {
		return 'azcli';
	}

	get description(): string {
		return localize('resourceDeployment.AzCLIDescription', 'Tool used for managing Azure services');
	}

	get type(): ToolType {
		return ToolType.AzCli;
	}

	get displayName(): string {
		return localize('resourceDeployment.AzCLIDisplayName', 'Azure CLI');
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