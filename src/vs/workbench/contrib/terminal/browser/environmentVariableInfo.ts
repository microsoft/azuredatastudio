/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EnvironmentVariableMutatorType, IEnvironmentVariableInfo, IMergedEnvironmentVariableCollection, IMergedEnvironmentVariableCollectionDiff } from 'vs/workbench/contrib/terminal/common/environmentVariable';
import { TerminalCommandId } from 'vs/workbench/contrib/terminal/common/terminal';
import { ITerminalService } from 'vs/workbench/contrib/terminal/browser/terminal';
import { localize } from 'vs/nls';
import { ThemeIcon } from 'vs/platform/theme/common/themeService';
import { Codicon } from 'vs/base/common/codicons';
import { IHoverAction } from 'vs/workbench/services/hover/browser/hover';

export class EnvironmentVariableInfoStale implements IEnvironmentVariableInfo {
	readonly requiresAction = true;

	constructor(
		private readonly _diff: IMergedEnvironmentVariableCollectionDiff,
		private readonly _terminalId: number,
		@ITerminalService private readonly _terminalService: ITerminalService
	) {
	}

	getInfo(): string {
		const addsAndChanges: string[] = [];
		const removals: string[] = [];
		this._diff.added.forEach((mutators, variable) => {
			mutators.forEach(mutator => addsAndChanges.push(mutatorTypeLabel(mutator.type, mutator.value, variable)));
		});
		this._diff.changed.forEach((mutators, variable) => {
			mutators.forEach(mutator => addsAndChanges.push(mutatorTypeLabel(mutator.type, mutator.value, variable)));
		});
		this._diff.removed.forEach((mutators, variable) => {
			mutators.forEach(mutator => removals.push(mutatorTypeLabel(mutator.type, mutator.value, variable)));
		});

		let info: string = '';

		if (addsAndChanges.length > 0) {
			info = localize('extensionEnvironmentContributionChanges', "Extensions want to make the following changes to the terminal's environment:");
			info += '\n\n';
			info += '```\n';
			info += addsAndChanges.join('\n');
			info += '\n```';
		}

		if (removals.length > 0) {
			info += info.length > 0 ? '\n\n' : '';
			info += localize('extensionEnvironmentContributionRemoval', "Extensions want to remove these existing changes from the terminal's environment:");
			info += '\n\n';
			info += '```\n';
			info += removals.join('\n');
			info += '\n```';
		}

		return info;
	}

	getIcon(): ThemeIcon {
		return Codicon.warning;
	}

	getActions(): IHoverAction[] {
		return [{
			label: localize('relaunchTerminalLabel', "Relaunch terminal"),
			run: () => this._terminalService.getInstanceFromId(this._terminalId)?.relaunch(),
			commandId: TerminalCommandId.Relaunch
		}];
	}
}

export class EnvironmentVariableInfoChangesActive implements IEnvironmentVariableInfo {
	readonly requiresAction = false;

	constructor(
		private _collection: IMergedEnvironmentVariableCollection
	) {
	}

	getInfo(): string {
		const changes: string[] = [];
		this._collection.map.forEach((mutators, variable) => {
			mutators.forEach(mutator => changes.push(mutatorTypeLabel(mutator.type, mutator.value, variable)));
		});
		const message = localize('extensionEnvironmentContributionInfo', "Extensions have made changes to this terminal's environment");
		return message + '\n\n```\n' + changes.join('\n') + '\n```';
	}

	getIcon(): ThemeIcon {
		return Codicon.info;
	}
}

function mutatorTypeLabel(type: EnvironmentVariableMutatorType, value: string, variable: string): string {
	switch (type) {
		case EnvironmentVariableMutatorType.Prepend: return `${variable}=${value}\${env:${variable}}`;
		case EnvironmentVariableMutatorType.Append: return `${variable}=\${env:${variable}}${value}`;
		default: return `${variable}=${value}`;
	}
}
