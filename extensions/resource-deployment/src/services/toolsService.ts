/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ITool } from '../interfaces';
import { DockerTool } from './tools/dockerTool';
import { AzCliTool } from './tools/azCliTool';
import { AzDataTool } from './tools/azdataTool';
import { KubeCtlTool } from './tools/kubeCtlTool';

export interface IToolsService {
	getToolByName(toolName: string): ITool | undefined;
}

export class ToolsService implements IToolsService {
	constructor() {
		this.SupportedTools = [new DockerTool(), new AzCliTool(), new AzDataTool(), new KubeCtlTool()];
	}

	private SupportedTools: ITool[];

	getToolByName(toolName: string): ITool | undefined {
		return this.SupportedTools.find(t => t.name === toolName);
	}
}