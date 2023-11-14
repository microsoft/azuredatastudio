/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';

import { ToggleViewAction } from 'sql/workbench/browser/actions/layoutActions';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';


export class ToggleTasksAction extends ToggleViewAction {

	public static readonly ID = 'workbench.action.tasks.toggleTasks';
	public static readonly LABEL_ORG = 'Toggle Tasks';
	public static readonly LABEL = localize('toggleTasks', "Toggle Tasks");

	constructor(

	) {
		super(ToggleTasksAction.ID, ToggleTasksAction.LABEL_ORG, ToggleTasksAction.LABEL,
			{ weight: KeybindingWeight.WorkbenchContrib, primary: KeyMod.CtrlCmd | KeyCode.KeyT });
	}
}
