/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SemVer } from 'semver';
import * as nls from 'vscode-nls';
import { Command, ToolType, OsDistribution } from '../../interfaces';
import { IPlatformService } from '../platformService';
import { ToolBase } from './toolBase';

const localize = nls.loadMessageBundle();

export class DockerTool extends ToolBase {
	protected discoveryCommand: Command = { command: '' };
	constructor(platformService: IPlatformService) {
		super(platformService);
	}

	get name(): string {
		return 'docker';
	}

	get description(): string {
		return localize('resourceDeployment.DockerDescription', "Packages and runs applications in isolated containers");
	}

	get type(): ToolType {
		return ToolType.Docker;
	}

	get displayName(): string {
		return localize('resourceDeployment.DockerDisplayName', "docker");
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

	protected get versionCommand(): Command {
		return { command: 'docker version --format "{{json .}}"' };
	}

	protected readonly allInstallationCommands: Map<OsDistribution, Command[]> = new Map<OsDistribution, Command[]>();
}
