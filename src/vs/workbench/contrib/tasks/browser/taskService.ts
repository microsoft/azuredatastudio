/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { IWorkspaceFolder } from 'vs/platform/workspace/common/workspace';
import { ITaskSystem } from 'vs/workbench/contrib/tasks/common/taskSystem';
import { ExecutionEngine } from 'vs/workbench/contrib/tasks/common/tasks';
import { AbstractTaskService, IWorkspaceFolderConfigurationResult } from 'vs/workbench/contrib/tasks/browser/abstractTaskService';
import { ITaskFilter, ITaskService } from 'vs/workbench/contrib/tasks/common/taskService';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';

export class TaskService extends AbstractTaskService {
	private static readonly ProcessTaskSystemSupportMessage = nls.localize('taskService.processTaskSystem', 'Process task system is not support in the web.');

	protected _getTaskSystem(): ITaskSystem {
		if (this._taskSystem) {
			return this._taskSystem;
		}
		if (this.executionEngine === ExecutionEngine.Terminal) {
			this._taskSystem = this._createTerminalTaskSystem();
		} else {
			throw new Error(TaskService.ProcessTaskSystemSupportMessage);
		}
		this._taskSystemListener = this._taskSystem!.onDidStateChange((event) => {
			if (this._taskSystem) {
				this._taskRunningState.set(this._taskSystem.isActiveSync());
			}
			this._onDidStateChange.fire(event);
		});
		return this._taskSystem!;
	}

	protected _computeLegacyConfiguration(workspaceFolder: IWorkspaceFolder): Promise<IWorkspaceFolderConfigurationResult> {
		throw new Error(TaskService.ProcessTaskSystemSupportMessage);
	}

	protected _versionAndEngineCompatible(filter?: ITaskFilter): boolean {
		return this.executionEngine === ExecutionEngine.Terminal;
	}
}

registerSingleton(ITaskService, TaskService, true);
