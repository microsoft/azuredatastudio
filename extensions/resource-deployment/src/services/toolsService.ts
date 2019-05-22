/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ToolRequirementInfo, ToolStatusInfo, ITool, ToolStatus } from '../interfaces';
import { PythonTool } from './tools/pythonTool';
import { DockerTool } from './tools/dockerTool';
import { AzCliTool } from './tools/azCliTool';
import { MSSQLCtlTool } from './tools/mssqlCtlTool';
import { KubeCtlTool } from './tools/kubeCtlTool';
import { SemVer } from 'semver';
import { PlatformService } from './platformService';

export interface IToolsService {
	getStatusForTools(toolRequirements: ToolRequirementInfo[]): ToolStatusInfo[];
	getToolByName(toolName: string): ITool | undefined;
	refreshAllToolStatus(): Thenable<void>;
}

export class ToolsService implements IToolsService {
	constructor(private _platformService: PlatformService) {
		this.SupportedTools = [new PythonTool(), new DockerTool(), new AzCliTool(), new MSSQLCtlTool(), new KubeCtlTool(this._platformService)];
	}

	private SupportedTools: ITool[];

	getStatusForTools(toolRequirements: ToolRequirementInfo[]): ToolStatusInfo[] {
		return toolRequirements.map(req => {
			const tool = this.getToolByName(req.name)!;
			return <ToolStatusInfo>{
				name: tool.displayName,
				description: tool.description,
				status: this.getToolStatus(tool.version, req.version),
				version: req.version,
				versionRequirement: req.version
			};
		});
	}

	getToolStatus(version: SemVer | undefined, versionRequirement: string): ToolStatus {
		return ToolStatus.Installed;
	}

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

	refreshAllToolStatus(): Thenable<void> {
		const promise = new Promise<void>(resolve => {
			const promises = this.SupportedTools.map(tool => tool.refresh());
			Promise.all(promises).then(() => {
				resolve();
			});
		});
		return promise;
	}
}