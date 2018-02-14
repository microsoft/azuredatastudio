/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtensionPointUser, ExtensionMessageCollector, ExtensionsRegistry } from 'vs/platform/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';
import { isFalsyOrWhitespace } from 'vs/base/common/strings';
import { IdGenerator } from 'vs/base/common/idGenerator';
import { ILocalizedString } from 'vs/platform/actions/common/actions';
import { join } from 'path';
import { createCSSRule } from 'vs/base/browser/dom';
import URI from 'vs/base/common/uri';

import { TaskRegistry } from 'sql/platform/tasks/common/tasks';

const taskType: IJSONSchema = {
	type: 'object',
	properties: {
		task: {
			description: localize('sqlops.extension.contributes.taskType.task', 'Identifier of the task to execute'),
			type: 'string'
		},
		title: {
			description: localize('sqlops.extension.contributes.taskType.title', 'Title by which the task is represented in the UI'),
			type: 'string'
		},
		// category: {
		// 	description: localize('sqlops.extension.contributes.taskType.category', '(Optional) Category string by the task is grouped in the UI'),
		// 	type: 'string'
		// },
		icon: {
			description: localize('sqlops.extension.contributes.taskType.icon', '(Optional) Icon which is used to represent the task in the UI. Either a file path or a themable configuration'),
			anyOf: [{
				type: 'string'
			},
			{
				type: 'object',
				properties: {
					light: {
						description: localize('sqlops.extension.contributes.taskType.icon.light', 'Icon path when a light theme is used'),
						type: 'string'
					},
					dark: {
						description: localize('sqlops.extension.contributes.taskType.icon.dark', 'Icon path when a dark theme is used'),
						type: 'string'
					}
				}
			}]
		}
	}
};

export const tasksContribution: IJSONSchema = {
	description: localize('sqlops.extension.contributes.tasks', "Contributes tasks to the command palette."),
	oneOf: [
		taskType,
		{
			type: 'array',
			items: taskType
		}
	]
};

export interface IUserFriendlyTask {
	task: string;
	title: string | ILocalizedString;
	// category?: string | ILocalizedString;
	icon?: IUserFriendlyIcon;
}

function isValidLocalizedString(localized: string | ILocalizedString, collector: ExtensionMessageCollector, propertyName: string): boolean {
	if (typeof localized === 'undefined') {
		collector.error(localize('requireStringOrObject', "property `{0}` is mandatory and must be of type `string` or `object`", propertyName));
		return false;
	} else if (typeof localized === 'string' && isFalsyOrWhitespace(localized)) {
		collector.error(localize('requirestring', "property `{0}` is mandatory and must be of type `string`", propertyName));
		return false;
	} else if (typeof localized !== 'string' && (isFalsyOrWhitespace(localized.original) || isFalsyOrWhitespace(localized.value))) {
		collector.error(localize('requirestrings', "properties `{0}` and `{1}` are mandatory and must be of type `string`", `${propertyName}.value`, `${propertyName}.original`));
		return false;
	}

	return true;
}

function isValidIcon(icon: IUserFriendlyIcon, collector: ExtensionMessageCollector): boolean {
	if (typeof icon === 'undefined') {
		return true;
	}
	if (typeof icon === 'string') {
		return true;
	} else if (typeof icon.dark === 'string' && typeof icon.light === 'string') {
		return true;
	}
	collector.error(localize('opticon', "property `icon` can be omitted or must be either a string or a literal like `{dark, light}`"));
	return false;
}

export type IUserFriendlyIcon = string | { light: string; dark: string; };

export function isValidCommand(task: IUserFriendlyTask, collector: ExtensionMessageCollector): boolean {
	if (!task) {
		collector.error(localize('nonempty', "expected non-empty value."));
		return false;
	}
	if (isFalsyOrWhitespace(task.task)) {
		collector.error(localize('requirestring', "property `{0}` is mandatory and must be of type `string`", 'command'));
		return false;
	}
	if (!isValidLocalizedString(task.title, collector, 'title')) {
		return false;
	}
	// if (task.category && !isValidLocalizedString(task.category, collector, 'category')) {
	// 	return false;
	// }
	if (!isValidIcon(task.icon, collector)) {
		return false;
	}
	return true;
}

ExtensionsRegistry.registerExtensionPoint<IUserFriendlyTask | IUserFriendlyTask[]>('tasks', [], tasksContribution).setHandler(extensions => {

	const ids = new IdGenerator('contrib-task-icon-');

	function handleCommand(userFriendlyTask: IUserFriendlyTask, extension: IExtensionPointUser<any>) {

		if (!isValidCommand(userFriendlyTask, extension.collector)) {
			return;
		}

		let { icon, /*category,*/ title, task } = userFriendlyTask;
		let iconClass: string;
		let iconPath: string;
		if (icon) {
			iconClass = ids.nextId();
			if (typeof icon === 'string') {
				iconPath = join(extension.description.extensionFolderPath, icon);
				createCSSRule(`.icon.${iconClass}`, `background-image: url("${URI.file(iconPath).toString()}")`);
			} else {
				const light = join(extension.description.extensionFolderPath, icon.light);
				const dark = join(extension.description.extensionFolderPath, icon.dark);
				createCSSRule(`.icon.${iconClass}`, `background-image: url("${URI.file(light).toString()}")`);
				createCSSRule(`.vs-dark .icon.${iconClass}, .hc-black .icon.${iconClass}`, `background-image: url("${URI.file(dark).toString()}")`);

				iconPath = join(extension.description.extensionFolderPath, icon.dark);
			}
		}

		if (TaskRegistry.addTask({ id: task, title, /*category,*/ iconClass, iconPath })) {
			extension.collector.info(localize('dup', "Task `{0}` appears multiple times in the `tasks` section.", userFriendlyTask.task));
		}
	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<IUserFriendlyTask>(value)) {
			for (let command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});
