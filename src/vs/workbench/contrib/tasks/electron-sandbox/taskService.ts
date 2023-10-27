/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import * as semver from 'vs/base/common/semver/semver';
import { IWorkspaceFolder, IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { ITaskSystem } from 'vs/workbench/contrib/tasks/common/taskSystem';
import { ExecutionEngine } from 'vs/workbench/contrib/tasks/common/tasks';
import * as TaskConfig from '../common/taskConfiguration';
import { AbstractTaskService } from 'vs/workbench/contrib/tasks/browser/abstractTaskService';
import { ITaskFilter, ITaskService } from 'vs/workbench/contrib/tasks/common/taskService';
import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { TerminalTaskSystem } from 'vs/workbench/contrib/tasks/browser/terminalTaskSystem';
import { IConfirmationResult, IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { TerminateResponseCode } from 'vs/base/common/processes';
import { IModelService } from 'vs/editor/common/services/model';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IFileService } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';
import { IMarkerService } from 'vs/platform/markers/common/markers';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IViewsService, IViewDescriptorService } from 'vs/workbench/common/views';
import { IOutputService } from 'vs/workbench/services/output/common/output';
import { ITerminalGroupService, ITerminalService } from 'vs/workbench/contrib/terminal/browser/terminal';
import { IConfigurationResolverService } from 'vs/workbench/services/configurationResolver/common/configurationResolver';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { ILifecycleService } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IPathService } from 'vs/workbench/services/path/common/pathService';
import { IPreferencesService } from 'vs/workbench/services/preferences/common/preferences';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { ITaskService as ISqlTaskService } from 'sql/workbench/services/tasks/common/tasksService'; // {{SQL CARBON EDIT}} integration with tasks view panel
import { IWorkspaceTrustManagementService, IWorkspaceTrustRequestService } from 'vs/platform/workspace/common/workspaceTrust';
import { ITerminalProfileResolverService } from 'vs/workbench/contrib/terminal/common/terminal';
import { IPaneCompositePartService } from 'vs/workbench/services/panecomposite/browser/panecomposite';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';
import { IAudioCueService } from 'vs/platform/audioCues/browser/audioCueService';

interface IWorkspaceFolderConfigurationResult {
	workspaceFolder: IWorkspaceFolder;
	config: TaskConfig.IExternalTaskRunnerConfiguration | undefined;
	hasErrors: boolean;
}

export class TaskService extends AbstractTaskService {
	constructor(@IConfigurationService configurationService: IConfigurationService,
		@IMarkerService markerService: IMarkerService,
		@IOutputService outputService: IOutputService,
		@IPaneCompositePartService paneCompositeService: IPaneCompositePartService,
		@IViewsService viewsService: IViewsService,
		@ICommandService commandService: ICommandService,
		@IEditorService editorService: IEditorService,
		@IFileService fileService: IFileService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@ITelemetryService telemetryService: ITelemetryService,
		@ITextFileService textFileService: ITextFileService,
		@ILifecycleService lifecycleService: ILifecycleService,
		@IModelService modelService: IModelService,
		@IExtensionService extensionService: IExtensionService,
		@IQuickInputService quickInputService: IQuickInputService,
		@IConfigurationResolverService configurationResolverService: IConfigurationResolverService,
		@ITerminalService terminalService: ITerminalService,
		@ITerminalGroupService terminalGroupService: ITerminalGroupService,
		@IStorageService storageService: IStorageService,
		@IProgressService progressService: IProgressService,
		@IOpenerService openerService: IOpenerService,
		@IDialogService dialogService: IDialogService,
		@INotificationService notificationService: INotificationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
		@ITerminalProfileResolverService terminalProfileResolverService: ITerminalProfileResolverService,
		@IPathService pathService: IPathService,
		@ITextModelService textModelResolverService: ITextModelService,
		@IPreferencesService preferencesService: IPreferencesService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IWorkspaceTrustRequestService workspaceTrustRequestService: IWorkspaceTrustRequestService,
		@IWorkspaceTrustManagementService workspaceTrustManagementService: IWorkspaceTrustManagementService,
		@ILogService logService: ILogService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IRemoteAgentService remoteAgentService: IRemoteAgentService,
		@IAudioCueService audioCueService: IAudioCueService,
		@ISqlTaskService sqlTaskService: ISqlTaskService // {{SQL CARBON EDIT}} add param
	) {
		super(configurationService,
			markerService,
			outputService,
			paneCompositeService,
			viewsService,
			commandService,
			editorService,
			fileService,
			contextService,
			telemetryService,
			textFileService,
			modelService,
			extensionService,
			quickInputService,
			configurationResolverService,
			terminalService,
			terminalGroupService,
			storageService,
			progressService,
			openerService,
			dialogService,
			notificationService,
			contextKeyService,
			environmentService,
			terminalProfileResolverService,
			pathService,
			textModelResolverService,
			preferencesService,
			viewDescriptorService,
			workspaceTrustRequestService,
			workspaceTrustManagementService,
			logService,
			themeService,
			lifecycleService,
			remoteAgentService,
			instantiationService,
			sqlTaskService); // {{SQL CARBON EDIT}}
		this._register(lifecycleService.onBeforeShutdown(event => event.veto(this.beforeShutdown(), 'veto.tasks')));
	}

	protected _getTaskSystem(): ITaskSystem {
		if (this._taskSystem) {
			return this._taskSystem;
		}
		const taskSystem = this._createTerminalTaskSystem();
		this._taskSystem = taskSystem;
		this._taskSystemListeners =
			[
				this._taskSystem.onDidStateChange((event) => {
					this._taskRunningState.set(this._taskSystem!.isActiveSync());
					this._onDidStateChange.fire(event);
				})
			];
		return this._taskSystem;
	}

	protected _computeLegacyConfiguration(workspaceFolder: IWorkspaceFolder): Promise<IWorkspaceFolderConfigurationResult> {
		const { config, hasParseErrors } = this._getConfiguration(workspaceFolder);
		if (hasParseErrors) {
			return Promise.resolve({ workspaceFolder: workspaceFolder, hasErrors: true, config: undefined });
		}
		if (config) {
			return Promise.resolve({ workspaceFolder, config, hasErrors: false });
		} else {
			return Promise.resolve({ workspaceFolder: workspaceFolder, hasErrors: true, config: undefined });
		}
	}

	protected _versionAndEngineCompatible(filter?: ITaskFilter): boolean {
		const range = filter && filter.version ? filter.version : undefined;
		const engine = this.executionEngine;

		return (range === undefined) || ((semver.satisfies('0.1.0', range) && engine === ExecutionEngine.Process) || (semver.satisfies('2.0.0', range) && engine === ExecutionEngine.Terminal));
	}

	public beforeShutdown(): boolean | Promise<boolean> {
		if (!this._taskSystem) {
			return false;
		}
		if (!this._taskSystem.isActiveSync()) {
			return false;
		}
		// The terminal service kills all terminal on shutdown. So there
		// is nothing we can do to prevent this here.
		if (this._taskSystem instanceof TerminalTaskSystem) {
			return false;
		}

		let terminatePromise: Promise<IConfirmationResult>;
		if (this._taskSystem.canAutoTerminate()) {
			terminatePromise = Promise.resolve({ confirmed: true });
		} else {
			terminatePromise = this._dialogService.confirm({
				message: nls.localize('TaskSystem.runningTask', 'There is a task running. Do you want to terminate it?'),
				primaryButton: nls.localize({ key: 'TaskSystem.terminateTask', comment: ['&& denotes a mnemonic'] }, "&&Terminate Task")
			});
		}

		return terminatePromise.then(res => {
			if (res.confirmed) {
				return this._taskSystem!.terminateAll().then((responses) => {
					let success = true;
					let code: number | undefined = undefined;
					for (const response of responses) {
						success = success && response.success;
						// We only have a code in the old output runner which only has one task
						// So we can use the first code.
						if (code === undefined && response.code !== undefined) {
							code = response.code;
						}
					}
					if (success) {
						this._taskSystem = undefined;
						this._disposeTaskSystemListeners();
						return false; // no veto
					} else if (code && code === TerminateResponseCode.ProcessNotFound) {
						return this._dialogService.confirm({
							message: nls.localize('TaskSystem.noProcess', 'The launched task doesn\'t exist anymore. If the task spawned background processes exiting VS Code might result in orphaned processes. To avoid this start the last background process with a wait flag.'),
							primaryButton: nls.localize({ key: 'TaskSystem.exitAnyways', comment: ['&& denotes a mnemonic'] }, "&&Exit Anyways"),
							type: 'info'
						}).then(res => !res.confirmed);
					}
					return true; // veto
				}, (err) => {
					return true; // veto
				});
			}

			return true; // veto
		});
	}
}

registerSingleton(ITaskService, TaskService, InstantiationType.Delayed);
