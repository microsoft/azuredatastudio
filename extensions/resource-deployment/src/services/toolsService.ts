/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ToolRequirementInfo, ToolStatusInfo, ITool } from '../interfaces';
import { PythonTool } from './tools/pythonTool';
import { DockerTool } from './tools/dockerTool';
import { AzCliTool } from './tools/azCliTool';
import { MSSQLCtlTool } from './tools/mssqlCtlTool';
import { KubeCtlTool } from './tools/kubeCtlTool';

export interface IToolsService {
	getToolStatus(toolRequirements: ToolRequirementInfo[]): Thenable<ToolStatusInfo[]>;
	getToolByName(toolName: string): ITool | undefined;
}

export class ToolsService implements IToolsService {
	private static readonly SupportedTools: ITool[] = [new PythonTool(), new DockerTool(), new AzCliTool(), new MSSQLCtlTool(), new KubeCtlTool()];

	getToolStatus(toolRequirements: ToolRequirementInfo[]): Thenable<ToolStatusInfo[]> {
		const toolStatusList: ToolStatusInfo[] = [];
		let promises = [];
		for (let i = 0; i < toolRequirements.length; i++) {
			const toolRequirement = toolRequirements[i];
			const tool = this.getToolByName(toolRequirement.name);
			if (tool !== undefined) {
				promises.push(tool.getInstallationStatus(toolRequirement.version).then(installStatus => {
					toolStatusList.push(<ToolStatusInfo>{
						name: tool.displayName,
						description: tool.description,
						status: installStatus,
						version: toolRequirement.version
					});
				}));
			}
		}
		return Promise.all(promises).then(() => { return toolStatusList; });
	}

	getToolByName(toolName: string): ITool | undefined {
		if (toolName) {
			for (let i = 0; i < ToolsService.SupportedTools.length; i++) {
				if (toolName === ToolsService.SupportedTools[i].name) {
					return ToolsService.SupportedTools[i];
				}
			}
		}
		return undefined;
	}

}