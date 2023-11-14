/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'vs/base/common/path';

import { URI, UriComponents } from 'vs/base/common/uri';
import { win32 } from 'vs/base/node/processes';
import * as types from 'vs/workbench/api/common/extHostTypes';
import { IExtHostWorkspace } from 'vs/workbench/api/common/extHostWorkspace';
import type * as vscode from 'vscode';
import * as tasks from '../common/shared/tasks';
import { IExtHostDocumentsAndEditors } from 'vs/workbench/api/common/extHostDocumentsAndEditors';
import { IExtHostConfiguration } from 'vs/workbench/api/common/extHostConfiguration';
import { IWorkspaceFolder, WorkspaceFolder } from 'vs/platform/workspace/common/workspace';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { IExtHostTerminalService } from 'vs/workbench/api/common/extHostTerminalService';
import { IExtHostRpcService } from 'vs/workbench/api/common/extHostRpcService';
import { IExtHostInitDataService } from 'vs/workbench/api/common/extHostInitDataService';
import { ExtHostTaskBase, TaskHandleDTO, TaskDTO, CustomExecutionDTO, HandlerData } from 'vs/workbench/api/common/extHostTask';
import { Schemas } from 'vs/base/common/network';
import { ILogService } from 'vs/platform/log/common/log';
import { IExtHostApiDeprecationService } from 'vs/workbench/api/common/extHostApiDeprecationService';
import * as resources from 'vs/base/common/resources';
import { homedir } from 'os';
import { IExtHostVariableResolverProvider } from 'vs/workbench/api/common/extHostVariableResolverService';

export class ExtHostTask extends ExtHostTaskBase {
	constructor(
		@IExtHostRpcService extHostRpc: IExtHostRpcService,
		@IExtHostInitDataService initData: IExtHostInitDataService,
		@IExtHostWorkspace private readonly workspaceService: IExtHostWorkspace,
		@IExtHostDocumentsAndEditors editorService: IExtHostDocumentsAndEditors,
		@IExtHostConfiguration configurationService: IExtHostConfiguration,
		@IExtHostTerminalService extHostTerminalService: IExtHostTerminalService,
		@ILogService logService: ILogService,
		@IExtHostApiDeprecationService deprecationService: IExtHostApiDeprecationService,
		@IExtHostVariableResolverProvider private readonly variableResolver: IExtHostVariableResolverProvider,
	) {
		super(extHostRpc, initData, workspaceService, editorService, configurationService, extHostTerminalService, logService, deprecationService);
		if (initData.remote.isRemote && initData.remote.authority) {
			this.registerTaskSystem(Schemas.vscodeRemote, {
				scheme: Schemas.vscodeRemote,
				authority: initData.remote.authority,
				platform: process.platform
			});
		} else {
			this.registerTaskSystem(Schemas.file, {
				scheme: Schemas.file,
				authority: '',
				platform: process.platform
			});
		}
		this._proxy.$registerSupportedExecutions(true, true, true);
	}

	public async executeTask(extension: IExtensionDescription, task: vscode.Task): Promise<vscode.TaskExecution> {
		const tTask = (task as types.Task);

		if (!task.execution && (tTask._id === undefined)) {
			throw new Error('Tasks to execute must include an execution');
		}

		// We have a preserved ID. So the task didn't change.
		if (tTask._id !== undefined) {
			// Always get the task execution first to prevent timing issues when retrieving it later
			const handleDto = TaskHandleDTO.from(tTask, this.workspaceService);
			const executionDTO = await this._proxy.$getTaskExecution(handleDto);
			if (executionDTO.task === undefined) {
				throw new Error('Task from execution DTO is undefined');
			}
			const execution = await this.getTaskExecution(executionDTO, task);
			this._proxy.$executeTask(handleDto).catch(() => { /* The error here isn't actionable. */ });
			return execution;
		} else {
			const dto = TaskDTO.from(task, extension);
			if (dto === undefined) {
				return Promise.reject(new Error('Task is not valid'));
			}

			// If this task is a custom execution, then we need to save it away
			// in the provided custom execution map that is cleaned up after the
			// task is executed.
			if (CustomExecutionDTO.is(dto.execution)) {
				await this.addCustomExecution(dto, task, false);
			}
			// Always get the task execution first to prevent timing issues when retrieving it later
			const execution = await this.getTaskExecution(await this._proxy.$getTaskExecution(dto), task);
			this._proxy.$executeTask(dto).catch(() => { /* The error here isn't actionable. */ });
			return execution;
		}
	}

	protected provideTasksInternal(validTypes: { [key: string]: boolean }, taskIdPromises: Promise<void>[], handler: HandlerData, value: vscode.Task[] | null | undefined): { tasks: tasks.ITaskDTO[]; extension: IExtensionDescription } {
		const taskDTOs: tasks.ITaskDTO[] = [];
		if (value) {
			for (const task of value) {
				this.checkDeprecation(task, handler);

				if (!task.definition || !validTypes[task.definition.type]) {
					this._logService.warn(`The task [${task.source}, ${task.name}] uses an undefined task type. The task will be ignored in the future.`);
				}

				const taskDTO: tasks.ITaskDTO | undefined = TaskDTO.from(task, handler.extension);
				if (taskDTO) {
					taskDTOs.push(taskDTO);

					if (CustomExecutionDTO.is(taskDTO.execution)) {
						// The ID is calculated on the main thread task side, so, let's call into it here.
						// We need the task id's pre-computed for custom task executions because when OnDidStartTask
						// is invoked, we have to be able to map it back to our data.
						taskIdPromises.push(this.addCustomExecution(taskDTO, task, true));
					}
				}
			}
		}
		return {
			tasks: taskDTOs,
			extension: handler.extension
		};
	}

	protected async resolveTaskInternal(resolvedTaskDTO: tasks.ITaskDTO): Promise<tasks.ITaskDTO | undefined> {
		return resolvedTaskDTO;
	}

	private async getAFolder(workspaceFolders: vscode.WorkspaceFolder[] | undefined): Promise<IWorkspaceFolder> {
		let folder = (workspaceFolders && workspaceFolders.length > 0) ? workspaceFolders[0] : undefined;
		if (!folder) {
			const userhome = URI.file(homedir());
			folder = new WorkspaceFolder({ uri: userhome, name: resources.basename(userhome), index: 0 });
		}
		return {
			uri: folder.uri,
			name: folder.name,
			index: folder.index,
			toResource: () => {
				throw new Error('Not implemented');
			}
		};
	}

	public async $resolveVariables(uriComponents: UriComponents, toResolve: { process?: { name: string; cwd?: string; path?: string }; variables: string[] }): Promise<{ process?: string; variables: { [key: string]: string } }> {
		const uri: URI = URI.revive(uriComponents);
		const result = {
			process: <unknown>undefined as string,
			variables: Object.create(null)
		};
		const workspaceFolder = await this._workspaceProvider.resolveWorkspaceFolder(uri);
		const workspaceFolders = (await this._workspaceProvider.getWorkspaceFolders2()) ?? [];

		const resolver = await this.variableResolver.getResolver();
		const ws: IWorkspaceFolder = workspaceFolder ? {
			uri: workspaceFolder.uri,
			name: workspaceFolder.name,
			index: workspaceFolder.index,
			toResource: () => {
				throw new Error('Not implemented');
			}
		} : await this.getAFolder(workspaceFolders);

		for (const variable of toResolve.variables) {
			result.variables[variable] = await resolver.resolveAsync(ws, variable);
		}
		if (toResolve.process !== undefined) {
			let paths: string[] | undefined = undefined;
			if (toResolve.process.path !== undefined) {
				paths = toResolve.process.path.split(path.delimiter);
				for (let i = 0; i < paths.length; i++) {
					paths[i] = await resolver.resolveAsync(ws, paths[i]);
				}
			}
			result.process = await win32.findExecutable(
				await resolver.resolveAsync(ws, toResolve.process.name),
				toResolve.process.cwd !== undefined ? await resolver.resolveAsync(ws, toResolve.process.cwd) : undefined,
				paths
			);
		}
		return result;
	}

	public async $jsonTasksSupported(): Promise<boolean> {
		return true;
	}

	public async $findExecutable(command: string, cwd?: string, paths?: string[]): Promise<string> {
		return win32.findExecutable(command, cwd, paths);
	}
}
