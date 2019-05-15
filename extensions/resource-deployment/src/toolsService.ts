/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ToolType, ToolRequirement, ToolStatusInfo, ITool } from './interfaces';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();


class PythonTool implements ITool {
	name(): string {
		return 'python';
	}
	description(): string {
		return localize('resourceDeployment.PythonDescription', 'Required by notebook feature');
	}
	type(): ToolType {
		return ToolType.Python;
	}
	displayName(): string {
		return localize('resourceDeployment.PythonDisplayName', 'Python');
	}

	isInstalled(versionExpression: string): Thenable<boolean> {
		let promise = new Promise<boolean>(resolve => {
			setTimeout(() => {
				resolve(true);
			}, 500);
		});
		return promise;
	}

	supportAutoInstall(): boolean {
		return true;
	}

	install(version: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
}

class DockerTool implements ITool {
	name(): string {
		return 'docker';
	}
	description(): string {
		return localize('resourceDeployment.DockerDescription', 'Manages the containers');
	}
	type(): ToolType {
		return ToolType.Docker;
	}
	displayName(): string {
		return localize('resourceDeployment.DockerDisplayName', 'Docker');
	}

	isInstalled(versionExpression: string): Thenable<boolean> {
		let promise = new Promise<boolean>(resolve => {
			setTimeout(() => {
				resolve(true);
			}, 500);
		});
		return promise;
	}

	supportAutoInstall(): boolean {
		return true;
	}

	install(version: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
}

class AzCLITool implements ITool {
	name(): string {
		return 'azcli';
	}
	description(): string {
		return localize('resourceDeployment.AzCLIDescription', 'Tool used for managing Azure services');
	}
	type(): ToolType {
		return ToolType.AZCLI;
	}
	displayName(): string {
		return localize('resourceDeployment.AzCLIDisplayName', 'Azure CLI');
	}

	isInstalled(versionExpression: string): Thenable<boolean> {
		let promise = new Promise<boolean>(resolve => {
			setTimeout(() => {
				resolve(true);
			}, 500);
		});
		return promise;
	}

	supportAutoInstall(): boolean {
		return true;
	}

	install(version: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
}

class MSSQLCTLTool implements ITool {
	name(): string {
		return 'mssqlctl';
	}
	description(): string {
		return localize('resourceDeployment.MSSQLCTLDescription', 'Command-line tool for installing and managing the SQL Server big data cluster');
	}
	type(): ToolType {
		return ToolType.MSSQLCTL;
	}
	displayName(): string {
		return localize('resourceDeployment.MSSQLCTLDisplayName', 'mssqlctl');
	}

	isInstalled(versionExpression: string): Thenable<boolean> {
		let promise = new Promise<boolean>(resolve => {
			setTimeout(() => {
				resolve(true);
			}, 500);
		});
		return promise;
	}

	supportAutoInstall(): boolean {
		return true;
	}

	install(version: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
}

class KUBECTLTool implements ITool {
	name(): string {
		return 'kubectl';
	}
	description(): string {
		return localize('resourceDeployment.KUBECTLDescription', 'Tool used for managing the Kubernetes cluster');
	}
	type(): ToolType {
		return ToolType.KUBECTL;
	}
	displayName(): string {
		return localize('resourceDeployment.KUBECTLDisplayName', 'kubectl');
	}

	isInstalled(versionExpression: string): Thenable<boolean> {
		let promise = new Promise<boolean>(resolve => {
			setTimeout(() => {
				resolve(true);
			}, 500);
		});
		return promise;
	}

	supportAutoInstall(): boolean {
		return true;
	}

	install(version: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
}

const SupportedTools = [new PythonTool(), new DockerTool(), new AzCLITool(), new MSSQLCTLTool(), new KUBECTLTool()];

export class ToolService {
	public static getToolStatus(toolRequirements: ToolRequirement[]): Thenable<ToolStatusInfo[]> {
		const toolStatusList: ToolStatusInfo[] = [];
		let promises = [];
		for (let i = 0; i < toolRequirements.length; i++) {
			const toolRequirement = toolRequirements[i];
			const tool = this.getTool(toolRequirement.name);
			if (tool !== undefined) {
				promises.push(tool.isInstalled(toolRequirement.version).then(installed => {
					toolStatusList.push(<ToolStatusInfo>{
						name: tool.displayName(),
						description: tool.description(),
						status: installed ? localize('resourceDeployment.StatusInstalled', 'Installed') : localize('resourceDeployment.StatusNotInstalled', 'Not Installed'),
						version: toolRequirement.version
					});
				}));
			}
		}
		return Promise.all(promises).then(() => { return toolStatusList; });
	}

	public static getTool(toolName: string): ITool | undefined {
		if (toolName) {
			for (let i = 0; i < SupportedTools.length; i++) {
				if (toolName === SupportedTools[i].name()) {
					return SupportedTools[i];
				}
			}
		}
		return undefined;
	}

}