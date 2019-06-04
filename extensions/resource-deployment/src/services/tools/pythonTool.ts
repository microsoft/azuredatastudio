/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ToolType, ITool } from '../../interfaces';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class PythonTool implements ITool {
	get name(): string {
		return 'python';
	}

	get description(): string {
		return localize('resourceDeployment.PythonDescription', 'Required by notebook feature');
	}

	get type(): ToolType {
		return ToolType.Python;
	}

	get displayName(): string {
		return localize('resourceDeployment.PythonDisplayName', 'Python');
	}
}