/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { alert } from 'vs/base/browser/ui/aria/aria';
import { KeyCode, KeyMod, KeyChord } from 'vs/base/common/keyCodes';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { EditorAction, ServicesAccessor, registerEditorAction } from 'vs/editor/browser/editorExtensions';
import { TabFocus } from 'vs/editor/common/config/commonEditorConfig';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';

export class ToggleTabFocusModeAction extends EditorAction {

	public static readonly ID = 'editor.action.toggleTabFocusMode';

	constructor() {
		super({
			id: ToggleTabFocusModeAction.ID,
			label: nls.localize({ key: 'toggle.tabMovesFocus', comment: ['Turn on/off use of tab key for moving focus around VS Code'] }, "Toggle Tab Key Moves Focus"),
			alias: 'Toggle Tab Key Moves Focus',
			precondition: undefined,
			kbOpts: {
				kbExpr: null,
				primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_M), // {{SQL CARBON EDIT}} We use Ctrl+M already so move this to an unused binding
				mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KEY_M },
				weight: KeybindingWeight.EditorContrib
			}
		});
	}

	public run(accessor: ServicesAccessor, editor: ICodeEditor): void {
		const oldValue = TabFocus.getTabFocusMode();
		const newValue = !oldValue;
		TabFocus.setTabFocusMode(newValue);
		if (newValue) {
			alert(nls.localize('toggle.tabMovesFocus.on', "Pressing Tab will now move focus to the next focusable element"));
		} else {
			alert(nls.localize('toggle.tabMovesFocus.off', "Pressing Tab will now insert the tab character"));
		}
	}
}

registerEditorAction(ToggleTabFocusModeAction);
