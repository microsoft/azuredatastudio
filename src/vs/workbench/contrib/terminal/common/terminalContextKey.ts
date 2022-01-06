/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';

export const enum TerminalContextKeyStrings {
	IsOpen = 'terminalIsOpen',
	Count = 'terminalCount',
	GroupCount = 'terminalGroupCount',
	TabsNarrow = 'isTerminalTabsNarrow',
	ProcessSupported = 'terminalProcessSupported',
	Focus = 'terminalFocus',
	EditorFocus = 'terminalEditorFocus',
	TabsFocus = 'terminalTabsFocus',
	TabsMouse = 'terminalTabsMouse',
	AltBufferActive = 'terminalAltBufferActive',
	A11yTreeFocus = 'terminalA11yTreeFocus',
	TextSelected = 'terminalTextSelected',
	FindVisible = 'terminalFindVisible',
	FindInputFocused = 'terminalFindInputFocused',
	FindFocused = 'terminalFindFocused',
	TabsSingularSelection = 'terminalTabsSingularSelection',
	SplitTerminal = 'terminalSplitTerminal',
	ShellType = 'terminalShellType',
}

export namespace TerminalContextKeys {
	/** Whether there is at least one opened terminal. */
	export const isOpen = new RawContextKey<boolean>(TerminalContextKeyStrings.IsOpen, false, true);

	/** Whether the terminal is focused. */
	export const focus = new RawContextKey<boolean>(TerminalContextKeyStrings.Focus, false, localize('terminalFocusContextKey', "Whether the terminal is focused."));

	/** Whether a terminal in the editor area is focused. */
	export const editorFocus = new RawContextKey<boolean>(TerminalContextKeyStrings.EditorFocus, false, localize('terminalEditorFocusContextKey', "Whether a terminal in the editor area is focused."));

	/** The current number of terminals. */
	export const count = new RawContextKey<number>(TerminalContextKeyStrings.Count, 0, localize('terminalCountContextKey', "The current number of terminals."));

	/** The current number of terminal groups. */
	export const groupCount = new RawContextKey<number>(TerminalContextKeyStrings.GroupCount, 0, true);

	/** Whether the terminal tabs view is narrow. */
	export const tabsNarrow = new RawContextKey<boolean>(TerminalContextKeyStrings.TabsNarrow, false, true);

	/** Whether the terminal tabs widget is focused. */
	export const tabsFocus = new RawContextKey<boolean>(TerminalContextKeyStrings.TabsFocus, false, localize('terminalTabsFocusContextKey', "Whether the terminal tabs widget is focused."));

	/** Whether the mouse is within the terminal tabs list. */
	export const tabsMouse = new RawContextKey<boolean>(TerminalContextKeyStrings.TabsMouse, false, true);

	/** The shell type of the active terminal, this is set to the last known value when no terminals exist. */
	export const shellType = new RawContextKey<string>(TerminalContextKeyStrings.ShellType, undefined, { type: 'string', description: localize('terminalShellTypeContextKey', "The shell type of the active terminal, this is set to the last known value when no terminals exist.") });

	/** Whether the terminal's alt buffer is active. */
	export const altBufferActive = new RawContextKey<boolean>(TerminalContextKeyStrings.AltBufferActive, false, localize('terminalAltBufferActive', "Whether the terminal's alt buffer is active."));

	/** Whether the terminal is NOT focused. */
	export const notFocus = focus.toNegated();

	/** Whether the user is navigating a terminal's the accessibility tree. */
	export const a11yTreeFocus = new RawContextKey<boolean>(TerminalContextKeyStrings.A11yTreeFocus, false, true);

	/** Whether text is selected in the active terminal. */
	export const textSelected = new RawContextKey<boolean>(TerminalContextKeyStrings.TextSelected, false, localize('terminalTextSelectedContextKey', "Whether text is selected in the active terminal."));

	/** Whether text is NOT selected in the active terminal. */
	export const notTextSelected = textSelected.toNegated();

	/** Whether the active terminal's find widget is visible. */
	export const findVisible = new RawContextKey<boolean>(TerminalContextKeyStrings.FindVisible, false, true);

	/** Whether the active terminal's find widget is NOT visible. */
	export const notFindVisible = findVisible.toNegated();

	/** Whether the active terminal's find widget text input is focused. */
	export const findInputFocus = new RawContextKey<boolean>(TerminalContextKeyStrings.FindInputFocused, false, true);

	/** Whether an element iwhtin the active terminal's find widget is focused. */
	export const findFocus = new RawContextKey<boolean>(TerminalContextKeyStrings.FindFocused, false, true);

	/** Whether NO elements within the active terminal's find widget is focused. */
	export const notFindFocus = findInputFocus.toNegated();

	/** Whether terminal processes can be launched in the current workspace. */
	export const processSupported = new RawContextKey<boolean>(TerminalContextKeyStrings.ProcessSupported, false, localize('terminalProcessSupportedContextKey', "Whether terminal processes can be launched in the current workspace."));

	/** Whether one terminal is selected in the terminal tabs list. */
	export const tabsSingularSelection = new RawContextKey<boolean>(TerminalContextKeyStrings.TabsSingularSelection, false, localize('terminalTabsSingularSelectedContextKey', "Whether one terminal is selected in the terminal tabs list."));

	/** Whether the focused tab's terminal is a split terminal. */
	export const splitTerminal = new RawContextKey<boolean>(TerminalContextKeyStrings.SplitTerminal, false, localize('isSplitTerminalContextKey', "Whether the focused tab's terminal is a split terminal."));
}
