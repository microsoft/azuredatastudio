/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ITool } from '../interfaces';
import { DockerTool } from './tools/dockerTool';
import { AzCliTool } from './tools/azCliTool';
import { AzdataTool } from './tools/azdataTool';
import { KubeCtlTool } from './tools/kubeCtlTool';
import { IPlatformService } from './platformService';

export interface IToolsService {
	getToolByName(toolName: string): ITool | undefined;
	toolsForCurrentProvider: ITool[];
}

export class ToolsService implements IToolsService {
	private supportedTools: Map<string, ITool>;
	private currentTools: ITool[] = [];

	constructor(private _platformService: IPlatformService) {
		this.supportedTools = new Map<string, ITool>(
			[
				new DockerTool(this._platformService),
				new AzCliTool(this._platformService),
				new AzdataTool(this._platformService),
				new KubeCtlTool(this._platformService)
			].map<[string, ITool]>((tool: ITool) => [tool.name, tool])
		);
	}

	getToolByName(toolName: string): ITool | undefined {
		return this.supportedTools.get(toolName);
	}

	get toolsForCurrentProvider(): ITool[] {
		return this.currentTools;
	}

	set toolsForCurrentProvider(tools: ITool[]) {
		this.currentTools = tools;
	}
}
