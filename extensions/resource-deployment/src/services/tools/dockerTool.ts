/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ToolType, ITool, ToolInstallationStatus } from '../../interfaces';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();


export class DockerTool implements ITool {
	get name(): string {
		return 'docker';
	}

	get description(): string {
		return localize('resourceDeployment.DockerDescription', 'Manages the containers');
	}

	get type(): ToolType {
		return ToolType.Docker;
	}

	get displayName(): string {
		return localize('resourceDeployment.DockerDisplayName', 'Docker');
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