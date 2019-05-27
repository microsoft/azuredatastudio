/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ToolType, ITool } from '../../interfaces';
import * as nls from 'vscode-nls';
import { SemVer } from 'semver';
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

	get version(): SemVer {
		return new SemVer('1.1.1');
	}

	get isInstalled(): boolean {
		return true;
	}

	install(version: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	refresh(): Thenable<void> {
		const promise = new Promise<void>((resolve) => {
			setTimeout(resolve, 500);
		});
		return promise;
	}
}