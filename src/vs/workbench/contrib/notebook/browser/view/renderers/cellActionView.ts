/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import { Action, IAction, Separator } from 'vs/base/common/actions';
import { IMenu, IMenuActionOptions, MenuItemAction, SubmenuItemAction } from 'vs/platform/actions/common/actions';
import { DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { BaseActionViewItem } from 'vs/base/browser/ui/actionbar/actionViewItems';

export class VerticalSeparator extends Action {
	static readonly ID = 'vs.actions.verticalSeparator';

	constructor(
		label?: string
	) {
		super(VerticalSeparator.ID, label, label ? 'verticalSeparator text' : 'verticalSeparator');
		this.checked = false;
		this.enabled = false;
	}
}

export class VerticalSeparatorViewItem extends BaseActionViewItem {
	render(container: HTMLElement) {
		DOM.addClass(container, 'verticalSeparator');
		// const iconContainer = DOM.append(container, $('.verticalSeparator'));
		// DOM.addClasses(iconContainer, 'codicon', 'codicon-chrome-minimize');
	}
}

export function createAndFillInActionBarActionsWithVerticalSeparators(menu: IMenu, options: IMenuActionOptions | undefined, target: IAction[] | { primary: IAction[]; secondary: IAction[]; }, alwaysFillSecondary?: boolean, isPrimaryGroup?: (group: string) => boolean): IDisposable {
	const groups = menu.getActions(options);
	// Action bars handle alternative actions on their own so the alternative actions should be ignored
	fillInActions(groups, target, false, alwaysFillSecondary, isPrimaryGroup);
	return asDisposable(groups);
}

function fillInActions(groups: ReadonlyArray<[string, ReadonlyArray<MenuItemAction | SubmenuItemAction>]>, target: IAction[] | { primary: IAction[]; secondary: IAction[]; }, useAlternativeActions: boolean, alwaysFillSecondary = false, isPrimaryGroup: (group: string) => boolean = group => group === 'navigation'): void {
	for (const tuple of groups) {
		let [group, actions] = tuple;
		if (useAlternativeActions) {
			actions = actions.map(a => (a instanceof MenuItemAction) && !!a.alt ? a.alt : a);
		}

		const isPrimary = isPrimaryGroup(group);
		if (isPrimary) {
			const to = Array.isArray<IAction>(target) ? target : target.primary;

			if (to.length > 0) {
				to.push(new VerticalSeparator());
			}

			to.push(...actions);
		}

		if (!isPrimary || alwaysFillSecondary) {
			const to = Array.isArray<IAction>(target) ? target : target.secondary;

			if (to.length > 0) {
				to.push(new Separator());
			}

			to.push(...actions);
		}
	}
}

function asDisposable(groups: ReadonlyArray<[string, ReadonlyArray<MenuItemAction | SubmenuItemAction>]>): IDisposable {
	const disposables = new DisposableStore();
	for (const [, actions] of groups) {
		for (const action of actions) {
			disposables.add(action);
		}
	}
	return disposables;
}
