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
}

export class ToolsService implements IToolsService {
	private supportedTools: ITool[];

	constructor(private _platformService: IPlatformService) {
		this.supportedTools = [new DockerTool(this._platformService), new AzCliTool(this._platformService), new AzdataTool(this._platformService), new KubeCtlTool(this._platformService)];
	}

	getToolByName(toolName: string): ITool | undefined {
		return this.supportedTools.find(t => t.name === toolName);
	}
}
