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

export class AzdataTool implements ITool {
	get name(): string {
		return 'azdata';
	}

	get description(): string {
		return localize('resourceDeployment.AzdataDescription', "A command-line utility written in Python that enables cluster administrators to bootstrap and manage the big data cluster via REST APIs");
	}

	get type(): ToolType {
		return ToolType.Azdata;
	}

	get displayName(): string {
		return localize('resourceDeployment.AzdataDisplayName', "azdata");
	}

	get homePage(): string {
		return 'https://docs.microsoft.com/sql/big-data-cluster/deploy-install-azdata';
	}

	get isInstalled(): boolean {
		return this._isInstalled;
	}

	get version(): SemVer | undefined {
		return this._version;
	}

	loadInformation(): Thenable<void> {
		return new Promise<void>((resolve, reject) => {
			cp.exec('azdata -v', (error, stdout, stderror) => {
				if (stdout && stdout.split('\n').length > 0) {
					this._isInstalled = true;
					this._version = new SemVer(stdout.split('\n')[0].replace(/ /g, ''));
				}
				if (stderror) {
					console.error('error parsing azdata version: ' + stderror);
				}
				resolve();
			});
		});
	}

	private _isInstalled: boolean = false;
	private _version: SemVer | undefined = undefined;
}
