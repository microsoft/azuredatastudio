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

export class KubeCtlTool extends ToolBase {
	constructor(platformService: IPlatformService) {
		super(platformService);
	}

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

	protected getVersionFromOutput(output: string): SemVer | undefined {
		let version: SemVer | undefined = undefined;
		if (output) {
			const versionJson = JSON.parse(output);
			version = new SemVer(`${versionJson.clientVersion.major}.${versionJson.clientVersion.minor}.0`);
		}
		return version;
	}

	protected get versionCommand(): string {
		return 'kubectl version -o json --client';
	}
}
