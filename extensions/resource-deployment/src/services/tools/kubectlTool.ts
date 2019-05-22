/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ToolType, ITool } from '../../interfaces';
import * as nls from 'vscode-nls';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { getConfiguration, KubectlPathName, ResourceDeploymentConfigurationName } from './utils';
import { SemVer } from 'semver';
import { IPlatformService } from '../platformService';
const localize = nls.loadMessageBundle();

export class KubeCtlTool implements ITool {
	constructor(private platformService: IPlatformService) { }

	private _version: SemVer | undefined = undefined;
	private _isInstalled: boolean = false;

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

	get isInstalled(): boolean {
		return this._isInstalled;
	}

	install(version: string): Thenable<void> {
		throw new Error('Method not imple m ented.');
	}

	get executableName(): string {
		if (this.platformService.platform() === 'win32') {
			return 'kubectl.exe';
		} else {
			return 'kubectl';
		}
	}

	get version(): SemVer | undefined {
		return this._version;

	}

	refresh(): Thenable<void> {
		this._isInstalled = false;
		this._version = undefined;
		let promise = new Promise<void>((resolve) => {
			const kubePath = getConfiguration(ResourceDeploymentConfigurationName, KubectlPathName);
			if (kubePath && fs.existsSync(path.join(kubePath, this.executableName))) {
				cp.exec('kubectl version --client --output=json', { cwd: kubePath }, (error, stdout, stderr) => {
					if (!error) {
						try {
							const output = JSON.parse(stdout);
							if (output && output.clientVersion && output.clientVersion.gitVersion) {
								this._version = new SemVer(`${output.clientVersion.major}.${output.clientVersion.minor}.0`)!;
								this._isInstalled = true;
							}
						}
						catch{
							// Do nothing in case of paring JSON error
						}
					}
					resolve();
				});
			} else {
				resolve();
			}
		});
		return promise;
	}
}