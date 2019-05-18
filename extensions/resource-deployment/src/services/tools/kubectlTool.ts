/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ToolType, ITool, ToolInstallationStatus } from '../../interfaces';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class KubeCtlTool implements ITool {
	get name(): string {
		return 'kubectl';
	}

	get description(): string {
		return localize('resourceDeployment.KUBECTLDescription', 'Tool used for managing the Kubernetes cluster');
	}

	get type(): ToolType {
		return ToolType.KubeCtl;
	}

	get displayName(): string {
		return localize('resourceDeployment.KUBECTLDisplayName', 'kubectl');
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