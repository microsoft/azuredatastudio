/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IQuickPickSeparator, IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { IPickerQuickAccessItem, PickerQuickAccessProvider, TriggerAction } from 'vs/platform/quickinput/browser/pickerQuickAccess';
import { matchesFuzzy } from 'vs/base/common/filters';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { ITaskService, Task } from 'vs/workbench/contrib/tasks/common/taskService';
import { CustomTask, ContributedTask, ConfiguringTask } from 'vs/workbench/contrib/tasks/common/tasks';
import { CancellationToken } from 'vs/base/common/cancellation';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { TaskQuickPick, TaskTwoLevelQuickPickEntry } from 'vs/workbench/contrib/tasks/browser/taskQuickPick';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { isString } from 'vs/base/common/types';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';

export class TasksQuickAccessProvider extends PickerQuickAccessProvider<IPickerQuickAccessItem> {

	static PREFIX = 'task ';

	private activationPromise: Promise<void>;

	constructor(
		@IExtensionService extensionService: IExtensionService,
		@ITaskService private taskService: ITaskService,
		@IConfigurationService private configurationService: IConfigurationService,
		@IQuickInputService private quickInputService: IQuickInputService,
		@INotificationService private notificationService: INotificationService,
		@IDialogService private dialogService: IDialogService
	) {
		super(TasksQuickAccessProvider.PREFIX, {
			noResultsPick: {
				label: localize('noTaskResults', "No matching tasks")
			}
		});

		this.activationPromise = extensionService.activateByEvent('onCommand:workbench.action.tasks.runTask');
	}

	protected async _getPicks(filter: string, disposables: DisposableStore, token: CancellationToken): Promise<Array<IPickerQuickAccessItem | IQuickPickSeparator>> {
		// always await extensions
		await this.activationPromise;

		if (token.isCancellationRequested) {
			return [];
		}

		const taskQuickPick = new TaskQuickPick(this.taskService, this.configurationService, this.quickInputService, this.notificationService, this.dialogService);
		const topLevelPicks = await taskQuickPick.getTopLevelEntries();
		const taskPicks: Array<IPickerQuickAccessItem | IQuickPickSeparator> = [];

		for (const entry of topLevelPicks.entries) {
			const highlights = matchesFuzzy(filter, entry.label!);
			if (!highlights) {
				continue;
			}

			if (entry.type === 'separator') {
				taskPicks.push(entry);
			}

			const task: Task | ConfiguringTask | string = (<TaskTwoLevelQuickPickEntry>entry).task!;
			const quickAccessEntry: IPickerQuickAccessItem = <TaskTwoLevelQuickPickEntry>entry;
			quickAccessEntry.highlights = { label: highlights };
			quickAccessEntry.trigger = (index) => {
				if ((index === 1) && (quickAccessEntry.buttons?.length === 2)) {
					const key = (task && !isString(task)) ? task.getRecentlyUsedKey() : undefined;
					if (key) {
						this.taskService.removeRecentlyUsedTask(key);
					}
					return TriggerAction.REFRESH_PICKER;
				} else {
					if (ContributedTask.is(task)) {
						this.taskService.customize(task, undefined, true);
					} else if (CustomTask.is(task)) {
						this.taskService.openConfig(task);
					}
					return TriggerAction.CLOSE_PICKER;
				}
			};
			quickAccessEntry.accept = async () => {
				if (isString(task)) {
					// switch to quick pick and show second level
					const showResult = await taskQuickPick.show(localize('TaskService.pickRunTask', 'Select the task to run'), undefined, task);
					if (showResult) {
						this.taskService.run(showResult, { attachProblemMatcher: true });
					}
				} else {
					this.taskService.run(await this.toTask(task), { attachProblemMatcher: true });
				}
			};

			taskPicks.push(quickAccessEntry);
		}
		return taskPicks;
	}

	private async toTask(task: Task | ConfiguringTask): Promise<Task | undefined> {
		if (!ConfiguringTask.is(task)) {
			return task;
		}

		return this.taskService.tryResolveTask(task);
	}
}
