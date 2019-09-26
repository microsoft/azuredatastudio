/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ToolType } from '../../interfaces';
import * as nls from 'vscode-nls';
import { SemVer } from 'semver';
import { IPlatformService } from '../platformService';
import { ToolBase } from './toolBase';

const localize = nls.loadMessageBundle();

export class DockerTool extends ToolBase {
	constructor(platformService: IPlatformService) {
		super(platformService);
	}

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

	protected getVersionFromOutput(output: string): SemVer | undefined {
		let version: SemVer | undefined = undefined;
		if (output) {
			version = new SemVer(JSON.parse(output).Client.Version, true);
		}
		return version;
	}
	protected get versionCommand(): string {
		return 'docker version --format "{{json .}}"';
	}
}
