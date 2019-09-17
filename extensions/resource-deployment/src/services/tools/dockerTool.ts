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

export class DockerTool implements ITool {
	get name(): string {
		return 'docker';
	}

	get description(): string {
		return localize('resourceDeployment.DockerDescription', 'Provides the ability to package and run an application in isolated containers');
	}

	get type(): ToolType {
		return ToolType.Docker;
	}

	get displayName(): string {
		return localize('resourceDeployment.DockerDisplayName', 'Docker');
	}

	get homePage(): string {
		return 'https://docs.docker.com/install';
	}

	get isInstalled(): boolean {
		return this._isInstalled;
	}

	get version(): SemVer | undefined {
		return this._version;
	}

	loadInformation(): Thenable<void> {
		return new Promise<void>((resolve, reject) => {
			cp.exec('docker version --format "{{json .}}"', (error, stdout, stderror) => {
				if (stdout) {
					try {
						this._version = new SemVer(JSON.parse(stdout).Client.Version, true);
						this._isInstalled = true;
					}
					catch (err) {
						console.error('error parsing Docker version: ' + err);
					}
				}
				resolve();
			});
		});
	}

	private _isInstalled: boolean = false;
	private _version: SemVer | undefined = undefined;
}
