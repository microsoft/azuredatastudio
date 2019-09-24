/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ToolType, ITool } from '../../interfaces';
import { SemVer } from 'semver';
import { IPlatformService } from '../platformService';
import * as nls from 'vscode-nls';
import { EOL } from 'os';
const localize = nls.loadMessageBundle();

export abstract class ToolBase implements ITool {
	constructor(private _platformService: IPlatformService) { }

	abstract name: string;
	abstract displayName: string;
	abstract description: string;
	abstract type: ToolType;
	abstract homePage: string;
	protected abstract getVersionFromOutput(output: string): SemVer | undefined;
	protected abstract readonly versionCommand: string;

	public get version(): SemVer | undefined {
		return this._version;
	}

	public get isInstalled(): boolean {
		return this._isInstalled;
	}

	public get statusDescription(): string | undefined {
		return this._statusDescription;
	}

	public loadInformation(): Promise<void> {
		if (this._isInstalled) {
			return Promise.resolve();
		}
		this._isInstalled = false;
		this._statusDescription = undefined;
		this._version = undefined;
		this._versionOutput = undefined;
		return this._platformService.runCommand(this.versionCommand).then((stdout) => {
			this._versionOutput = stdout;
			this._version = this.getVersionFromOutput(stdout);
			if (this._version) {
				this._isInstalled = true;
			} else {
				throw localize('deployCluster.InvalidToolVersionOutput', "Invalid output received.");
			}
		}).catch((error) => {
			const errorMessage = typeof error === 'string' ? error :
				typeof error.message === 'string' ? error.message : '';
			this._statusDescription = localize('deployCluster.GetToolVersionError', "Error retrieving version information.{0}Error: {1}{0}stdout: {2} ", EOL, errorMessage, this._versionOutput);
		});
	}

	private _isInstalled: boolean = false;
	private _version?: SemVer;
	private _statusDescription?: string;
	private _versionOutput?: string;
}
