/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { EditorAction, EditorAction2, ServicesAccessor, registerEditorAction } from 'vs/editor/browser/editorExtensions';
import { KeyCode } from 'vs/base/common/keyCodes';
import { localize } from 'vs/nls';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { StandaloneColorPickerController } from 'vs/editor/contrib/colorPicker/browser/standaloneColorPickerWidget';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { MenuId, registerAction2 } from 'vs/platform/actions/common/actions';
import 'vs/css!./colorPicker';

export class ShowOrFocusStandaloneColorPicker extends EditorAction2 {
	constructor() {
		super({
			id: 'editor.action.showOrFocusStandaloneColorPicker',
			title: {
				value: localize('showOrFocusStandaloneColorPicker', "Show or Focus Standalone Color Picker"),
				mnemonicTitle: localize({ key: 'mishowOrFocusStandaloneColorPicker', comment: ['&& denotes a mnemonic'] }, "&&Show or Focus Standalone Color Picker"),
				original: 'Show or Focus Standalone Color Picker',
			},
			precondition: undefined,
			menu: [
				{ id: MenuId.CommandPalette },
			]
		});
	}
	runEditorCommand(_accessor: ServicesAccessor, editor: ICodeEditor) {
		StandaloneColorPickerController.get(editor)?.showOrFocus();
	}
}

class HideStandaloneColorPicker extends EditorAction {
	constructor() {
		super({
			id: 'editor.action.hideColorPicker',
			label: localize({
				key: 'hideColorPicker',
				comment: [
					'Action that hides the color picker'
				]
			}, "Hide the Color Picker"),
			alias: 'Hide the Color Picker',
			precondition: EditorContextKeys.standaloneColorPickerVisible.isEqualTo(true),
			kbOpts: {
				primary: KeyCode.Escape,
				weight: KeybindingWeight.EditorContrib
			}
		});
	}
	public run(_accessor: ServicesAccessor, editor: ICodeEditor): void {
		StandaloneColorPickerController.get(editor)?.hide();
	}
}

class InsertColorWithStandaloneColorPicker extends EditorAction {
	constructor() {
		super({
			id: 'editor.action.insertColorWithStandaloneColorPicker',
			label: localize({
				key: 'insertColorWithStandaloneColorPicker',
				comment: [
					'Action that inserts color with standalone color picker'
				]
			}, "Insert Color with Standalone Color Picker"),
			alias: 'Insert Color with Standalone Color Picker',
			precondition: EditorContextKeys.standaloneColorPickerFocused.isEqualTo(true),
			kbOpts: {
				primary: KeyCode.Enter,
				weight: KeybindingWeight.EditorContrib
			}
		});
	}
	public run(_accessor: ServicesAccessor, editor: ICodeEditor): void {
		StandaloneColorPickerController.get(editor)?.insertColor();
	}
}

registerEditorAction(HideStandaloneColorPicker);
registerEditorAction(InsertColorWithStandaloneColorPicker);
registerAction2(ShowOrFocusStandaloneColorPicker);
