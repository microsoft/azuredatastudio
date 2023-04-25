/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as Async from 'vs/base/common/async';
import { IStringDictionary } from 'vs/base/common/collections';
import { Emitter, Event } from 'vs/base/common/event';
import { isUNC } from 'vs/base/common/extpath';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { LinkedMap, Touch } from 'vs/base/common/map';
import * as Objects from 'vs/base/common/objects';
import * as path from 'vs/base/common/path';
import * as Platform from 'vs/base/common/platform';
import * as resources from 'vs/base/common/resources';
import Severity from 'vs/base/common/severity';
import * as Types from 'vs/base/common/types';
import * as nls from 'vs/nls';

import { IModelService } from 'vs/editor/common/services/model';
import { IFileService } from 'vs/platform/files/common/files';
import { IMarkerService, MarkerSeverity } from 'vs/platform/markers/common/markers';
import { IWorkspaceContextService, IWorkspaceFolder, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { Markers } from 'vs/workbench/contrib/markers/common/markers';
import { ProblemMatcher, ProblemMatcherRegistry /*, ProblemPattern, getResource */ } from 'vs/workbench/contrib/tasks/common/problemMatcher';

import { Codicon } from 'vs/base/common/codicons';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ILogService } from 'vs/platform/log/common/log';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IShellLaunchConfig, TerminalLocation, TerminalSettingId, WaitOnExitValue } from 'vs/platform/terminal/common/terminal';
import { formatMessageForTerminal } from 'vs/platform/terminal/common/terminalStrings';
import { ThemeIcon } from 'vs/platform/theme/common/themeService';
import { IViewDescriptorService, IViewsService, ViewContainerLocation } from 'vs/workbench/common/views';
import { TaskTerminalStatus } from 'vs/workbench/contrib/tasks/browser/taskTerminalStatus';
import { ProblemCollectorEventKind, ProblemHandlingStrategy, StartStopProblemCollector, WatchingProblemCollector } from 'vs/workbench/contrib/tasks/common/problemCollectors';
import { GroupKind } from 'vs/workbench/contrib/tasks/common/taskConfiguration';
import { CommandOptions, CommandString, ContributedTask, CustomTask, DependsOrder, ICommandConfiguration, IConfigurationProperties, IExtensionTaskSource, InMemoryTask, IPresentationOptions, IShellConfiguration, IShellQuotingOptions, ITaskEvent, PanelKind, RevealKind, RevealProblemKind, RuntimeType, ShellQuoting, Task, TaskEvent, TaskEventKind, TaskScope, TaskSettingId, TaskSourceKind } from 'vs/workbench/contrib/tasks/common/tasks';
import { ITaskService } from 'vs/workbench/contrib/tasks/common/taskService';
import { IResolvedVariables, IResolveSet, ITaskExecuteResult, ITaskResolver, ITaskSummary, ITaskSystem, ITaskSystemInfo, ITaskSystemInfoResolver, ITaskTerminateResponse, TaskError, TaskErrors, TaskExecuteKind, Triggers } from 'vs/workbench/contrib/tasks/common/taskSystem';
import { ITerminalGroupService, ITerminalInstance, ITerminalService } from 'vs/workbench/contrib/terminal/browser/terminal';
import { VSCodeOscProperty, VSCodeOscPt, VSCodeSequence } from 'vs/workbench/contrib/terminal/browser/terminalEscapeSequences';
import { TerminalProcessExtHostProxy } from 'vs/workbench/contrib/terminal/browser/terminalProcessExtHostProxy';
import { ITerminalProfileResolverService, TERMINAL_VIEW_ID } from 'vs/workbench/contrib/terminal/common/terminal';
import { IConfigurationResolverService } from 'vs/workbench/services/configurationResolver/common/configurationResolver';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IOutputService } from 'vs/workbench/services/output/common/output';
import { IPaneCompositePartService } from 'vs/workbench/services/panecomposite/browser/panecomposite';
import { IPathService } from 'vs/workbench/services/path/common/pathService';

interface ITerminalData {
	terminal: ITerminalInstance;
	lastTask: string;
	group?: string;
}

interface IActiveTerminalData {
	terminal: ITerminalInstance;
	task: Task;
	promise: Promise<ITaskSummary>;
	state?: TaskEventKind;
}

const ReconnectionType = 'Task';

class InstanceManager {
	private _currentInstances: number = 0;
	private _counter: number = 0;

	addInstance() {
		this._currentInstances++;
		this._counter++;
	}
	removeInstance() {
		this._currentInstances--;
	}
	get instances() {
		return this._currentInstances;
	}
	get counter() {
		return this._counter;
	}
}

class VariableResolver {
	private static _regex = /\$\{(.*?)\}/g;
	constructor(public workspaceFolder: IWorkspaceFolder | undefined, public taskSystemInfo: ITaskSystemInfo | undefined, public readonly values: Map<string, string>, private _service: IConfigurationResolverService | undefined) {
	}
	async resolve(value: string): Promise<string> {
		const replacers: Promise<string>[] = [];
		value.replace(VariableResolver._regex, (match, ...args) => {
			replacers.push(this._replacer(match, args));
			return match;
		});
		const resolvedReplacers = await Promise.all(replacers);
		return value.replace(VariableResolver._regex, () => resolvedReplacers.shift()!);

	}

	private async _replacer(match: string, args: string[]): Promise<string> {
		// Strip out the ${} because the map contains them variables without those characters.
		const result = this.values.get(match.substring(2, match.length - 1));
		if ((result !== undefined) && (result !== null)) {
			return result;
		}
		if (this._service) {
			return this._service.resolveAsync(this.workspaceFolder, match);
		}
		return match;
	}
}

export class VerifiedTask {
	readonly task: Task;
	readonly resolver: ITaskResolver;
	readonly trigger: string;
	resolvedVariables?: IResolvedVariables;
	systemInfo?: ITaskSystemInfo;
	workspaceFolder?: IWorkspaceFolder;
	shellLaunchConfig?: IShellLaunchConfig;

	constructor(task: Task, resolver: ITaskResolver, trigger: string) {
		this.task = task;
		this.resolver = resolver;
		this.trigger = trigger;
	}

	public verify(): boolean {
		let verified = false;
		if (this.trigger && this.resolvedVariables && this.workspaceFolder && (this.shellLaunchConfig !== undefined)) {
			verified = true;
		}
		return verified;
	}

	public getVerifiedTask(): { task: Task; resolver: ITaskResolver; trigger: string; resolvedVariables: IResolvedVariables; systemInfo: ITaskSystemInfo; workspaceFolder: IWorkspaceFolder; shellLaunchConfig: IShellLaunchConfig } {
		if (this.verify()) {
			return { task: this.task, resolver: this.resolver, trigger: this.trigger, resolvedVariables: this.resolvedVariables!, systemInfo: this.systemInfo!, workspaceFolder: this.workspaceFolder!, shellLaunchConfig: this.shellLaunchConfig! };
		} else {
			throw new Error('VerifiedTask was not checked. verify must be checked before getVerifiedTask.');
		}
	}
}

export class TerminalTaskSystem extends Disposable implements ITaskSystem {

	public static TelemetryEventName: string = 'taskService';

	private static readonly ProcessVarName = '__process__';

	private static _shellQuotes: IStringDictionary<IShellQuotingOptions> = {
		'cmd': {
			strong: '"'
		},
		'powershell': {
			escape: {
				escapeChar: '`',
				charsToEscape: ' "\'()'
			},
			strong: '\'',
			weak: '"'
		},
		'bash': {
			escape: {
				escapeChar: '\\',
				charsToEscape: ' "\''
			},
			strong: '\'',
			weak: '"'
		},
		'zsh': {
			escape: {
				escapeChar: '\\',
				charsToEscape: ' "\''
			},
			strong: '\'',
			weak: '"'
		}
	};

	private static _osShellQuotes: IStringDictionary<IShellQuotingOptions> = {
		'Linux': TerminalTaskSystem._shellQuotes['bash'],
		'Mac': TerminalTaskSystem._shellQuotes['bash'],
		'Windows': TerminalTaskSystem._shellQuotes['powershell']
	};

	private _activeTasks: IStringDictionary<IActiveTerminalData>;
	private _instances: IStringDictionary<InstanceManager>;
	private _busyTasks: IStringDictionary<Task>;
	private _terminals: IStringDictionary<ITerminalData>;
	private _idleTaskTerminals: LinkedMap<string, string>;
	private _sameTaskTerminals: IStringDictionary<string>;
	private _terminalForTask: ITerminalInstance | undefined;
	private _taskSystemInfoResolver: ITaskSystemInfoResolver;
	private _lastTask: VerifiedTask | undefined;
	// Should always be set in run
	private _currentTask!: VerifiedTask;
	private _isRerun: boolean = false;
	private _previousPanelId: string | undefined;
	private _previousTerminalInstance: ITerminalInstance | undefined;
	private _terminalStatusManager: TaskTerminalStatus;
	private _terminalCreationQueue: Promise<ITerminalInstance | void> = Promise.resolve();
	private _hasReconnected: boolean = false;
	private _tasksToReconnect: string[] = [];
	private readonly _onDidStateChange: Emitter<ITaskEvent>;

	get taskShellIntegrationStartSequence(): string {
		return this._configurationService.getValue(TaskSettingId.ShowDecorations) ? VSCodeSequence(VSCodeOscPt.PromptStart) + VSCodeSequence(VSCodeOscPt.Property, `${VSCodeOscProperty.Task}=True`) + VSCodeSequence(VSCodeOscPt.CommandStart) : '';
	}
	get taskShellIntegrationOutputSequence(): string {
		return this._configurationService.getValue(TaskSettingId.ShowDecorations) ? VSCodeSequence(VSCodeOscPt.CommandExecuted) : '';
	}

	constructor(
		private _terminalService: ITerminalService,
		private _terminalGroupService: ITerminalGroupService,
		private _outputService: IOutputService,
		private _paneCompositeService: IPaneCompositePartService,
		private _viewsService: IViewsService,
		private _markerService: IMarkerService,
		private _modelService: IModelService,
		private _configurationResolverService: IConfigurationResolverService,
		private _contextService: IWorkspaceContextService,
		private _environmentService: IWorkbenchEnvironmentService,
		private _outputChannelId: string,
		private _fileService: IFileService,
		private _terminalProfileResolverService: ITerminalProfileResolverService,
		private _pathService: IPathService,
		private _viewDescriptorService: IViewDescriptorService,
		private _logService: ILogService,
		private _configurationService: IConfigurationService,
		private _notificationService: INotificationService,
		taskService: ITaskService,
		taskSystemInfoResolver: ITaskSystemInfoResolver,
	) {
		super();

		this._activeTasks = Object.create(null);
		this._instances = Object.create(null);
		this._busyTasks = Object.create(null);
		this._terminals = Object.create(null);
		this._idleTaskTerminals = new LinkedMap<string, string>();
		this._sameTaskTerminals = Object.create(null);
		this._onDidStateChange = new Emitter();
		this._taskSystemInfoResolver = taskSystemInfoResolver;
		this._register(this._terminalStatusManager = new TaskTerminalStatus(taskService));
	}

	private _reconnectToTerminals(terminals: ITerminalInstance[]): void {
		for (const terminal of terminals) {
			const taskForTerminal = terminal.shellLaunchConfig.attachPersistentProcess?.task;
			if (taskForTerminal?.id && taskForTerminal?.lastTask) {
				this._tasksToReconnect.push(taskForTerminal.id);
				this._terminals[terminal.instanceId] = { terminal, lastTask: taskForTerminal.lastTask, group: taskForTerminal.group };
			} else {
				this._logService.trace(`Could not reconnect to terminal ${terminal.instanceId} with process details ${terminal.shellLaunchConfig.attachPersistentProcess}`);
			}
		}
		this._hasReconnected = true;
	}

	public get onDidStateChange(): Event<ITaskEvent> {
		return this._onDidStateChange.event;
	}

	private _log(value: string): void {
		this._appendOutput(value + '\n');
	}

	protected _showOutput(): void {
		this._outputService.showChannel(this._outputChannelId, true);
	}

	public reconnect(task: Task, resolver: ITaskResolver, trigger: string = Triggers.command): ITaskExecuteResult | undefined {
		const terminals = this._terminalService.getReconnectedTerminals(ReconnectionType);
		if (!terminals || terminals?.length === 0) {
			return undefined; // {{SQL CARBON EDIT}} Strict nulls
		}
		if (!this._hasReconnected && terminals && terminals.length > 0) {
			this._reviveTerminals();
			this._reconnectToTerminals(terminals);
		}
		if (this._tasksToReconnect.includes(task._id)) {
			this._terminalForTask = terminals.find(t => t.shellLaunchConfig.attachPersistentProcess?.task?.id === task._id);
			// Restore the waitOnExit value of the terminal because it may have been a function
			// that cannot be persisted in the pty host
			if ('command' in task && task.command.presentation && this._terminalForTask) {
				this._terminalForTask.waitOnExit = getWaitOnExitValue(task.command.presentation, task.configurationProperties);
			}
			this.run(task, resolver, trigger);
		}
		return undefined;
	}

	public run(task: Task, resolver: ITaskResolver, trigger: string = Triggers.command): ITaskExecuteResult {
		task = task.clone(); // A small amount of task state is stored in the task (instance) and tasks passed in to run may have that set already.
		const recentTaskKey = task.getRecentlyUsedKey() ?? '';
		const validInstance = task.runOptions && task.runOptions.instanceLimit && this._instances[recentTaskKey] && this._instances[recentTaskKey].instances < task.runOptions.instanceLimit;
		const instance = this._instances[recentTaskKey] ? this._instances[recentTaskKey].instances : 0;
		this._currentTask = new VerifiedTask(task, resolver, trigger);
		if (instance > 0) {
			task.instance = this._instances[recentTaskKey].counter;
		}
		const lastTaskInstance = this.getLastInstance(task);
		const terminalData = lastTaskInstance ? this._activeTasks[lastTaskInstance.getMapKey()] : undefined;
		if (terminalData && terminalData.promise && !validInstance) {
			this._lastTask = this._currentTask;
			return { kind: TaskExecuteKind.Active, task: terminalData.task, active: { same: true, background: task.configurationProperties.isBackground! }, promise: terminalData.promise };
		}

		try {
			const executeResult = { kind: TaskExecuteKind.Started, task, started: {}, promise: this._executeTask(task, resolver, trigger, new Set(), undefined) };
			executeResult.promise.then(summary => {
				this._lastTask = this._currentTask;
			});
			if (InMemoryTask.is(task) || !this._isTaskEmpty(task)) {
				if (!this._instances[recentTaskKey]) {
					this._instances[recentTaskKey] = new InstanceManager();
				}
				this._instances[recentTaskKey].addInstance();
			}
			return executeResult;
		} catch (error) {
			if (error instanceof TaskError) {
				throw error;
			} else if (error instanceof Error) {
				this._log(error.message);
				throw new TaskError(Severity.Error, error.message, TaskErrors.UnknownError);
			} else {
				this._log(error.toString());
				throw new TaskError(Severity.Error, nls.localize('TerminalTaskSystem.unknownError', 'A unknown error has occurred while executing a task. See task output log for details.'), TaskErrors.UnknownError);
			}
		}
	}

	public rerun(): ITaskExecuteResult | undefined {
		if (this._lastTask && this._lastTask.verify()) {
			if ((this._lastTask.task.runOptions.reevaluateOnRerun !== undefined) && !this._lastTask.task.runOptions.reevaluateOnRerun) {
				this._isRerun = true;
			}
			const result = this.run(this._lastTask.task, this._lastTask.resolver);
			result.promise.then(summary => {
				this._isRerun = false;
			});
			return result;
		} else {
			return undefined;
		}
	}

	private _showTaskLoadErrors(task: Task) {
		if (task.taskLoadMessages && task.taskLoadMessages.length > 0) {
			task.taskLoadMessages.forEach(loadMessage => {
				this._log(loadMessage + '\n');
			});
			const openOutput = 'Show Output';
			this._notificationService.prompt(Severity.Warning,
				nls.localize('TerminalTaskSystem.taskLoadReporting', "There are issues with task \"{0}\". See the output for more details.",
					task._label), [{
						label: openOutput,
						run: () => this._showOutput()
					}]);
		}
	}

	public isTaskVisible(task: Task): boolean {
		const terminalData = this._activeTasks[task.getMapKey()];
		if (!terminalData) {
			return false;
		}
		const activeTerminalInstance = this._terminalService.activeInstance;
		const isPanelShowingTerminal = !!this._viewsService.getActiveViewWithId(TERMINAL_VIEW_ID);
		return isPanelShowingTerminal && (activeTerminalInstance?.instanceId === terminalData.terminal.instanceId);
	}


	public revealTask(task: Task): boolean {
		const terminalData = this._activeTasks[task.getMapKey()];
		if (!terminalData) {
			return false;
		}
		const isTerminalInPanel: boolean = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID) === ViewContainerLocation.Panel;
		if (isTerminalInPanel && this.isTaskVisible(task)) {
			if (this._previousPanelId) {
				if (this._previousTerminalInstance) {
					this._terminalService.setActiveInstance(this._previousTerminalInstance);
				}
				this._paneCompositeService.openPaneComposite(this._previousPanelId, ViewContainerLocation.Panel);
			} else {
				this._paneCompositeService.hideActivePaneComposite(ViewContainerLocation.Panel);
			}
			this._previousPanelId = undefined;
			this._previousTerminalInstance = undefined;
		} else {
			if (isTerminalInPanel) {
				this._previousPanelId = this._paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel)?.getId();
				if (this._previousPanelId === TERMINAL_VIEW_ID) {
					this._previousTerminalInstance = this._terminalService.activeInstance ?? undefined;
				}
			}
			this._terminalService.setActiveInstance(terminalData.terminal);
			if (CustomTask.is(task) || ContributedTask.is(task)) {
				this._terminalGroupService.showPanel(task.command.presentation!.focus);
			}
		}
		return true;
	}

	public isActive(): Promise<boolean> {
		return Promise.resolve(this.isActiveSync());
	}

	public isActiveSync(): boolean {
		return Object.keys(this._activeTasks).length > 0;
	}

	public canAutoTerminate(): boolean {
		return Object.keys(this._activeTasks).every(key => !this._activeTasks[key].task.configurationProperties.promptOnClose);
	}

	public getActiveTasks(): Task[] {
		return Object.keys(this._activeTasks).map(key => this._activeTasks[key].task);
	}

	public getLastInstance(task: Task): Task | undefined {
		let lastInstance = undefined;
		const recentKey = task.getRecentlyUsedKey();
		Object.keys(this._activeTasks).forEach((key) => {
			if (recentKey && recentKey === this._activeTasks[key].task.getRecentlyUsedKey()) {
				lastInstance = this._activeTasks[key].task;
			}
		});
		return lastInstance;
	}

	public getBusyTasks(): Task[] {
		return Object.keys(this._busyTasks).map(key => this._busyTasks[key]);
	}

	public customExecutionComplete(task: Task, result: number): Promise<void> {
		const activeTerminal = this._activeTasks[task.getMapKey()];
		if (!activeTerminal) {
			return Promise.reject(new Error('Expected to have a terminal for an custom execution task'));
		}

		return new Promise<void>((resolve) => {
			// activeTerminal.terminal.rendererExit(result);
			resolve();
		});
	}

	private _removeInstances(task: Task) {
		const recentTaskKey = task.getRecentlyUsedKey() ?? '';
		if (this._instances[recentTaskKey]) {
			this._instances[recentTaskKey].removeInstance();
			if (this._instances[recentTaskKey].instances === 0) {
				delete this._instances[recentTaskKey];
			}
		}
	}

	private _removeFromActiveTasks(task: Task | string): void {
		const key = typeof task === 'string' ? task : task.getMapKey();
		if (!this._activeTasks[key]) {
			return;
		}
		const taskToRemove = this._activeTasks[key];
		delete this._activeTasks[key];
		this._removeInstances(taskToRemove.task);
	}

	private _fireTaskEvent(event: ITaskEvent) {
		if (event.__task) {
			const activeTask = this._activeTasks[event.__task.getMapKey()];
			if (activeTask) {
				activeTask.state = event.kind;
			}
		}
		this._onDidStateChange.fire(event);
	}

	public terminate(task: Task): Promise<ITaskTerminateResponse> {
		const activeTerminal = this._activeTasks[task.getMapKey()];
		if (!activeTerminal) {
			return Promise.resolve<ITaskTerminateResponse>({ success: false, task: undefined });
		}
		return new Promise<ITaskTerminateResponse>((resolve, reject) => {
			const terminal = activeTerminal.terminal;

			const onExit = terminal.onExit(() => {
				const task = activeTerminal.task;
				try {
					onExit.dispose();
					this._fireTaskEvent(TaskEvent.create(TaskEventKind.Terminated, task));
				} catch (error) {
					// Do nothing.
				}
				resolve({ success: true, task: task });
			});
			terminal.dispose();
		});
	}

	public terminateAll(): Promise<ITaskTerminateResponse[]> {
		const promises: Promise<ITaskTerminateResponse>[] = [];
		Object.keys(this._activeTasks).forEach((key) => {
			const terminalData = this._activeTasks[key];
			const terminal = terminalData.terminal;
			promises.push(new Promise<ITaskTerminateResponse>((resolve, reject) => {
				const onExit = terminal.onExit(() => {
					const task = terminalData.task;
					try {
						onExit.dispose();
						this._fireTaskEvent(TaskEvent.create(TaskEventKind.Terminated, task));
					} catch (error) {
						// Do nothing.
					}
					resolve({ success: true, task: terminalData.task });
				});
			}));
			terminal.dispose();
		});
		this._activeTasks = Object.create(null);
		return Promise.all<ITaskTerminateResponse>(promises);
	}


	private _showDependencyCycleMessage(task: Task) {
		this._log(nls.localize('dependencyCycle',
			'There is a dependency cycle. See task "{0}".',
			task._label
		));
		this._showOutput();
	}

	private async _executeTask(task: Task, resolver: ITaskResolver, trigger: string, encounteredDependencies: Set<string>, alreadyResolved?: Map<string, string>): Promise<ITaskSummary> {
		if (encounteredDependencies.has(task.getCommonTaskId())) {
			this._showDependencyCycleMessage(task);
			return {};
		}

		this._showTaskLoadErrors(task);

		alreadyResolved = alreadyResolved ?? new Map<string, string>();
		const promises: Promise<ITaskSummary>[] = [];
		if (task.configurationProperties.dependsOn) {
			if (!this._terminalForTask) {
				// we already handle dependent tasks when reconnecting, don't create extras
				for (const dependency of task.configurationProperties.dependsOn) {
					const dependencyTask = await resolver.resolve(dependency.uri, dependency.task!);
					if (dependencyTask) {
						this._adoptConfigurationForDependencyTask(dependencyTask, task);
						const key = dependencyTask.getMapKey();
						let promise = this._activeTasks[key] ? this._getDependencyPromise(this._activeTasks[key]) : undefined;
						if (!promise) {
							this._fireTaskEvent(TaskEvent.create(TaskEventKind.DependsOnStarted, task));
							encounteredDependencies.add(task.getCommonTaskId());
							promise = this._executeDependencyTask(dependencyTask, resolver, trigger, encounteredDependencies, alreadyResolved);
						}
						promises.push(promise);
						if (task.configurationProperties.dependsOrder === DependsOrder.sequence) {
							const promiseResult = await promise;
							if (promiseResult.exitCode === 0) {
								promise = Promise.resolve(promiseResult);
							} else {
								promise = Promise.reject(promiseResult);
								break;
							}
						}
						promises.push(promise);
					} else {
						this._log(nls.localize('dependencyFailed',
							'Couldn\'t resolve dependent task \'{0}\' in workspace folder \'{1}\'',
							Types.isString(dependency.task) ? dependency.task : JSON.stringify(dependency.task, undefined, 0),
							dependency.uri.toString()
						));
						this._showOutput();
					}
				}
			}
		}

		if ((ContributedTask.is(task) || CustomTask.is(task)) && (task.command)) {
			return Promise.all(promises).then((summaries): Promise<ITaskSummary> | ITaskSummary => {
				encounteredDependencies.delete(task.getCommonTaskId());
				for (const summary of summaries) {
					if (summary.exitCode !== 0) {
						this._removeInstances(task);
						return { exitCode: summary.exitCode };
					}
				}
				if (this._isRerun) {
					return this._reexecuteCommand(task, trigger, alreadyResolved!);
				} else {
					return this._executeCommand(task, trigger, alreadyResolved!);
				}
			});
		} else {
			return Promise.all(promises).then((summaries): ITaskSummary => {
				encounteredDependencies.delete(task.getCommonTaskId());
				for (const summary of summaries) {
					if (summary.exitCode !== 0) {
						return { exitCode: summary.exitCode };
					}
				}
				return { exitCode: 0 };
			});
		}
	}

	private _createInactiveDependencyPromise(task: Task): Promise<ITaskSummary> {
		return new Promise<ITaskSummary>(resolve => {
			const taskInactiveDisposable = this.onDidStateChange(taskEvent => {
				if ((taskEvent.kind === TaskEventKind.Inactive) && (taskEvent.__task === task)) {
					taskInactiveDisposable.dispose();
					resolve({ exitCode: 0 });
				}
			});
		});
	}

	private _adoptConfigurationForDependencyTask(dependencyTask: Task, task: Task): void {
		if (dependencyTask.configurationProperties.icon) {
			dependencyTask.configurationProperties.icon.id ||= task.configurationProperties.icon?.id;
			dependencyTask.configurationProperties.icon.color ||= task.configurationProperties.icon?.color;
		} else {
			dependencyTask.configurationProperties.icon = task.configurationProperties.icon;
		}

		if (dependencyTask.configurationProperties.hide) {
			dependencyTask.configurationProperties.hide ||= task.configurationProperties.hide;
		} else {
			dependencyTask.configurationProperties.hide = task.configurationProperties.hide;
		}
	}

	private async _getDependencyPromise(task: IActiveTerminalData): Promise<ITaskSummary> {
		if (!task.task.configurationProperties.isBackground) {
			return task.promise;
		}
		if (!task.task.configurationProperties.problemMatchers || task.task.configurationProperties.problemMatchers.length === 0) {
			return task.promise;
		}
		if (task.state === TaskEventKind.Inactive) {
			return { exitCode: 0 };
		}
		return this._createInactiveDependencyPromise(task.task);
	}

	private async _executeDependencyTask(task: Task, resolver: ITaskResolver, trigger: string, encounteredDependencies: Set<string>, alreadyResolved?: Map<string, string>): Promise<ITaskSummary> {
		// If the task is a background task with a watching problem matcher, we don't wait for the whole task to finish,
		// just for the problem matcher to go inactive.
		if (!task.configurationProperties.isBackground) {
			return this._executeTask(task, resolver, trigger, encounteredDependencies, alreadyResolved);
		}

		const inactivePromise = this._createInactiveDependencyPromise(task);
		return Promise.race([inactivePromise, this._executeTask(task, resolver, trigger, encounteredDependencies, alreadyResolved)]);
	}

	private async _resolveAndFindExecutable(systemInfo: ITaskSystemInfo | undefined, workspaceFolder: IWorkspaceFolder | undefined, task: CustomTask | ContributedTask, cwd: string | undefined, envPath: string | undefined): Promise<string> {
		const command = await this._configurationResolverService.resolveAsync(workspaceFolder, CommandString.value(task.command.name!));
		cwd = cwd ? await this._configurationResolverService.resolveAsync(workspaceFolder, cwd) : undefined;
		const paths = envPath ? await Promise.all(envPath.split(path.delimiter).map(p => this._configurationResolverService.resolveAsync(workspaceFolder, p))) : undefined;
		let foundExecutable = await systemInfo?.findExecutable(command, cwd, paths);
		if (!foundExecutable) {
			foundExecutable = path.join(cwd ?? '', command);
		}
		return foundExecutable;
	}

	private _findUnresolvedVariables(variables: Set<string>, alreadyResolved: Map<string, string>): Set<string> {
		if (alreadyResolved.size === 0) {
			return variables;
		}
		const unresolved = new Set<string>();
		for (const variable of variables) {
			if (!alreadyResolved.has(variable.substring(2, variable.length - 1))) {
				unresolved.add(variable);
			}
		}
		return unresolved;
	}

	private _mergeMaps(mergeInto: Map<string, string>, mergeFrom: Map<string, string>) {
		for (const entry of mergeFrom) {
			if (!mergeInto.has(entry[0])) {
				mergeInto.set(entry[0], entry[1]);
			}
		}
	}

	private async _acquireInput(taskSystemInfo: ITaskSystemInfo | undefined, workspaceFolder: IWorkspaceFolder | undefined, task: CustomTask | ContributedTask, variables: Set<string>, alreadyResolved: Map<string, string>): Promise<IResolvedVariables | undefined> {
		const resolved = await this._resolveVariablesFromSet(taskSystemInfo, workspaceFolder, task, variables, alreadyResolved);
		this._fireTaskEvent(TaskEvent.create(TaskEventKind.AcquiredInput, task));
		return resolved;
	}

	private _resolveVariablesFromSet(taskSystemInfo: ITaskSystemInfo | undefined, workspaceFolder: IWorkspaceFolder | undefined, task: CustomTask | ContributedTask, variables: Set<string>, alreadyResolved: Map<string, string>): Promise<IResolvedVariables | undefined> {
		const isProcess = task.command && task.command.runtime === RuntimeType.Process;
		const options = task.command && task.command.options ? task.command.options : undefined;
		const cwd = options ? options.cwd : undefined;
		let envPath: string | undefined = undefined;
		if (options && options.env) {
			for (const key of Object.keys(options.env)) {
				if (key.toLowerCase() === 'path') {
					if (Types.isString(options.env[key])) {
						envPath = options.env[key];
					}
					break;
				}
			}
		}
		const unresolved = this._findUnresolvedVariables(variables, alreadyResolved);
		let resolvedVariables: Promise<IResolvedVariables | undefined>;
		if (taskSystemInfo && workspaceFolder) {
			const resolveSet: IResolveSet = {
				variables: unresolved
			};

			if (taskSystemInfo.platform === Platform.Platform.Windows && isProcess) {
				resolveSet.process = { name: CommandString.value(task.command.name!) };
				if (cwd) {
					resolveSet.process.cwd = cwd;
				}
				if (envPath) {
					resolveSet.process.path = envPath;
				}
			}
			resolvedVariables = taskSystemInfo.resolveVariables(workspaceFolder, resolveSet, TaskSourceKind.toConfigurationTarget(task._source.kind)).then(async (resolved) => {
				if (!resolved) {
					return undefined;
				}

				this._mergeMaps(alreadyResolved, resolved.variables);
				resolved.variables = new Map(alreadyResolved);
				if (isProcess) {
					let process = CommandString.value(task.command.name!);
					if (taskSystemInfo.platform === Platform.Platform.Windows) {
						process = await this._resolveAndFindExecutable(taskSystemInfo, workspaceFolder, task, cwd, envPath);
					}
					resolved.variables.set(TerminalTaskSystem.ProcessVarName, process);
				}
				return resolved;
			});
			return resolvedVariables;
		} else {
			const variablesArray = new Array<string>();
			unresolved.forEach(variable => variablesArray.push(variable));

			return new Promise<IResolvedVariables | undefined>((resolve, reject) => {
				this._configurationResolverService.resolveWithInteraction(workspaceFolder, variablesArray, 'tasks', undefined, TaskSourceKind.toConfigurationTarget(task._source.kind)).then(async (resolvedVariablesMap: Map<string, string> | undefined) => {
					if (resolvedVariablesMap) {
						this._mergeMaps(alreadyResolved, resolvedVariablesMap);
						resolvedVariablesMap = new Map(alreadyResolved);
						if (isProcess) {
							let processVarValue: string;
							if (Platform.isWindows) {
								processVarValue = await this._resolveAndFindExecutable(taskSystemInfo, workspaceFolder, task, cwd, envPath);
							} else {
								processVarValue = await this._configurationResolverService.resolveAsync(workspaceFolder, CommandString.value(task.command.name!));
							}
							resolvedVariablesMap.set(TerminalTaskSystem.ProcessVarName, processVarValue);
						}
						const resolvedVariablesResult: IResolvedVariables = {
							variables: resolvedVariablesMap,
						};
						resolve(resolvedVariablesResult);
					} else {
						resolve(undefined);
					}
				}, reason => {
					reject(reason);
				});
			});
		}
	}

	private _executeCommand(task: CustomTask | ContributedTask, trigger: string, alreadyResolved: Map<string, string>): Promise<ITaskSummary> {
		const taskWorkspaceFolder = task.getWorkspaceFolder();
		let workspaceFolder: IWorkspaceFolder | undefined;
		if (taskWorkspaceFolder) {
			workspaceFolder = this._currentTask.workspaceFolder = taskWorkspaceFolder;
		} else {
			const folders = this._contextService.getWorkspace().folders;
			workspaceFolder = folders.length > 0 ? folders[0] : undefined;
		}
		const systemInfo: ITaskSystemInfo | undefined = this._currentTask.systemInfo = this._taskSystemInfoResolver(workspaceFolder);

		const variables = new Set<string>();
		this._collectTaskVariables(variables, task);
		const resolvedVariables = this._acquireInput(systemInfo, workspaceFolder, task, variables, alreadyResolved);

		return resolvedVariables.then((resolvedVariables) => {
			if (resolvedVariables && !this._isTaskEmpty(task)) {
				this._currentTask.resolvedVariables = resolvedVariables;
				return this._executeInTerminal(task, trigger, new VariableResolver(workspaceFolder, systemInfo, resolvedVariables.variables, this._configurationResolverService), workspaceFolder);
			} else {
				// Allows the taskExecutions array to be updated in the extension host
				this._fireTaskEvent(TaskEvent.create(TaskEventKind.End, task));
				return Promise.resolve({ exitCode: 0 });
			}
		}, reason => {
			return Promise.reject(reason);
		});
	}

	private _isTaskEmpty(task: CustomTask | ContributedTask): boolean {
		const isCustomExecution = (task.command.runtime === RuntimeType.CustomExecution);
		return !((task.command !== undefined) && task.command.runtime && (isCustomExecution || (task.command.name !== undefined)));
	}

	private _reexecuteCommand(task: CustomTask | ContributedTask, trigger: string, alreadyResolved: Map<string, string>): Promise<ITaskSummary> {
		const lastTask = this._lastTask;
		if (!lastTask) {
			return Promise.reject(new Error('No task previously run'));
		}
		const workspaceFolder = this._currentTask.workspaceFolder = lastTask.workspaceFolder;
		const variables = new Set<string>();
		this._collectTaskVariables(variables, task);

		// Check that the task hasn't changed to include new variables
		let hasAllVariables = true;
		variables.forEach(value => {
			if (value.substring(2, value.length - 1) in lastTask.getVerifiedTask().resolvedVariables) {
				hasAllVariables = false;
			}
		});

		if (!hasAllVariables) {
			return this._acquireInput(lastTask.getVerifiedTask().systemInfo, lastTask.getVerifiedTask().workspaceFolder, task, variables, alreadyResolved).then((resolvedVariables) => {
				if (!resolvedVariables) {
					// Allows the taskExecutions array to be updated in the extension host
					this._fireTaskEvent(TaskEvent.create(TaskEventKind.End, task));
					return { exitCode: 0 };
				}
				this._currentTask.resolvedVariables = resolvedVariables;
				return this._executeInTerminal(task, trigger, new VariableResolver(lastTask.getVerifiedTask().workspaceFolder, lastTask.getVerifiedTask().systemInfo, resolvedVariables.variables, this._configurationResolverService), workspaceFolder!);
			}, reason => {
				return Promise.reject(reason);
			});
		} else {
			this._currentTask.resolvedVariables = lastTask.getVerifiedTask().resolvedVariables;
			return this._executeInTerminal(task, trigger, new VariableResolver(lastTask.getVerifiedTask().workspaceFolder, lastTask.getVerifiedTask().systemInfo, lastTask.getVerifiedTask().resolvedVariables.variables, this._configurationResolverService), workspaceFolder!);
		}
	}

	private async _executeInTerminal(task: CustomTask | ContributedTask, trigger: string, resolver: VariableResolver, workspaceFolder: IWorkspaceFolder | undefined): Promise<ITaskSummary> {
		let terminal: ITerminalInstance | undefined = undefined;
		let error: TaskError | undefined = undefined;
		let promise: Promise<ITaskSummary> | undefined = undefined;
		if (task.configurationProperties.isBackground) {
			const problemMatchers = await this._resolveMatchers(resolver, task.configurationProperties.problemMatchers);
			const watchingProblemMatcher = new WatchingProblemCollector(problemMatchers, this._markerService, this._modelService, this._fileService);
			if ((problemMatchers.length > 0) && !watchingProblemMatcher.isWatching()) {
				this._appendOutput(nls.localize('TerminalTaskSystem.nonWatchingMatcher', 'Task {0} is a background task but uses a problem matcher without a background pattern', task._label));
				this._showOutput();
			}
			const toDispose = new DisposableStore();
			let eventCounter: number = 0;
			const mapKey = task.getMapKey();
			toDispose.add(watchingProblemMatcher.onDidStateChange((event) => {
				if (event.kind === ProblemCollectorEventKind.BackgroundProcessingBegins) {
					eventCounter++;
					this._busyTasks[mapKey] = task;
					this._fireTaskEvent(TaskEvent.create(TaskEventKind.Active, task));
				} else if (event.kind === ProblemCollectorEventKind.BackgroundProcessingEnds) {
					eventCounter--;
					if (this._busyTasks[mapKey]) {
						delete this._busyTasks[mapKey];
					}
					this._fireTaskEvent(TaskEvent.create(TaskEventKind.Inactive, task));
					if (eventCounter === 0) {
						if ((watchingProblemMatcher.numberOfMatches > 0) && watchingProblemMatcher.maxMarkerSeverity &&
							(watchingProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error)) {
							const reveal = task.command.presentation!.reveal;
							const revealProblems = task.command.presentation!.revealProblems;
							if (revealProblems === RevealProblemKind.OnProblem) {
								this._viewsService.openView(Markers.MARKERS_VIEW_ID, true);
							} else if (reveal === RevealKind.Silent) {
								this._terminalService.setActiveInstance(terminal!);
								this._terminalGroupService.showPanel(false);
							}
						}
					}
				}
			}));
			watchingProblemMatcher.aboutToStart();
			let delayer: Async.Delayer<any> | undefined = undefined;
			[terminal, error] = this._terminalForTask ? [this._terminalForTask, undefined] : await this._createTerminal(task, resolver, workspaceFolder);
			this._terminalForTask = undefined;

			if (error) {
				return Promise.reject(new Error((<TaskError>error).message));
			}
			if (!terminal) {
				return Promise.reject(new Error(`Failed to create terminal for task ${task._label}`));
			}
			this._terminalStatusManager.addTerminal(task, terminal, watchingProblemMatcher);

			let processStartedSignaled = false;
			terminal.processReady.then(() => {
				if (!processStartedSignaled) {
					this._fireTaskEvent(TaskEvent.create(TaskEventKind.ProcessStarted, task, terminal!.processId!));
					processStartedSignaled = true;
				}
			}, (_error) => {
				this._logService.error('Task terminal process never got ready');
			});
			this._fireTaskEvent(TaskEvent.create(TaskEventKind.Start, task, terminal.instanceId));
			const onData = terminal.onLineData((line) => {
				watchingProblemMatcher.processLine(line);
				if (!delayer) {
					delayer = new Async.Delayer(3000);
				}
				delayer.trigger(() => {
					watchingProblemMatcher.forceDelivery();
					delayer = undefined;
				});
			});
			promise = new Promise<ITaskSummary>((resolve, reject) => {
				const onExit = terminal!.onExit((terminalLaunchResult) => {
					const exitCode = typeof terminalLaunchResult === 'number' ? terminalLaunchResult : terminalLaunchResult?.code;
					onData.dispose();
					onExit.dispose();
					const key = task.getMapKey();
					if (this._busyTasks[mapKey]) {
						delete this._busyTasks[mapKey];
					}
					this._removeFromActiveTasks(task);
					this._fireTaskEvent(TaskEvent.create(TaskEventKind.Changed));
					if (terminalLaunchResult !== undefined) {
						// Only keep a reference to the terminal if it is not being disposed.
						switch (task.command.presentation!.panel) {
							case PanelKind.Dedicated:
								this._sameTaskTerminals[key] = terminal!.instanceId.toString();
								break;
							case PanelKind.Shared:
								this._idleTaskTerminals.set(key, terminal!.instanceId.toString(), Touch.AsOld);
								break;
						}
					}
					const reveal = task.command.presentation!.reveal;
					if ((reveal === RevealKind.Silent) && ((exitCode !== 0) || (watchingProblemMatcher.numberOfMatches > 0) && watchingProblemMatcher.maxMarkerSeverity &&
						(watchingProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error))) {
						try {
							this._terminalService.setActiveInstance(terminal!);
							this._terminalGroupService.showPanel(false);
						} catch (e) {
							// If the terminal has already been disposed, then setting the active instance will fail. #99828
							// There is nothing else to do here.
						}
					}
					watchingProblemMatcher.done();
					watchingProblemMatcher.dispose();
					if (!processStartedSignaled) {
						this._fireTaskEvent(TaskEvent.create(TaskEventKind.ProcessStarted, task, terminal!.processId!));
						processStartedSignaled = true;
					}
					this._fireTaskEvent(TaskEvent.create(TaskEventKind.ProcessEnded, task, exitCode ?? undefined));

					for (let i = 0; i < eventCounter; i++) {
						this._fireTaskEvent(TaskEvent.create(TaskEventKind.Inactive, task));
					}
					eventCounter = 0;
					this._fireTaskEvent(TaskEvent.create(TaskEventKind.End, task));
					toDispose.dispose();
					resolve({ exitCode: exitCode ?? undefined });
				});
			});
		} else {
			[terminal, error] = this._terminalForTask ? [this._terminalForTask, undefined] : await this._createTerminal(task, resolver, workspaceFolder);
			this._terminalForTask = undefined;

			if (error) {
				return Promise.reject(new Error((<TaskError>error).message));
			}
			if (!terminal) {
				return Promise.reject(new Error(`Failed to create terminal for task ${task._label}`));
			}

			let processStartedSignaled = false;
			terminal.processReady.then(() => {
				if (!processStartedSignaled) {
					this._fireTaskEvent(TaskEvent.create(TaskEventKind.ProcessStarted, task, terminal!.processId!));
					processStartedSignaled = true;
				}
			}, (_error) => {
				// The process never got ready. Need to think how to handle this.
			});
			this._fireTaskEvent(TaskEvent.create(TaskEventKind.Start, task, terminal.instanceId, resolver.values));
			const mapKey = task.getMapKey();
			this._busyTasks[mapKey] = task;
			this._fireTaskEvent(TaskEvent.create(TaskEventKind.Active, task));
			const problemMatchers = await this._resolveMatchers(resolver, task.configurationProperties.problemMatchers);
			const startStopProblemMatcher = new StartStopProblemCollector(problemMatchers, this._markerService, this._modelService, ProblemHandlingStrategy.Clean, this._fileService);
			this._terminalStatusManager.addTerminal(task, terminal, startStopProblemMatcher);
			const onData = terminal.onLineData((line) => {
				startStopProblemMatcher.processLine(line);
			});
			promise = new Promise<ITaskSummary>((resolve, reject) => {
				const onExit = terminal!.onExit((terminalLaunchResult) => {
					const exitCode = typeof terminalLaunchResult === 'number' ? terminalLaunchResult : terminalLaunchResult?.code;
					onExit.dispose();
					const key = task.getMapKey();
					this._removeFromActiveTasks(task);
					this._fireTaskEvent(TaskEvent.create(TaskEventKind.Changed));
					if (terminalLaunchResult !== undefined) {
						// Only keep a reference to the terminal if it is not being disposed.
						switch (task.command.presentation!.panel) {
							case PanelKind.Dedicated:
								this._sameTaskTerminals[key] = terminal!.instanceId.toString();
								break;
							case PanelKind.Shared:
								this._idleTaskTerminals.set(key, terminal!.instanceId.toString(), Touch.AsOld);
								break;
						}
					}
					const reveal = task.command.presentation!.reveal;
					const revealProblems = task.command.presentation!.revealProblems;
					const revealProblemPanel = terminal && (revealProblems === RevealProblemKind.OnProblem) && (startStopProblemMatcher.numberOfMatches > 0);
					if (revealProblemPanel) {
						this._viewsService.openView(Markers.MARKERS_VIEW_ID);
					} else if (terminal && (reveal === RevealKind.Silent) && ((exitCode !== 0) || (startStopProblemMatcher.numberOfMatches > 0) && startStopProblemMatcher.maxMarkerSeverity &&
						(startStopProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error))) {
						try {
							this._terminalService.setActiveInstance(terminal);
							this._terminalGroupService.showPanel(false);
						} catch (e) {
							// If the terminal has already been disposed, then setting the active instance will fail. #99828
							// There is nothing else to do here.
						}
					}
					// Hack to work around #92868 until terminal is fixed.
					setTimeout(() => {
						onData.dispose();
						startStopProblemMatcher.done();
						startStopProblemMatcher.dispose();
					}, 100);
					if (!processStartedSignaled && terminal) {
						this._fireTaskEvent(TaskEvent.create(TaskEventKind.ProcessStarted, task, terminal.processId!));
						processStartedSignaled = true;
					}

					this._fireTaskEvent(TaskEvent.create(TaskEventKind.ProcessEnded, task, exitCode ?? undefined));
					if (this._busyTasks[mapKey]) {
						delete this._busyTasks[mapKey];
					}
					this._fireTaskEvent(TaskEvent.create(TaskEventKind.Inactive, task));
					this._fireTaskEvent(TaskEvent.create(TaskEventKind.End, task));
					resolve({ exitCode: exitCode ?? undefined });
				});
			});
		}

		const showProblemPanel = task.command.presentation && (task.command.presentation.revealProblems === RevealProblemKind.Always);
		if (showProblemPanel) {
			this._viewsService.openView(Markers.MARKERS_VIEW_ID);
		} else if (task.command.presentation && (task.command.presentation.reveal === RevealKind.Always)) {
			this._terminalService.setActiveInstance(terminal);
			this._terminalGroupService.showPanel(task.command.presentation.focus);
		}
		this._activeTasks[task.getMapKey()] = { terminal, task, promise };
		this._fireTaskEvent(TaskEvent.create(TaskEventKind.Changed));
		return promise;
	}

	private _createTerminalName(task: CustomTask | ContributedTask): string {
		const needsFolderQualification = this._contextService.getWorkbenchState() === WorkbenchState.WORKSPACE;
		return needsFolderQualification ? task.getQualifiedLabel() : (task.configurationProperties.name || '');
	}

	private async _createShellLaunchConfig(task: CustomTask | ContributedTask, workspaceFolder: IWorkspaceFolder | undefined, variableResolver: VariableResolver, platform: Platform.Platform, options: CommandOptions, command: CommandString, args: CommandString[], waitOnExit: WaitOnExitValue): Promise<IShellLaunchConfig | undefined> {
		let shellLaunchConfig: IShellLaunchConfig;
		const isShellCommand = task.command.runtime === RuntimeType.Shell;
		const needsFolderQualification = this._contextService.getWorkbenchState() === WorkbenchState.WORKSPACE;
		const terminalName = this._createTerminalName(task);
		const type = ReconnectionType;
		const originalCommand = task.command.name;
		if (isShellCommand) {
			let os: Platform.OperatingSystem;
			switch (platform) {
				case Platform.Platform.Windows: os = Platform.OperatingSystem.Windows; break;
				case Platform.Platform.Mac: os = Platform.OperatingSystem.Macintosh; break;
				case Platform.Platform.Linux:
				default: os = Platform.OperatingSystem.Linux; break;
			}
			const defaultProfile = await this._terminalProfileResolverService.getDefaultProfile({
				allowAutomationShell: true,
				os,
				remoteAuthority: this._environmentService.remoteAuthority
			});
			let icon: URI | ThemeIcon | { light: URI; dark: URI } | undefined;
			if (task.configurationProperties.icon?.id) {
				icon = ThemeIcon.fromId(task.configurationProperties.icon.id);
			} else {
				const taskGroupKind = task.configurationProperties.group ? GroupKind.to(task.configurationProperties.group) : undefined;
				const kindId = typeof taskGroupKind === 'string' ? taskGroupKind : taskGroupKind?.kind;
				icon = kindId === 'test' ? ThemeIcon.fromId(Codicon.beaker.id) : defaultProfile.icon;
			}
			shellLaunchConfig = {
				name: terminalName,
				type,
				executable: defaultProfile.path,
				args: defaultProfile.args,
				env: { ...defaultProfile.env },
				icon,
				color: task.configurationProperties.icon?.color || undefined,
				waitOnExit
			};
			let shellSpecified: boolean = false;
			const shellOptions: IShellConfiguration | undefined = task.command.options && task.command.options.shell;
			if (shellOptions) {
				if (shellOptions.executable) {
					// Clear out the args so that we don't end up with mismatched args.
					if (shellOptions.executable !== shellLaunchConfig.executable) {
						shellLaunchConfig.args = undefined;
					}
					shellLaunchConfig.executable = await this._resolveVariable(variableResolver, shellOptions.executable);
					shellSpecified = true;
				}
				if (shellOptions.args) {
					shellLaunchConfig.args = await this._resolveVariables(variableResolver, shellOptions.args.slice());
				}
			}
			if (shellLaunchConfig.args === undefined) {
				shellLaunchConfig.args = [];
			}
			const shellArgs = Array.isArray(shellLaunchConfig.args!) ? <string[]>shellLaunchConfig.args!.slice(0) : [shellLaunchConfig.args!];
			const toAdd: string[] = [];
			const basename = path.posix.basename((await this._pathService.fileURI(shellLaunchConfig.executable!)).path).toLowerCase();
			const commandLine = this._buildShellCommandLine(platform, basename, shellOptions, command, originalCommand, args);
			let windowsShellArgs: boolean = false;
			if (platform === Platform.Platform.Windows) {
				windowsShellArgs = true;
				// If we don't have a cwd, then the terminal uses the home dir.
				const userHome = await this._pathService.userHome();
				if (basename === 'cmd.exe' && ((options.cwd && isUNC(options.cwd)) || (!options.cwd && isUNC(userHome.fsPath)))) {
					return undefined;
				}
				if ((basename === 'powershell.exe') || (basename === 'pwsh.exe')) {
					if (!shellSpecified) {
						toAdd.push('-Command');
					}
				} else if ((basename === 'bash.exe') || (basename === 'zsh.exe')) {
					windowsShellArgs = false;
					if (!shellSpecified) {
						toAdd.push('-c');
					}
				} else if (basename === 'wsl.exe') {
					if (!shellSpecified) {
						toAdd.push('-e');
					}
				} else {
					if (!shellSpecified) {
						toAdd.push('/d', '/c');
					}
				}
			} else {
				if (!shellSpecified) {
					// Under Mac remove -l to not start it as a login shell.
					if (platform === Platform.Platform.Mac) {
						// Background on -l on osx https://github.com/microsoft/vscode/issues/107563
						const osxShellArgs = this._configurationService.inspect(TerminalSettingId.ShellArgsMacOs);
						if ((osxShellArgs.user === undefined) && (osxShellArgs.userLocal === undefined) && (osxShellArgs.userLocalValue === undefined)
							&& (osxShellArgs.userRemote === undefined) && (osxShellArgs.userRemoteValue === undefined)
							&& (osxShellArgs.userValue === undefined) && (osxShellArgs.workspace === undefined)
							&& (osxShellArgs.workspaceFolder === undefined) && (osxShellArgs.workspaceFolderValue === undefined)
							&& (osxShellArgs.workspaceValue === undefined)) {
							const index = shellArgs.indexOf('-l');
							if (index !== -1) {
								shellArgs.splice(index, 1);
							}
						}
					}
					toAdd.push('-c');
				}
			}
			const combinedShellArgs = this._addAllArgument(toAdd, shellArgs);
			combinedShellArgs.push(commandLine);
			shellLaunchConfig.args = windowsShellArgs ? combinedShellArgs.join(' ') : combinedShellArgs;
			if (task.command.presentation && task.command.presentation.echo) {
				if (needsFolderQualification && workspaceFolder) {
					shellLaunchConfig.initialText = this.taskShellIntegrationStartSequence + formatMessageForTerminal(nls.localize({
						key: 'task.executingInFolder',
						comment: ['The workspace folder the task is running in', 'The task command line or label']
					}, 'Executing task in folder {0}: {1}', workspaceFolder.name, commandLine), { excludeLeadingNewLine: true }) + this.taskShellIntegrationOutputSequence;
				} else {
					shellLaunchConfig.initialText = this.taskShellIntegrationStartSequence + formatMessageForTerminal(nls.localize({
						key: 'task.executing',
						comment: ['The task command line or label']
					}, 'Executing task: {0}', commandLine), { excludeLeadingNewLine: true }) + this.taskShellIntegrationOutputSequence;
				}
			} else {
				shellLaunchConfig.initialText = {
					text: this.taskShellIntegrationStartSequence + this.taskShellIntegrationOutputSequence,
					trailingNewLine: false
				};
			}
		} else {
			const commandExecutable = (task.command.runtime !== RuntimeType.CustomExecution) ? CommandString.value(command) : undefined;
			const executable = !isShellCommand
				? await this._resolveVariable(variableResolver, await this._resolveVariable(variableResolver, '${' + TerminalTaskSystem.ProcessVarName + '}'))
				: commandExecutable;

			// When we have a process task there is no need to quote arguments. So we go ahead and take the string value.
			shellLaunchConfig = {
				name: terminalName,
				type,
				icon: task.configurationProperties.icon?.id ? ThemeIcon.fromId(task.configurationProperties.icon.id) : undefined,
				color: task.configurationProperties.icon?.color || undefined,
				executable: executable,
				args: args.map(a => Types.isString(a) ? a : a.value),
				waitOnExit
			};
			if (task.command.presentation && task.command.presentation.echo) {
				const getArgsToEcho = (args: string | string[] | undefined): string => {
					if (!args || args.length === 0) {
						return '';
					}
					if (Types.isString(args)) {
						return args;
					}
					return args.join(' ');
				};
				if (needsFolderQualification && workspaceFolder) {
					shellLaunchConfig.initialText = this.taskShellIntegrationStartSequence + formatMessageForTerminal(nls.localize({
						key: 'task.executingInFolder',
						comment: ['The workspace folder the task is running in', 'The task command line or label']
					}, 'Executing task in folder {0}: {1}', workspaceFolder.name, `${shellLaunchConfig.executable} ${getArgsToEcho(shellLaunchConfig.args)}`), { excludeLeadingNewLine: true }) + this.taskShellIntegrationOutputSequence;
				} else {
					shellLaunchConfig.initialText = this.taskShellIntegrationStartSequence + formatMessageForTerminal(nls.localize({
						key: 'task.executing',
						comment: ['The task command line or label']
					}, 'Executing task: {0}', `${shellLaunchConfig.executable} ${getArgsToEcho(shellLaunchConfig.args)}`), { excludeLeadingNewLine: true }) + this.taskShellIntegrationOutputSequence;
				}
			} else {
				shellLaunchConfig.initialText = {
					text: this.taskShellIntegrationStartSequence + this.taskShellIntegrationOutputSequence,
					trailingNewLine: false
				};
			}
		}

		if (options.cwd) {
			let cwd = options.cwd;
			if (!path.isAbsolute(cwd)) {
				if (workspaceFolder && (workspaceFolder.uri.scheme === Schemas.file)) {
					cwd = path.join(workspaceFolder.uri.fsPath, cwd);
				}
			}
			// This must be normalized to the OS
			shellLaunchConfig.cwd = isUNC(cwd) ? cwd : resources.toLocalResource(URI.from({ scheme: Schemas.file, path: cwd }), this._environmentService.remoteAuthority, this._pathService.defaultUriScheme);
		}
		if (options.env) {
			if (shellLaunchConfig.env) {
				shellLaunchConfig.env = { ...shellLaunchConfig.env, ...options.env };
			} else {
				shellLaunchConfig.env = options.env;
			}
		}
		shellLaunchConfig.isFeatureTerminal = true;
		shellLaunchConfig.useShellEnvironment = true;
		return shellLaunchConfig;
	}

	private _addAllArgument(shellCommandArgs: string[], configuredShellArgs: string[]): string[] {
		const combinedShellArgs: string[] = Objects.deepClone(configuredShellArgs);
		shellCommandArgs.forEach(element => {
			const shouldAddShellCommandArg = configuredShellArgs.every((arg, index) => {
				if ((arg.toLowerCase() === element) && (configuredShellArgs.length > index + 1)) {
					// We can still add the argument, but only if not all of the following arguments begin with "-".
					return !configuredShellArgs.slice(index + 1).every(testArg => testArg.startsWith('-'));
				} else {
					return arg.toLowerCase() !== element;
				}
			});
			if (shouldAddShellCommandArg) {
				combinedShellArgs.push(element);
			}
		});
		return combinedShellArgs;
	}

	private async _doCreateTerminal(group: string | undefined, launchConfigs: IShellLaunchConfig): Promise<ITerminalInstance> {
		if (group) {
			// Try to find an existing terminal to split.
			// Even if an existing terminal is found, the split can fail if the terminal width is too small.
			for (const terminal of Object.values(this._terminals)) {
				if (terminal.group === group) {
					this._logService.trace(`Found terminal to split for group ${group}`);
					const originalInstance = terminal.terminal;
					const result = await this._terminalService.createTerminal({ location: { parentTerminal: originalInstance }, config: launchConfigs });
					if (result) {
						return result;
					}
				}
			}
			this._logService.trace(`No terminal found to split for group ${group}`);
		}
		// Either no group is used, no terminal with the group exists or splitting an existing terminal failed.
		const createdTerminal = await this._terminalService.createTerminal({ location: TerminalLocation.Panel, config: launchConfigs });
		this._logService.trace('Created a new task terminal');
		return createdTerminal;
	}

	private _reviveTerminals(): void {
		if (Object.entries(this._terminals).length > 0) {
			return;
		}
		const terminals = this._terminalService.getReconnectedTerminals(ReconnectionType)?.filter(t => !t.isDisposed);
		if (!terminals?.length) {
			return;
		}
		for (const terminal of terminals) {
			const task = terminal.shellLaunchConfig.attachPersistentProcess?.task;
			if (!task) {
				continue;
			}
			const terminalData = { lastTask: task.lastTask, group: task.group, terminal };
			this._terminals[terminal.instanceId] = terminalData;
			terminal.onDisposed(() => this._deleteTaskAndTerminal(terminal, terminalData));
		}
	}

	private _deleteTaskAndTerminal(terminal: ITerminalInstance, terminalData: ITerminalData): void {
		delete this._terminals[terminal.instanceId];
		delete this._sameTaskTerminals[terminalData.lastTask];
		this._idleTaskTerminals.delete(terminalData.lastTask);
		// Delete the task now as a work around for cases when the onExit isn't fired.
		// This can happen if the terminal wasn't shutdown with an "immediate" flag and is expected.
		// For correct terminal re-use, the task needs to be deleted immediately.
		// Note that this shouldn't be a problem anymore since user initiated terminal kills are now immediate.
		const mapKey = terminalData.lastTask;
		this._removeFromActiveTasks(mapKey);
		if (this._busyTasks[mapKey]) {
			delete this._busyTasks[mapKey];
		}
	}

	private async _createTerminal(task: CustomTask | ContributedTask, resolver: VariableResolver, workspaceFolder: IWorkspaceFolder | undefined): Promise<[ITerminalInstance | undefined, TaskError | undefined]> {
		const platform = resolver.taskSystemInfo ? resolver.taskSystemInfo.platform : Platform.platform;
		const options = await this._resolveOptions(resolver, task.command.options);
		const presentationOptions = task.command.presentation;

		if (!presentationOptions) {
			throw new Error('Task presentation options should not be undefined here.');
		}
		const waitOnExit = getWaitOnExitValue(presentationOptions, task.configurationProperties);

		let command: CommandString | undefined;
		let args: CommandString[] | undefined;
		let launchConfigs: IShellLaunchConfig | undefined;

		if (task.command.runtime === RuntimeType.CustomExecution) {
			this._currentTask.shellLaunchConfig = launchConfigs = {
				customPtyImplementation: (id, cols, rows) => new TerminalProcessExtHostProxy(id, cols, rows, this._terminalService),
				waitOnExit,
				name: this._createTerminalName(task),
				initialText: task.command.presentation && task.command.presentation.echo ? formatMessageForTerminal(nls.localize({
					key: 'task.executing',
					comment: ['The task command line or label']
				}, 'Executing task: {0}', task._label), { excludeLeadingNewLine: true }) : undefined,
				isFeatureTerminal: true,
				icon: task.configurationProperties.icon?.id ? ThemeIcon.fromId(task.configurationProperties.icon.id) : undefined,
				color: task.configurationProperties.icon?.color || undefined
			};
		} else {
			const resolvedResult: { command: CommandString; args: CommandString[] } = await this._resolveCommandAndArgs(resolver, task.command);
			command = resolvedResult.command;
			args = resolvedResult.args;

			this._currentTask.shellLaunchConfig = launchConfigs = await this._createShellLaunchConfig(task, workspaceFolder, resolver, platform, options, command, args, waitOnExit);
			if (launchConfigs === undefined) {
				return [undefined, new TaskError(Severity.Error, nls.localize('TerminalTaskSystem', 'Can\'t execute a shell command on an UNC drive using cmd.exe.'), TaskErrors.UnknownError)];
			}
		}
		const prefersSameTerminal = presentationOptions.panel === PanelKind.Dedicated;
		const allowsSharedTerminal = presentationOptions.panel === PanelKind.Shared;
		const group = presentationOptions.group;

		const taskKey = task.getMapKey();
		let terminalToReuse: ITerminalData | undefined;
		if (prefersSameTerminal) {
			const terminalId = this._sameTaskTerminals[taskKey];
			if (terminalId) {
				terminalToReuse = this._terminals[terminalId];
				delete this._sameTaskTerminals[taskKey];
			}
		} else if (allowsSharedTerminal) {
			// Always allow to reuse the terminal previously used by the same task.
			let terminalId = this._idleTaskTerminals.remove(taskKey);
			if (!terminalId) {
				// There is no idle terminal which was used by the same task.
				// Search for any idle terminal used previously by a task of the same group
				// (or, if the task has no group, a terminal used by a task without group).
				for (const taskId of this._idleTaskTerminals.keys()) {
					const idleTerminalId = this._idleTaskTerminals.get(taskId)!;
					if (idleTerminalId && this._terminals[idleTerminalId] && this._terminals[idleTerminalId].group === group) {
						terminalId = this._idleTaskTerminals.remove(taskId);
						break;
					}
				}
			}
			if (terminalId) {
				terminalToReuse = this._terminals[terminalId];
			}
		}
		if (terminalToReuse) {
			if (!launchConfigs) {
				throw new Error('Task shell launch configuration should not be undefined here.');
			}

			terminalToReuse.terminal.scrollToBottom();
			await terminalToReuse.terminal.reuseTerminal(launchConfigs);

			if (task.command.presentation && task.command.presentation.clear) {
				terminalToReuse.terminal.clearBuffer();
			}
			this._terminals[terminalToReuse.terminal.instanceId.toString()].lastTask = taskKey;
			return [terminalToReuse.terminal, undefined];
		}

		this._terminalCreationQueue = this._terminalCreationQueue.then(() => this._doCreateTerminal(group, launchConfigs!));
		const terminal: any = (await this._terminalCreationQueue)!; // {{SQL CARBON EDIT}} Specified type any
		terminal.shellLaunchConfig.task = { lastTask: taskKey, group, label: task._label, id: task._id };
		terminal.shellLaunchConfig.reconnectionOwner = ReconnectionType;
		const terminalKey = terminal.instanceId.toString();
		const terminalData = { terminal: terminal, lastTask: taskKey, group };
		terminal.onDisposed(() => this._deleteTaskAndTerminal(terminal, terminalData));
		this._terminals[terminalKey] = terminalData;
		return [terminal, undefined];
	}

	private _buildShellCommandLine(platform: Platform.Platform, shellExecutable: string, shellOptions: IShellConfiguration | undefined, command: CommandString, originalCommand: CommandString | undefined, args: CommandString[]): string {
		const basename = path.parse(shellExecutable).name.toLowerCase();
		const shellQuoteOptions = this._getQuotingOptions(basename, shellOptions, platform);

		function needsQuotes(value: string): boolean {
			if (value.length >= 2) {
				const first = value[0] === shellQuoteOptions.strong ? shellQuoteOptions.strong : value[0] === shellQuoteOptions.weak ? shellQuoteOptions.weak : undefined;
				if (first === value[value.length - 1]) {
					return false;
				}
			}
			let quote: string | undefined;
			for (let i = 0; i < value.length; i++) {
				// We found the end quote.
				const ch = value[i];
				if (ch === quote) {
					quote = undefined;
				} else if (quote !== undefined) {
					// skip the character. We are quoted.
					continue;
				} else if (ch === shellQuoteOptions.escape) {
					// Skip the next character
					i++;
				} else if (ch === shellQuoteOptions.strong || ch === shellQuoteOptions.weak) {
					quote = ch;
				} else if (ch === ' ') {
					return true;
				}
			}
			return false;
		}

		function quote(value: string, kind: ShellQuoting): [string, boolean] {
			if (kind === ShellQuoting.Strong && shellQuoteOptions.strong) {
				return [shellQuoteOptions.strong + value + shellQuoteOptions.strong, true];
			} else if (kind === ShellQuoting.Weak && shellQuoteOptions.weak) {
				return [shellQuoteOptions.weak + value + shellQuoteOptions.weak, true];
			} else if (kind === ShellQuoting.Escape && shellQuoteOptions.escape) {
				if (Types.isString(shellQuoteOptions.escape)) {
					return [value.replace(/ /g, shellQuoteOptions.escape + ' '), true];
				} else {
					const buffer: string[] = [];
					for (const ch of shellQuoteOptions.escape.charsToEscape) {
						buffer.push(`\\${ch}`);
					}
					const regexp: RegExp = new RegExp('[' + buffer.join(',') + ']', 'g');
					const escapeChar = shellQuoteOptions.escape.escapeChar;
					return [value.replace(regexp, (match) => escapeChar + match), true];
				}
			}
			return [value, false];
		}

		function quoteIfNecessary(value: CommandString): [string, boolean] {
			if (Types.isString(value)) {
				if (needsQuotes(value)) {
					return quote(value, ShellQuoting.Strong);
				} else {
					return [value, false];
				}
			} else {
				return quote(value.value, value.quoting);
			}
		}

		// If we have no args and the command is a string then use the command to stay backwards compatible with the old command line
		// model. To allow variable resolving with spaces we do continue if the resolved value is different than the original one
		// and the resolved one needs quoting.
		if ((!args || args.length === 0) && Types.isString(command) && (command === originalCommand as string || needsQuotes(originalCommand as string))) {
			return command;
		}

		const result: string[] = [];
		let commandQuoted = false;
		let argQuoted = false;
		let value: string;
		let quoted: boolean;
		[value, quoted] = quoteIfNecessary(command);
		result.push(value);
		commandQuoted = quoted;
		for (const arg of args) {
			[value, quoted] = quoteIfNecessary(arg);
			result.push(value);
			argQuoted = argQuoted || quoted;
		}

		let commandLine = result.join(' ');
		// There are special rules quoted command line in cmd.exe
		if (platform === Platform.Platform.Windows) {
			if (basename === 'cmd' && commandQuoted && argQuoted) {
				commandLine = '"' + commandLine + '"';
			} else if ((basename === 'powershell' || basename === 'pwsh') && commandQuoted) {
				commandLine = '& ' + commandLine;
			}
		}

		return commandLine;
	}

	private _getQuotingOptions(shellBasename: string, shellOptions: IShellConfiguration | undefined, platform: Platform.Platform): IShellQuotingOptions {
		if (shellOptions && shellOptions.quoting) {
			return shellOptions.quoting;
		}
		return TerminalTaskSystem._shellQuotes[shellBasename] || TerminalTaskSystem._osShellQuotes[Platform.PlatformToString(platform)];
	}

	private _collectTaskVariables(variables: Set<string>, task: CustomTask | ContributedTask): void {
		if (task.command && task.command.name) {
			this._collectCommandVariables(variables, task.command, task);
		}
		this._collectMatcherVariables(variables, task.configurationProperties.problemMatchers);

		if (task.command.runtime === RuntimeType.CustomExecution && (CustomTask.is(task) || ContributedTask.is(task))) {
			let definition: any;
			if (CustomTask.is(task)) {
				definition = task._source.config.element;
			} else {
				definition = Objects.deepClone(task.defines);
				delete definition._key;
				delete definition.type;
			}
			this._collectDefinitionVariables(variables, definition);
		}
	}

	private _collectDefinitionVariables(variables: Set<string>, definition: any): void {
		if (Types.isString(definition)) {
			this._collectVariables(variables, definition);
		} else if (Types.isArray(definition)) {
			definition.forEach((element: any) => this._collectDefinitionVariables(variables, element));
		} else if (Types.isObject(definition)) {
			for (const key in definition) {
				this._collectDefinitionVariables(variables, definition[key]);
			}
		}
	}

	private _collectCommandVariables(variables: Set<string>, command: ICommandConfiguration, task: CustomTask | ContributedTask): void {
		// The custom execution should have everything it needs already as it provided
		// the callback.
		if (command.runtime === RuntimeType.CustomExecution) {
			return;
		}

		if (command.name === undefined) {
			throw new Error('Command name should never be undefined here.');
		}
		this._collectVariables(variables, command.name);
		command.args?.forEach(arg => this._collectVariables(variables, arg));
		// Try to get a scope.
		const scope = (<IExtensionTaskSource>task._source).scope;
		if (scope !== TaskScope.Global) {
			variables.add('${workspaceFolder}');
		}
		if (command.options) {
			const options = command.options;
			if (options.cwd) {
				this._collectVariables(variables, options.cwd);
			}
			const optionsEnv = options.env;
			if (optionsEnv) {
				Object.keys(optionsEnv).forEach((key) => {
					const value: any = optionsEnv[key];
					if (Types.isString(value)) {
						this._collectVariables(variables, value);
					}
				});
			}
			if (options.shell) {
				if (options.shell.executable) {
					this._collectVariables(variables, options.shell.executable);
				}
				options.shell.args?.forEach(arg => this._collectVariables(variables, arg));
			}
		}
	}

	private _collectMatcherVariables(variables: Set<string>, values: Array<string | ProblemMatcher> | undefined): void {
		if (values === undefined || values === null || values.length === 0) {
			return;
		}
		values.forEach((value) => {
			let matcher: ProblemMatcher;
			if (Types.isString(value)) {
				if (value[0] === '$') {
					matcher = ProblemMatcherRegistry.get(value.substring(1));
				} else {
					matcher = ProblemMatcherRegistry.get(value);
				}
			} else {
				matcher = value;
			}
			if (matcher && matcher.filePrefix) {
				this._collectVariables(variables, matcher.filePrefix);
			}
		});
	}

	private _collectVariables(variables: Set<string>, value: string | CommandString): void {
		const string: string = Types.isString(value) ? value : value.value;
		const r = /\$\{(.*?)\}/g;
		let matches: RegExpExecArray | null;
		do {
			matches = r.exec(string);
			if (matches) {
				variables.add(matches[0]);
			}
		} while (matches);
	}

	private async _resolveCommandAndArgs(resolver: VariableResolver, commandConfig: ICommandConfiguration): Promise<{ command: CommandString; args: CommandString[] }> {
		// First we need to use the command args:
		let args: CommandString[] = commandConfig.args ? commandConfig.args.slice() : [];
		args = await this._resolveVariables(resolver, args);
		const command: CommandString = await this._resolveVariable(resolver, commandConfig.name);
		return { command, args };
	}

	private async _resolveVariables(resolver: VariableResolver, value: string[]): Promise<string[]>;
	private async _resolveVariables(resolver: VariableResolver, value: CommandString[]): Promise<CommandString[]>;
	private async _resolveVariables(resolver: VariableResolver, value: CommandString[]): Promise<CommandString[]> {
		return Promise.all(value.map(s => this._resolveVariable(resolver, s)));
	}

	private async _resolveMatchers(resolver: VariableResolver, values: Array<string | ProblemMatcher> | undefined): Promise<ProblemMatcher[]> {
		if (values === undefined || values === null || values.length === 0) {
			return [];
		}
		const result: ProblemMatcher[] = [];
		for (const value of values) {
			let matcher: ProblemMatcher;
			if (Types.isString(value)) {
				if (value[0] === '$') {
					matcher = ProblemMatcherRegistry.get(value.substring(1));
				} else {
					matcher = ProblemMatcherRegistry.get(value);
				}
			} else {
				matcher = value;
			}
			if (!matcher) {
				this._appendOutput(nls.localize('unknownProblemMatcher', 'Problem matcher {0} can\'t be resolved. The matcher will be ignored'));
				continue;
			}
			const taskSystemInfo: ITaskSystemInfo | undefined = resolver.taskSystemInfo;
			const hasFilePrefix = matcher.filePrefix !== undefined;
			const hasUriProvider = taskSystemInfo !== undefined && taskSystemInfo.uriProvider !== undefined;
			if (!hasFilePrefix && !hasUriProvider) {
				result.push(matcher);
			} else {
				const copy = Objects.deepClone(matcher);
				if (hasUriProvider && (taskSystemInfo !== undefined)) {
					copy.uriProvider = taskSystemInfo.uriProvider;
				}
				if (hasFilePrefix) {
					copy.filePrefix = await this._resolveVariable(resolver, copy.filePrefix);
				}
				result.push(copy);
			}
		}
		return result;
	}

	private async _resolveVariable(resolver: VariableResolver, value: string | undefined): Promise<string>;
	private async _resolveVariable(resolver: VariableResolver, value: CommandString | undefined): Promise<CommandString>;
	private async _resolveVariable(resolver: VariableResolver, value: CommandString | undefined): Promise<CommandString> {
		// TODO@Dirk Task.getWorkspaceFolder should return a WorkspaceFolder that is defined in workspace.ts
		if (Types.isString(value)) {
			return resolver.resolve(value);
		} else if (value !== undefined) {
			return {
				value: await resolver.resolve(value.value),
				quoting: value.quoting
			};
		} else { // This should never happen
			throw new Error('Should never try to resolve undefined.');
		}
	}

	private async _resolveOptions(resolver: VariableResolver, options: CommandOptions | undefined): Promise<CommandOptions> {
		if (options === undefined || options === null) {
			let cwd: string | undefined;
			try {
				cwd = await this._resolveVariable(resolver, '${workspaceFolder}');
			} catch (e) {
				// No workspace
			}
			return { cwd };
		}
		const result: CommandOptions = Types.isString(options.cwd)
			? { cwd: await this._resolveVariable(resolver, options.cwd) }
			: { cwd: await this._resolveVariable(resolver, '${workspaceFolder}') };
		if (options.env) {
			result.env = Object.create(null);
			for (const key of Object.keys(options.env)) {
				const value: any = options.env![key];
				if (Types.isString(value)) {
					result.env![key] = await this._resolveVariable(resolver, value);
				} else {
					result.env![key] = value.toString();
				}
			}
		}
		return result;
	}

	static WellKnownCommands: IStringDictionary<boolean> = {
		'ant': true,
		'cmake': true,
		'eslint': true,
		'gradle': true,
		'grunt': true,
		'gulp': true,
		'jake': true,
		'jenkins': true,
		'jshint': true,
		'make': true,
		'maven': true,
		'msbuild': true,
		'msc': true,
		'nmake': true,
		'npm': true,
		'rake': true,
		'tsc': true,
		'xbuild': true
	};

	public getSanitizedCommand(cmd: string): string {
		let result = cmd.toLowerCase();
		const index = result.lastIndexOf(path.sep);
		if (index !== -1) {
			result = result.substring(index + 1);
		}
		if (TerminalTaskSystem.WellKnownCommands[result]) {
			return result;
		}
		return 'other';
	}

	private _appendOutput(output: string): void {
		const outputChannel = this._outputService.getChannel(this._outputChannelId);
		outputChannel?.append(output);
	}
}

function getWaitOnExitValue(presentationOptions: IPresentationOptions, configurationProperties: IConfigurationProperties) {
	if ((presentationOptions.close === undefined) || (presentationOptions.close === false)) {
		if ((presentationOptions.reveal !== RevealKind.Never) || !configurationProperties.isBackground || (presentationOptions.close === false)) {
			if (presentationOptions.panel === PanelKind.New) {
				return taskShellIntegrationWaitOnExitSequence(nls.localize('closeTerminal', 'Press any key to close the terminal.'));
			} else if (presentationOptions.showReuseMessage) {
				return taskShellIntegrationWaitOnExitSequence(nls.localize('reuseTerminal', 'Terminal will be reused by tasks, press any key to close it.'));
			} else {
				return true;
			}
		}
	}
	return !presentationOptions.close;
}

function taskShellIntegrationWaitOnExitSequence(message: string): (exitCode: number) => string {
	return (exitCode) => {
		return `${VSCodeSequence(VSCodeOscPt.CommandFinished, exitCode.toString())}${message}`;
	};
}
