/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import * as nls from 'vs/nls';
import { Action2, MenuId } from 'vs/platform/actions/common/actions';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { Categories } from 'vs/platform/action/common/actionCommonCategories';
import { IWebviewService, KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_ENABLED, KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED, KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_VISIBLE, IWebview } from 'vs/workbench/contrib/webview/browser/webview';
import { WebviewEditor } from 'vs/workbench/contrib/webviewPanel/browser/webviewEditor';
import { WebviewInput } from 'vs/workbench/contrib/webviewPanel/browser/webviewEditorInput';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';

const webviewActiveContextKeyExpr = ContextKeyExpr.and(ContextKeyExpr.equals('activeEditor', WebviewEditor.ID), EditorContextKeys.focus.toNegated() /* https://github.com/microsoft/vscode/issues/58668 */)!;

export class ShowWebViewEditorFindWidgetAction extends Action2 {
	public static readonly ID = 'editor.action.webvieweditor.showFind';
	public static readonly LABEL = nls.localize('editor.action.webvieweditor.showFind', "Show find");

	constructor() {
		super({
			id: ShowWebViewEditorFindWidgetAction.ID,
			title: ShowWebViewEditorFindWidgetAction.LABEL,
			keybinding: {
				when: ContextKeyExpr.and(webviewActiveContextKeyExpr, KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_ENABLED),
				primary: KeyMod.CtrlCmd | KeyCode.KeyF,
				weight: KeybindingWeight.EditorContrib
			}
		});
	}

	public run(accessor: ServicesAccessor): void {
		getActiveWebviewEditor(accessor)?.showFind();
	}
}

export class HideWebViewEditorFindCommand extends Action2 {
	public static readonly ID = 'editor.action.webvieweditor.hideFind';
	public static readonly LABEL = nls.localize('editor.action.webvieweditor.hideFind', "Stop find");

	constructor() {
		super({
			id: HideWebViewEditorFindCommand.ID,
			title: HideWebViewEditorFindCommand.LABEL,
			keybinding: {
				when: ContextKeyExpr.and(webviewActiveContextKeyExpr, KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_VISIBLE),
				primary: KeyCode.Escape,
				weight: KeybindingWeight.EditorContrib
			}
		});
	}

	public run(accessor: ServicesAccessor): void {
		getActiveWebviewEditor(accessor)?.hideFind();
	}
}

export class WebViewEditorFindNextCommand extends Action2 {
	public static readonly ID = 'editor.action.webvieweditor.findNext';
	public static readonly LABEL = nls.localize('editor.action.webvieweditor.findNext', 'Find next');

	constructor() {
		super({
			id: WebViewEditorFindNextCommand.ID,
			title: WebViewEditorFindNextCommand.LABEL,
			keybinding: {
				when: ContextKeyExpr.and(webviewActiveContextKeyExpr, KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED),
				primary: KeyCode.Enter,
				weight: KeybindingWeight.EditorContrib
			}
		});
	}

	public run(accessor: ServicesAccessor): void {
		getActiveWebviewEditor(accessor)?.runFindAction(false);
	}
}

export class WebViewEditorFindPreviousCommand extends Action2 {
	public static readonly ID = 'editor.action.webvieweditor.findPrevious';
	public static readonly LABEL = nls.localize('editor.action.webvieweditor.findPrevious', 'Find previous');

	constructor() {
		super({
			id: WebViewEditorFindPreviousCommand.ID,
			title: WebViewEditorFindPreviousCommand.LABEL,
			keybinding: {
				when: ContextKeyExpr.and(webviewActiveContextKeyExpr, KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED),
				primary: KeyMod.Shift | KeyCode.Enter,
				weight: KeybindingWeight.EditorContrib
			}
		});
	}

	public run(accessor: ServicesAccessor): void {
		getActiveWebviewEditor(accessor)?.runFindAction(true);
	}
}

export class ReloadWebviewAction extends Action2 {
	static readonly ID = 'workbench.action.webview.reloadWebviewAction';
	static readonly LABEL = nls.localize('refreshWebviewLabel', "Reload Webviews");

	public constructor() {
		super({
			id: ReloadWebviewAction.ID,
			title: { value: ReloadWebviewAction.LABEL, original: 'Reload Webviews' },
			category: Categories.Developer,
			menu: [{
				id: MenuId.CommandPalette
			}]
		});
	}

	public async run(accessor: ServicesAccessor): Promise<void> {
		const webviewService = accessor.get(IWebviewService);
		for (const webview of webviewService.webviews) {
			webview.reload();
		}
	}
}

function getActiveWebviewEditor(accessor: ServicesAccessor): IWebview | undefined {
	const editorService = accessor.get(IEditorService);
	const activeEditor = editorService.activeEditor;
	return activeEditor instanceof WebviewInput ? activeEditor.webview : undefined;
}
