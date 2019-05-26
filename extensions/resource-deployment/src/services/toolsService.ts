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
	getStatusForTools(toolRequirements: ToolRequirementInfo[]): Thenable<ToolStatusInfo[]>;
	getToolByName(toolName: string): ITool | undefined;
}

export class ToolsService implements IToolsService {
	constructor(private _platformService: PlatformService) {
		this.SupportedTools = [new PythonTool(), new DockerTool(), new AzCliTool(), new MSSQLCtlTool(), new KubeCtlTool(this._platformService)];
	}

	private SupportedTools: ITool[];

	getStatusForTools(toolRequirements: ToolRequirementInfo[]): Thenable<ToolStatusInfo[]> {
		const promises: Thenable<void>[] = [];
		toolRequirements.forEach(toolReq => {
			const tool = this.getToolByName(toolReq.name)!;
			promises.push(tool.refresh());
		});

		return Promise.all(promises).then(() => {
			return toolRequirements.map(toolReq => {
				const tool = this.getToolByName(toolReq.name)!;
				return <ToolStatusInfo>{
					name: tool.displayName,
					description: tool.description,
					status: this.calculateToolStatus(tool.version, toolReq.version),
					version: tool.version ? tool.version.version : '',
					versionRequirement: toolReq.version
				};
			});
		});
	}

	calculateToolStatus(version: SemVer | undefined, versionRequirement: string): ToolStatus {
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
}