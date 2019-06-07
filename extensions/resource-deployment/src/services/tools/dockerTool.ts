/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ToolType, ITool } from '../../interfaces';
import * as nls from 'vscode-nls';
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
}