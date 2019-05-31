/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ITool } from '../interfaces';
import { PythonTool } from './tools/pythonTool';
import { DockerTool } from './tools/dockerTool';
import { AzCliTool } from './tools/azCliTool';
import { MSSQLCtlTool } from './tools/mssqlCtlTool';
import { KubeCtlTool } from './tools/kubeCtlTool';

export interface IToolsService {
	getToolByName(toolName: string): ITool | undefined;
}

export class ToolsService implements IToolsService {
	constructor() {
		this.SupportedTools = [new PythonTool(), new DockerTool(), new AzCliTool(), new MSSQLCtlTool(), new KubeCtlTool()];
	}

	private SupportedTools: ITool[];

	getToolByName(toolName: string): ITool | undefined {
		if (toolName) {
			for (let i = 0; i < this.SupportedTools.length; i++) {
				if (toolName === this.SupportedTools[i].name) {
					return this.SupportedTools[i];
				}
			}
		}
		return undefined;
	}
}