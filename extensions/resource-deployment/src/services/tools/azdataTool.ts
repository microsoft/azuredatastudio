/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ToolType } from '../../interfaces';
import * as nls from 'vscode-nls';
import { SemVer } from 'semver';
import { EOL } from 'os';
import { IPlatformService } from '../platformService';
import { ToolBase } from './toolBase';

const localize = nls.loadMessageBundle();

export class AzdataTool extends ToolBase {
	constructor(platformService: IPlatformService) {
		super(platformService);
	}

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

	protected get versionCommand(): string {
		return 'azdata -v';
	}

	protected getVersionFromOutput(output: string): SemVer | undefined {
		let version: SemVer | undefined = undefined;
		if (output && output.split(EOL).length > 0) {
			version = new SemVer(output.split(EOL)[0].replace(/ /g, ''));
		}
		return version;
	}
}
