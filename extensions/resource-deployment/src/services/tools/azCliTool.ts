/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ToolType } from '../../interfaces';
import * as nls from 'vscode-nls';
import { SemVer } from 'semver';
import { IPlatformService } from '../platformService';
import { EOL } from 'os';
import { ToolBase } from './toolBase';
const localize = nls.loadMessageBundle();

export class AzCliTool extends ToolBase {
	constructor(platformService: IPlatformService) {
		super(platformService);
	}

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

	protected getVersionFromOutput(output: string): SemVer | undefined {
		if (output && output.includes('azure-cli')) {
			return new SemVer(output.split(EOL)[0].replace('azure-cli', '').replace(/ /g, '').replace('*', ''));
		} else {
			return undefined;
		}
	}
	protected get versionCommand(): string {
		return 'az --version';
	}
}
