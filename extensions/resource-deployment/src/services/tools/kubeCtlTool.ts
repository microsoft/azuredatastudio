/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ToolType, ITool } from '../../interfaces';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class KubeCtlTool implements ITool {
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
}
