/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyChord, KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { IDisposable, DisposableStore } from 'vs/base/common/lifecycle';
import { ICodeEditor, IEditorMouseEvent, MouseTargetType } from 'vs/editor/browser/editorBrowser';
import { EditorAction, ServicesAccessor, registerEditorAction, registerEditorContribution } from 'vs/editor/browser/editorExtensions';
import { ConfigurationChangedEvent, EditorOption } from 'vs/editor/common/config/editorOptions';
import { Range } from 'vs/editor/common/core/range';
import { IEditorContribution, IScrollEvent } from 'vs/editor/common/editorCommon';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { IModeService } from 'vs/editor/common/services/modeService';
import { HoverStartMode } from 'vs/editor/contrib/hover/hoverOperation';
import { ModesContentHoverWidget } from 'vs/editor/contrib/hover/modesContentHover';
import { ModesGlyphHoverWidget } from 'vs/editor/contrib/hover/modesGlyphHover';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { editorHoverBackground, editorHoverBorder, editorHoverHighlight, textCodeBlockBackground, textLinkForeground, editorHoverStatusBarBackground, editorHoverForeground, textLinkActiveForeground } from 'vs/platform/theme/common/colorRegistry';
import { registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { AccessibilitySupport } from 'vs/platform/accessibility/common/accessibility';
import { GotoDefinitionAtPositionEditorContribution } from 'vs/editor/contrib/gotoSymbol/link/goToDefinitionAtPosition';
import { IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class ModesHoverController implements IEditorContribution {

	public static readonly ID = 'editor.contrib.hover';

	private readonly _toUnhook = new DisposableStore();
	private readonly _didChangeConfigurationHandler: IDisposable;

	private _contentWidget: ModesContentHoverWidget | null;
	private _glyphWidget: ModesGlyphHoverWidget | null;

	private _isMouseDown: boolean;
	private _hoverClicked: boolean;
	private _isHoverEnabled!: boolean;
	private _isHoverSticky!: boolean;

	private _hoverVisibleKey: IContextKey<boolean>;

	static get(editor: ICodeEditor): ModesHoverController {
		return editor.getContribution<ModesHoverController>(ModesHoverController.ID);
	}

	constructor(private readonly _editor: ICodeEditor,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IOpenerService private readonly _openerService: IOpenerService,
		@IModeService private readonly _modeService: IModeService,
		@IContextKeyService _contextKeyService: IContextKeyService
	) {
		this._isMouseDown = false;
		this._hoverClicked = false;
		this._contentWidget = null;
		this._glyphWidget = null;

		this._hookEvents();

		this._didChangeConfigurationHandler = this._editor.onDidChangeConfiguration((e: ConfigurationChangedEvent) => {
			if (e.hasChanged(EditorOption.hover)) {
				this._unhookEvents();
				this._hookEvents();
			}
		});

		this._hoverVisibleKey = EditorContextKeys.hoverVisible.bindTo(_contextKeyService);
	}

	private _hookEvents(): void {
		const hideWidgetsEventHandler = () => this._hideWidgets();

		const hoverOpts = this._editor.getOption(EditorOption.hover);
		this._isHoverEnabled = hoverOpts.enabled;
		this._isHoverSticky = hoverOpts.sticky;
		if (this._isHoverEnabled) {
			this._toUnhook.add(this._editor.onMouseDown((e: IEditorMouseEvent) => this._onEditorMouseDown(e)));
			this._toUnhook.add(this._editor.onMouseUp((e: IEditorMouseEvent) => this._onEditorMouseUp(e)));
			this._toUnhook.add(this._editor.onMouseMove((e: IEditorMouseEvent) => this._onEditorMouseMove(e)));
			this._toUnhook.add(this._editor.onKeyDown((e: IKeyboardEvent) => this._onKeyDown(e)));
			this._toUnhook.add(this._editor.onDidChangeModelDecorations(() => this._onModelDecorationsChanged()));
		} else {
			this._toUnhook.add(this._editor.onMouseMove((e: IEditorMouseEvent) => this._onEditorMouseMove(e)));
			this._toUnhook.add(this._editor.onKeyDown((e: IKeyboardEvent) => this._onKeyDown(e)));
		}

		this._toUnhook.add(this._editor.onMouseLeave(hideWidgetsEventHandler));
		this._toUnhook.add(this._editor.onDidChangeModel(hideWidgetsEventHandler));
		this._toUnhook.add(this._editor.onDidScrollChange((e: IScrollEvent) => this._onEditorScrollChanged(e)));
	}

	private _unhookEvents(): void {
		this._toUnhook.clear();
	}

	private _onModelDecorationsChanged(): void {
		this._contentWidget?.onModelDecorationsChanged();
		this._glyphWidget?.onModelDecorationsChanged();
	}

	private _onEditorScrollChanged(e: IScrollEvent): void {
		if (e.scrollTopChanged || e.scrollLeftChanged) {
			this._hideWidgets();
		}
	}

	private _onEditorMouseDown(mouseEvent: IEditorMouseEvent): void {
		this._isMouseDown = true;

		const targetType = mouseEvent.target.type;

		if (targetType === MouseTargetType.CONTENT_WIDGET && mouseEvent.target.detail === ModesContentHoverWidget.ID) {
			this._hoverClicked = true;
			// mouse down on top of content hover widget
			return;
		}

		if (targetType === MouseTargetType.OVERLAY_WIDGET && mouseEvent.target.detail === ModesGlyphHoverWidget.ID) {
			// mouse down on top of overlay hover widget
			return;
		}

		if (targetType !== MouseTargetType.OVERLAY_WIDGET && mouseEvent.target.detail !== ModesGlyphHoverWidget.ID) {
			this._hoverClicked = false;
		}

		this._hideWidgets();
	}

	private _onEditorMouseUp(mouseEvent: IEditorMouseEvent): void {
		this._isMouseDown = false;
	}

	private _onEditorMouseMove(mouseEvent: IEditorMouseEvent): void {
		let targetType = mouseEvent.target.type;

		if (this._isMouseDown && this._hoverClicked) {
			return;
		}

		if (this._isHoverSticky && targetType === MouseTargetType.CONTENT_WIDGET && mouseEvent.target.detail === ModesContentHoverWidget.ID) {
			// mouse moved on top of content hover widget
			return;
		}

		if (this._isHoverSticky && !mouseEvent.event.browserEvent.view?.getSelection()?.isCollapsed) {
			// selected text within content hover widget
			return;
		}

		if (
			!this._isHoverSticky && targetType === MouseTargetType.CONTENT_WIDGET && mouseEvent.target.detail === ModesContentHoverWidget.ID
			&& this._contentWidget?.isColorPickerVisible()
		) {
			// though the hover is not sticky, the color picker needs to.
			return;
		}

		if (this._isHoverSticky && targetType === MouseTargetType.OVERLAY_WIDGET && mouseEvent.target.detail === ModesGlyphHoverWidget.ID) {
			// mouse moved on top of overlay hover widget
			return;
		}

		if (!this._isHoverEnabled) {
			this._hideWidgets();
			return;
		}

		const contentWidget = this._getOrCreateContentWidget();
		if (contentWidget.maybeShowAt(mouseEvent)) {
			this._glyphWidget?.hide();
			return;
		}

		if (targetType === MouseTargetType.GUTTER_GLYPH_MARGIN && mouseEvent.target.position) {
			this._contentWidget?.hide();
			if (!this._glyphWidget) {
				this._glyphWidget = new ModesGlyphHoverWidget(this._editor, this._modeService, this._openerService);
			}
			this._glyphWidget.startShowingAt(mouseEvent.target.position.lineNumber);
			return;
		}

		this._hideWidgets();
	}

	private _onKeyDown(e: IKeyboardEvent): void {
		if (e.keyCode !== KeyCode.Ctrl && e.keyCode !== KeyCode.Alt && e.keyCode !== KeyCode.Meta && e.keyCode !== KeyCode.Shift) {
			// Do not hide hover when a modifier key is pressed
			this._hideWidgets();
		}
	}

	private _hideWidgets(): void {
		if ((this._isMouseDown && this._hoverClicked && this._contentWidget?.isColorPickerVisible())) {
			return;
		}

		this._hoverClicked = false;
		this._glyphWidget?.hide();
		this._contentWidget?.hide();
	}

	private _getOrCreateContentWidget(): ModesContentHoverWidget {
		if (!this._contentWidget) {
			this._contentWidget = this._instantiationService.createInstance(ModesContentHoverWidget, this._editor, this._hoverVisibleKey);
		}
		return this._contentWidget;
	}

	public isColorPickerVisible(): boolean {
		return this._contentWidget?.isColorPickerVisible() || false;
	}

	public showContentHover(range: Range, mode: HoverStartMode, focus: boolean): void {
		this._getOrCreateContentWidget().startShowingAtRange(range, mode, focus);
	}

	public dispose(): void {
		this._unhookEvents();
		this._toUnhook.dispose();
		this._didChangeConfigurationHandler.dispose();
		this._glyphWidget?.dispose();
		this._contentWidget?.dispose();
	}
}

class ShowHoverAction extends EditorAction {

	constructor() {
		super({
			id: 'editor.action.showHover',
			label: nls.localize({
				key: 'showHover',
				comment: [
					'Label for action that will trigger the showing of a hover in the editor.',
					'This allows for users to show the hover without using the mouse.'
				]
			}, "Show Hover"),
			alias: 'Show Hover',
			precondition: undefined,
			kbOpts: {
				kbExpr: EditorContextKeys.editorTextFocus,
				primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_I),
				weight: KeybindingWeight.EditorContrib
			}
		});
	}

	public run(accessor: ServicesAccessor, editor: ICodeEditor): void {
		if (!editor.hasModel()) {
			return;
		}
		let controller = ModesHoverController.get(editor);
		if (!controller) {
			return;
		}
		const position = editor.getPosition();
		const range = new Range(position.lineNumber, position.column, position.lineNumber, position.column);
		const focus = editor.getOption(EditorOption.accessibilitySupport) === AccessibilitySupport.Enabled;
		controller.showContentHover(range, HoverStartMode.Immediate, focus);
	}
}

class ShowDefinitionPreviewHoverAction extends EditorAction {

	constructor() {
		super({
			id: 'editor.action.showDefinitionPreviewHover',
			label: nls.localize({
				key: 'showDefinitionPreviewHover',
				comment: [
					'Label for action that will trigger the showing of definition preview hover in the editor.',
					'This allows for users to show the definition preview hover without using the mouse.'
				]
			}, "Show Definition Preview Hover"),
			alias: 'Show Definition Preview Hover',
			precondition: undefined
		});
	}

	public run(accessor: ServicesAccessor, editor: ICodeEditor): void {
		let controller = ModesHoverController.get(editor);
		if (!controller) {
			return;
		}
		const position = editor.getPosition();

		if (!position) {
			return;
		}

		const range = new Range(position.lineNumber, position.column, position.lineNumber, position.column);
		const goto = GotoDefinitionAtPositionEditorContribution.get(editor);
		const promise = goto.startFindDefinitionFromCursor(position);
		promise.then(() => {
			controller.showContentHover(range, HoverStartMode.Immediate, true);
		});
	}
}

registerEditorContribution(ModesHoverController.ID, ModesHoverController);
registerEditorAction(ShowHoverAction);
registerEditorAction(ShowDefinitionPreviewHoverAction);

// theming
registerThemingParticipant((theme, collector) => {
	const editorHoverHighlightColor = theme.getColor(editorHoverHighlight);
	if (editorHoverHighlightColor) {
		collector.addRule(`.monaco-editor .hoverHighlight { background-color: ${editorHoverHighlightColor}; }`);
	}
	const hoverBackground = theme.getColor(editorHoverBackground);
	if (hoverBackground) {
		collector.addRule(`.monaco-editor .monaco-hover { background-color: ${hoverBackground}; }`);
	}
	const hoverBorder = theme.getColor(editorHoverBorder);
	if (hoverBorder) {
		collector.addRule(`.monaco-editor .monaco-hover { border: 1px solid ${hoverBorder}; }`);
		collector.addRule(`.monaco-editor .monaco-hover .hover-row:not(:first-child):not(:empty) { border-top: 1px solid ${hoverBorder.transparent(0.5)}; }`);
		collector.addRule(`.monaco-editor .monaco-hover hr { border-top: 1px solid ${hoverBorder.transparent(0.5)}; }`);
		collector.addRule(`.monaco-editor .monaco-hover hr { border-bottom: 0px solid ${hoverBorder.transparent(0.5)}; }`);
	}
	const link = theme.getColor(textLinkForeground);
	if (link) {
		collector.addRule(`.monaco-editor .monaco-hover a { color: ${link}; }`);
	}
	const linkHover = theme.getColor(textLinkActiveForeground);
	if (linkHover) {
		collector.addRule(`.monaco-editor .monaco-hover a:hover { color: ${linkHover}; }`);
	}
	const hoverForeground = theme.getColor(editorHoverForeground);
	if (hoverForeground) {
		collector.addRule(`.monaco-editor .monaco-hover { color: ${hoverForeground}; }`);
	}
	const actionsBackground = theme.getColor(editorHoverStatusBarBackground);
	if (actionsBackground) {
		collector.addRule(`.monaco-editor .monaco-hover .hover-row .actions { background-color: ${actionsBackground}; }`);
	}
	const codeBackground = theme.getColor(textCodeBlockBackground);
	if (codeBackground) {
		collector.addRule(`.monaco-editor .monaco-hover code { background-color: ${codeBackground}; }`);
	}
});
