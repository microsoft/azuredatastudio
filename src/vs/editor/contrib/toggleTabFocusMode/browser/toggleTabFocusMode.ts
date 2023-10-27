/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { alert } from 'vs/base/browser/ui/aria/aria';
import { KeyCode, KeyMod, KeyChord } from 'vs/base/common/keyCodes';
import { TabFocus, TabFocusContext } from 'vs/editor/browser/config/tabFocus';
import { ServicesAccessor } from 'vs/editor/browser/editorExtensions';
import * as nls from 'vs/nls';
import { Action2, registerAction2 } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';

export class ToggleTabFocusModeAction extends Action2 {

	public static readonly ID = 'editor.action.toggleTabFocusMode';

	public static readonly LABEL = nls.localize({ key: 'toggle.tabMovesFocus', comment: ['Turn on/off use of tab key for moving focus around VS Code'] }, 'Toggle Tab Key Moves Focus'); // {{SQL CARBON EDIT}} - add label property

	constructor() {
		super({
			id: ToggleTabFocusModeAction.ID,
			title: { value: ToggleTabFocusModeAction.LABEL, original: 'Toggle Tab Key Moves Focus' }, // {{SQL CARBON EDIT}} - add label property
			precondition: undefined,
			keybinding: {
				primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyM), // {{SQL CARBON EDIT}} We use Ctrl+M already so move this to an unused binding
				mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KeyM },
				weight: KeybindingWeight.EditorContrib
			},
			f1: true
		});
	}

	public run(accessor: ServicesAccessor): void {
		const context = accessor.get(IContextKeyService).getContextKeyValue('focusedView') === 'terminal' ? TabFocusContext.Terminal : TabFocusContext.Editor;
		const oldValue = TabFocus.getTabFocusMode(context);
		const newValue = !oldValue;
		TabFocus.setTabFocusMode(newValue, context);
		if (newValue) {
			alert(nls.localize('toggle.tabMovesFocus.on', "Pressing Tab will now move focus to the next focusable element"));
		} else {
			alert(nls.localize('toggle.tabMovesFocus.off', "Pressing Tab will now insert the tab character"));
		}
	}
}

registerAction2(ToggleTabFocusModeAction);
