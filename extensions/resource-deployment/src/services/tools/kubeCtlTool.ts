/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ToolType, ITool } from '../../interfaces';
import * as nls from 'vscode-nls';
import * as cp from 'child_process';
import { SemVer } from 'semver';

const localize = nls.loadMessageBundle();

export class KubeCtlTool implements ITool {
	get name(): string {
		return 'kubectl';
	}

	get description(): string {
		return localize('resourceDeployment.KubeCtlDescription', 'A command-line tool allows you to run commands against Kubernetes clusters');
	}

	get type(): ToolType {
		return ToolType.KubeCtl;
	}

	get displayName(): string {
		return localize('resourceDeployment.KubeCtlDisplayName', 'kubectl');
	}

	get homePage(): string {
		return 'https://kubernetes.io/docs/tasks/tools/install-kubectl';
	}

	get isInstalled(): boolean {
		return this._isInstalled;
	}

	get version(): SemVer | undefined {
		return this._version;
	}

	loadInformation(): Thenable<void> {
		const promise = new Promise<void>((resolve, reject) => {
			cp.exec('kubectl version -o json --client', (error, stdout, stderror) => {
				if (stdout) {
					try {
						const versionJson = JSON.parse(stdout);
						this._version = new SemVer(`${versionJson.clientVersion.major}.${versionJson.clientVersion.minor}.0`);
						this._isInstalled = true;
					}
					catch (err) {
						console.error('error parsing kubectl version:' + err);
					}
				}
				resolve();
			});
		});
		return promise;
	}

	private _isInstalled: boolean = false;
	private _version: SemVer | undefined = undefined;
}
