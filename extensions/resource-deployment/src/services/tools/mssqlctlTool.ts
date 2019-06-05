/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ToolType, ITool } from '../../interfaces';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class MSSQLCtlTool implements ITool {
	get name(): string {
		return 'mssqlctl';
	}

	get description(): string {
		return localize('resourceDeployment.MssqlCtlDescription', 'The command-line tool to manage SQL Server Big Data Cluster');
	}

	get type(): ToolType {
		return ToolType.MSSQLCtl;
	}

	get displayName(): string {
		return localize('resourceDeployment.MssqlCtlDisplayName', 'mssqlctl');
	}
}