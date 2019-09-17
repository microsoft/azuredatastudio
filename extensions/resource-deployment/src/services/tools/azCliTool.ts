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

export class AzCliTool implements ITool {
	get name(): string {
		return 'azcli';
	}

	get description(): string {
		return localize('resourceDeployment.AzCLIDescription', 'A command-line tool for managing Azure resources');
	}

	get type(): ToolType {
		return ToolType.AzCli;
	}

	get displayName(): string {
		return localize('resourceDeployment.AzCLIDisplayName', 'Azure CLI');
	}

	get homePage(): string {
		return 'https://docs.microsoft.com/cli/azure/install-azure-cli';
	}

	get isInstalled(): boolean {
		return this._isInstalled;
	}

	get version(): SemVer | undefined {
		return this._version;
	}

	loadInformation(): Thenable<void> {
		return new Promise<void>((resolve, reject) => {
			cp.exec('az --version', (error, stdout, stderror) => {
				if (stdout && stdout.includes('azure-cli')) {
					try {
						this._version = new SemVer(stdout.split('\n')[0].replace('azure-cli', '').replace(/ /g, '').replace('*', ''));
						this._isInstalled = true;
					}
					catch (err) {
						console.error('error parsing AzureCLI version: ' + err);
					}
				}
				resolve();
			});
		});
	}

	private _isInstalled: boolean = false;
	private _version?: SemVer;
}
