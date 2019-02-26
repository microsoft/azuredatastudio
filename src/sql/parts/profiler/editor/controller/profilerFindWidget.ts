/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!vs/editor/contrib/find/findWidget';

import * as nls from 'vs/nls';
import { onUnexpectedError } from 'vs/base/common/errors';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import * as platform from 'vs/base/common/platform';
import * as strings from 'vs/base/common/strings';
import * as dom from 'vs/base/browser/dom';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { FindInput, IFindInputStyles } from 'vs/base/browser/ui/findinput/findInput';
import { IMessage as InputBoxMessage } from 'vs/base/browser/ui/inputbox/inputBox';
import { Widget } from 'vs/base/browser/ui/widget';
import { Sash, IHorizontalSashLayoutProvider, ISashEvent, Orientation } from 'vs/base/browser/ui/sash/sash';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IOverlayWidget, IOverlayWidgetPosition, OverlayWidgetPositionPreference } from 'vs/editor/browser/editorBrowser';
import { FIND_IDS, CONTEXT_FIND_INPUT_FOCUSED } from 'vs/editor/contrib/find/findModel';
import { FindReplaceState, FindReplaceStateChangedEvent } from 'vs/editor/contrib/find/findState';
import { IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ITheme, registerThemingParticipant, IThemeService } from 'vs/platform/theme/common/themeService';
import { Color } from 'vs/base/common/color';
import { editorFindRangeHighlight, editorFindMatch, editorFindMatchHighlight, activeContrastBorder, contrastBorder, inputBackground, editorWidgetBackground, inputActiveOptionBorder, widgetShadow, inputForeground, inputBorder, inputValidationInfoBackground, inputValidationInfoBorder, inputValidationWarningBackground, inputValidationWarningBorder, inputValidationErrorBackground, inputValidationErrorBorder, errorForeground } from 'vs/platform/theme/common/colorRegistry';
import { IEditorAction } from 'vs/editor/common/editorCommon';
import { IDisposable } from 'vs/base/common/lifecycle';

const NLS_FIND_INPUT_LABEL = nls.localize('label.find', "Find");
const NLS_FIND_INPUT_PLACEHOLDER = nls.localize('placeholder.find', "Find");
const NLS_PREVIOUS_MATCH_BTN_LABEL = nls.localize('label.previousMatchButton', "Previous match");
const NLS_NEXT_MATCH_BTN_LABEL = nls.localize('label.nextMatchButton', "Next match");
const NLS_CLOSE_BTN_LABEL = nls.localize('label.closeButton', "Close");
const NLS_MATCHES_COUNT_LIMIT_TITLE = nls.localize('title.matchesCountLimit', "Your search returned a large number of results, only the first 999 matches will be highlighted.");
const NLS_MATCHES_LOCATION = nls.localize('label.matchesLocation', "{0} of {1}");
const NLS_NO_RESULTS = nls.localize('label.noResults', "No Results");

const FIND_WIDGET_INITIAL_WIDTH = 411;
const PART_WIDTH = 275;
const FIND_INPUT_AREA_WIDTH = PART_WIDTH - 54;

let MAX_MATCHES_COUNT_WIDTH = 69;

export const PROFILER_MAX_MATCHES = 999;

export const ACTION_IDS = {
	FIND_NEXT: 'findNext',
	FIND_PREVIOUS: 'findPrev'
};

export interface ITableController {
	focus(): void;
	getConfiguration(): any;
	layoutOverlayWidget(widget: IOverlayWidget): void;
	addOverlayWidget(widget: IOverlayWidget): void;
	getAction(id: string): IEditorAction;
	onDidChangeConfiguration(fn: (e: IConfigurationChangedEvent) => void): IDisposable;
}

export interface IConfigurationChangedEvent {
	layoutInfo?: boolean;
}

export class FindWidget extends Widget implements IOverlayWidget, IHorizontalSashLayoutProvider {
	private static ID = 'editor.contrib.findWidget';
	private _tableController: ITableController;
	private _state: FindReplaceState;
	private _contextViewProvider: IContextViewProvider;
	private _keybindingService: IKeybindingService;

	private _domNode: HTMLElement;
	private _findInput: FindInput;

	private _matchesCount: HTMLElement;
	private _prevBtn: SimpleButton;
	private _nextBtn: SimpleButton;
	private _closeBtn: SimpleButton;

	private _isVisible: boolean;

	private _focusTracker: dom.IFocusTracker;
	private _findInputFocussed: IContextKey<boolean>;

	private _resizeSash: Sash;

	private searchTimeoutHandle: NodeJS.Timer;

	constructor(
		tableController: ITableController,
		state: FindReplaceState,
		contextViewProvider: IContextViewProvider,
		keybindingService: IKeybindingService,
		contextKeyService: IContextKeyService,
		themeService: IThemeService
	) {
		super();
		this._tableController = tableController;
		this._state = state;
		this._contextViewProvider = contextViewProvider;
		this._keybindingService = keybindingService;

		this._isVisible = false;

		this._register(this._state.onFindReplaceStateChange((e) => this._onStateChanged(e)));
		this._buildDomNode();
		this._updateButtons();

		let checkEditorWidth = () => {
			let editorWidth = this._tableController.getConfiguration().layoutInfo.width;
			let collapsedFindWidget = false;
			let reducedFindWidget = false;
			let narrowFindWidget = false;
			let widgetWidth = dom.getTotalWidth(this._domNode);

			if (widgetWidth > FIND_WIDGET_INITIAL_WIDTH) {
				// as the widget is resized by users, we may need to change the max width of the widget as the editor width changes.
				this._domNode.style.maxWidth = `${editorWidth - 28 - 15}px`;
				return;
			}

			if (FIND_WIDGET_INITIAL_WIDTH + 28 >= editorWidth) {
				reducedFindWidget = true;
			}
			if (FIND_WIDGET_INITIAL_WIDTH + 28 - MAX_MATCHES_COUNT_WIDTH >= editorWidth) {
				narrowFindWidget = true;
			}
			if (FIND_WIDGET_INITIAL_WIDTH + 28 - MAX_MATCHES_COUNT_WIDTH >= editorWidth + 50) {
				collapsedFindWidget = true;
			}
			dom.toggleClass(this._domNode, 'collapsed-find-widget', collapsedFindWidget);
			dom.toggleClass(this._domNode, 'narrow-find-widget', narrowFindWidget);
			dom.toggleClass(this._domNode, 'reduced-find-widget', reducedFindWidget);

			if (!narrowFindWidget && !collapsedFindWidget) {
				// the minimal left offset of findwidget is 15px.
				this._domNode.style.maxWidth = `${editorWidth - 28 - 15}px`;
			}

		};
		checkEditorWidth();

		this._register(this._tableController.onDidChangeConfiguration((e: IConfigurationChangedEvent) => {
			if (e.layoutInfo) {
				checkEditorWidth();
			}
		}));

		this._findInputFocussed = CONTEXT_FIND_INPUT_FOCUSED.bindTo(contextKeyService);
		this._focusTracker = this._register(dom.trackFocus(this._findInput.inputBox.inputElement));
		this._focusTracker.onDidFocus(() => {
			this._findInputFocussed.set(true);
		});
		this._focusTracker.onDidBlur(() => {
			this._findInputFocussed.set(false);
		});

		this._tableController.addOverlayWidget(this);

		this._applyTheme(themeService.getTheme());
		this._register(themeService.onThemeChange(this._applyTheme.bind(this)));
	}

	// ----- IOverlayWidget API

	public getId(): string {
		return FindWidget.ID;
	}

	public getDomNode(): HTMLElement {
		return this._domNode;
	}

	public getPosition(): IOverlayWidgetPosition {
		if (this._isVisible) {
			return {
				preference: OverlayWidgetPositionPreference.TOP_RIGHT_CORNER
			};
		}
		return null;
	}

	// ----- React to state changes

	private _onStateChanged(e: FindReplaceStateChangedEvent): void {
		if (e.searchString) {
			this._findInput.setValue(this._state.searchString);
			this._updateButtons();
		}
		if (e.isRevealed) {
			if (this._state.isRevealed) {
				this._reveal(true);
			} else {
				this._hide(true);
			}
		}
		if (e.isRegex) {
			this._findInput.setRegex(this._state.isRegex);
		}
		if (e.wholeWord) {
			this._findInput.setWholeWords(this._state.wholeWord);
		}
		if (e.matchCase) {
			this._findInput.setCaseSensitive(this._state.matchCase);
		}
		if (e.searchString || e.matchesCount || e.matchesPosition) {
			let showRedOutline = (this._state.searchString.length > 0 && this._state.matchesCount === 0);
			dom.toggleClass(this._domNode, 'no-results', showRedOutline);

			this._updateMatchesCount();
		}
	}

	private _updateMatchesCount(): void {
		this._matchesCount.style.minWidth = MAX_MATCHES_COUNT_WIDTH + 'px';
		if (this._state.matchesCount >= PROFILER_MAX_MATCHES) {
			this._matchesCount.title = NLS_MATCHES_COUNT_LIMIT_TITLE;
		} else {
			this._matchesCount.title = '';
		}

		// remove previous content
		if (this._matchesCount.firstChild) {
			this._matchesCount.removeChild(this._matchesCount.firstChild);
		}

		let label: string;
		if (this._state.matchesCount > 0) {
			let matchesCount: string = String(this._state.matchesCount);
			if (this._state.matchesCount >= PROFILER_MAX_MATCHES) {
				matchesCount = PROFILER_MAX_MATCHES + '+';
			}
			let matchesPosition: string = String(this._state.matchesPosition);
			if (matchesPosition === '0') {
				matchesPosition = '?';
			}
			label = strings.format(NLS_MATCHES_LOCATION, matchesPosition, matchesCount);
		} else {
			label = NLS_NO_RESULTS;
		}
		this._matchesCount.appendChild(document.createTextNode(label));

		MAX_MATCHES_COUNT_WIDTH = Math.max(MAX_MATCHES_COUNT_WIDTH, this._matchesCount.clientWidth);
	}

	// ----- actions

	private _updateButtons(): void {
		this._findInput.setEnabled(this._isVisible);
		this._closeBtn.setEnabled(this._isVisible);

		let findInputIsNonEmpty = (this._state.searchString.length > 0);
		this._prevBtn.setEnabled(this._isVisible && findInputIsNonEmpty);
		this._nextBtn.setEnabled(this._isVisible && findInputIsNonEmpty);
	}

	private _reveal(animate: boolean): void {
		if (!this._isVisible) {
			this._isVisible = true;

			this._updateButtons();

			setTimeout(() => {
				dom.addClass(this._domNode, 'visible');
				this._domNode.setAttribute('aria-hidden', 'false');
				if (!animate) {
					dom.addClass(this._domNode, 'noanimation');
					setTimeout(() => {
						dom.removeClass(this._domNode, 'noanimation');
					}, 200);
				}
			}, 0);
			this._tableController.layoutOverlayWidget(this);
		}
	}

	private _hide(focusTheEditor: boolean): void {
		if (this._isVisible) {
			this._isVisible = false;

			this._updateButtons();

			dom.removeClass(this._domNode, 'visible');
			this._domNode.setAttribute('aria-hidden', 'true');
			if (focusTheEditor) {
				this._tableController.focus();
			}
			this._tableController.layoutOverlayWidget(this);
		}
	}

	private _applyTheme(theme: ITheme) {
		let inputStyles: IFindInputStyles = {
			inputActiveOptionBorder: theme.getColor(inputActiveOptionBorder),
			inputBackground: theme.getColor(inputBackground),
			inputForeground: theme.getColor(inputForeground),
			inputBorder: theme.getColor(inputBorder),
			inputValidationInfoBackground: theme.getColor(inputValidationInfoBackground),
			inputValidationInfoBorder: theme.getColor(inputValidationInfoBorder),
			inputValidationWarningBackground: theme.getColor(inputValidationWarningBackground),
			inputValidationWarningBorder: theme.getColor(inputValidationWarningBorder),
			inputValidationErrorBackground: theme.getColor(inputValidationErrorBackground),
			inputValidationErrorBorder: theme.getColor(inputValidationErrorBorder)
		};
		this._findInput.style(inputStyles);
	}

	// ----- Public

	public focusFindInput(): void {
		this._findInput.focus();
	}

	public highlightFindOptions(): void {
		this._findInput.highlightFindOptions();
	}

	private _onFindInputMouseDown(e: IMouseEvent): void {
		// on linux, middle key does pasting.
		if (e.middleButton) {
			e.stopPropagation();
		}
	}

	private _onFindInputKeyDown(e: IKeyboardEvent): void {

		if (e.equals(KeyCode.Enter)) {
			this._tableController.getAction(ACTION_IDS.FIND_NEXT).run().then(null, onUnexpectedError);
			e.preventDefault();
			return;
		}

		if (e.equals(KeyMod.Shift | KeyCode.Enter)) {
			this._tableController.getAction(ACTION_IDS.FIND_NEXT).run().then(null, onUnexpectedError);
			e.preventDefault();
			return;
		}

		if (e.equals(KeyCode.Tab)) {
			this._findInput.focusOnCaseSensitive();
			e.preventDefault();
			return;
		}

		if (e.equals(KeyMod.CtrlCmd | KeyCode.DownArrow)) {
			this._tableController.focus();
			e.preventDefault();
			return;
		}
	}

	// ----- sash
	public getHorizontalSashTop(sash: Sash): number {
		return 0;
	}
	public getHorizontalSashLeft?(sash: Sash): number {
		return 0;
	}
	public getHorizontalSashWidth?(sash: Sash): number {
		return 500;
	}

	// ----- initialization

	private _keybindingLabelFor(actionId: string): string {
		let kb = this._keybindingService.lookupKeybinding(actionId);
		if (!kb) {
			return '';
		}
		return ` (${kb.getLabel()})`;
	}

	private _buildFindPart(): HTMLElement {
		// Find input
		this._findInput = this._register(new FindInput(null, this._contextViewProvider, true, {
			width: FIND_INPUT_AREA_WIDTH,
			label: NLS_FIND_INPUT_LABEL,
			placeholder: NLS_FIND_INPUT_PLACEHOLDER,
			appendCaseSensitiveLabel: this._keybindingLabelFor(FIND_IDS.ToggleCaseSensitiveCommand),
			appendWholeWordsLabel: this._keybindingLabelFor(FIND_IDS.ToggleWholeWordCommand),
			appendRegexLabel: this._keybindingLabelFor(FIND_IDS.ToggleRegexCommand),
			validation: (value: string): InputBoxMessage => {
				if (value.length === 0) {
					return null;
				}
				if (!this._findInput.getRegex()) {
					return null;
				}
				try {
					/* tslint:disable:no-unused-expression */
					new RegExp(value);
					/* tslint:enable:no-unused-expression */
					return null;
				} catch (e) {
					return { content: e.message };
				}
			}
		}));
		this._findInput.setRegex(!!this._state.isRegex);
		this._findInput.setCaseSensitive(!!this._state.matchCase);
		this._findInput.setWholeWords(!!this._state.wholeWord);
		this._register(this._findInput.onKeyDown((e) => this._onFindInputKeyDown(e)));
		this._register(this._findInput.onInput(() => {
			let self = this;
			if (self.searchTimeoutHandle) {
				clearTimeout(self.searchTimeoutHandle);
			}

			this.searchTimeoutHandle = setTimeout(function () {
				self._state.change({ searchString: self._findInput.getValue() }, true);
			}, 300);
		}));
		this._register(this._findInput.onDidOptionChange(() => {
			this._state.change({
				isRegex: this._findInput.getRegex(),
				wholeWord: this._findInput.getWholeWords(),
				matchCase: this._findInput.getCaseSensitive()
			}, true);
		}));
		if (platform.isLinux) {
			this._register(this._findInput.onMouseDown((e) => this._onFindInputMouseDown(e)));
		}

		this._matchesCount = document.createElement('div');
		this._matchesCount.className = 'matchesCount';
		this._updateMatchesCount();

		// Previous button
		this._prevBtn = this._register(new SimpleButton({
			label: NLS_PREVIOUS_MATCH_BTN_LABEL + this._keybindingLabelFor(FIND_IDS.PreviousMatchFindAction),
			className: 'previous',
			onTrigger: () => {
				this._tableController.getAction(ACTION_IDS.FIND_PREVIOUS).run().then(null, onUnexpectedError);
			},
			onKeyDown: (e) => { }
		}));

		// Next button
		this._nextBtn = this._register(new SimpleButton({
			label: NLS_NEXT_MATCH_BTN_LABEL + this._keybindingLabelFor(FIND_IDS.NextMatchFindAction),
			className: 'next',
			onTrigger: () => {
				this._tableController.getAction(ACTION_IDS.FIND_NEXT).run().then(null, onUnexpectedError);
			},
			onKeyDown: (e) => { }
		}));

		let findPart = document.createElement('div');
		findPart.className = 'find-part';
		findPart.appendChild(this._findInput.domNode);
		findPart.appendChild(this._matchesCount);
		findPart.appendChild(this._prevBtn.domNode);
		findPart.appendChild(this._nextBtn.domNode);

		// Close button
		this._closeBtn = this._register(new SimpleButton({
			label: NLS_CLOSE_BTN_LABEL + this._keybindingLabelFor(FIND_IDS.CloseFindWidgetCommand),
			className: 'close-fw',
			onTrigger: () => {
				this._state.change({ isRevealed: false, searchScope: null }, false);
			},
			onKeyDown: () => { }
		}));

		findPart.appendChild(this._closeBtn.domNode);

		return findPart;
	}

	private _buildDomNode(): void {
		// Find part
		let findPart = this._buildFindPart();

		// Widget
		this._domNode = document.createElement('div');
		this._domNode.className = 'editor-widget find-widget';
		this._domNode.setAttribute('aria-hidden', 'true');

		this._domNode.appendChild(findPart);

		this._buildSash();
	}

	private _buildSash() {
		this._resizeSash = new Sash(this._domNode, this, { orientation: Orientation.VERTICAL });
		let originalWidth = FIND_WIDGET_INITIAL_WIDTH;

		this._register(this._resizeSash.onDidStart((e: ISashEvent) => {
			originalWidth = dom.getTotalWidth(this._domNode);
		}));

		this._register(this._resizeSash.onDidChange((evt: ISashEvent) => {
			let width = originalWidth + evt.startX - evt.currentX;

			if (width < FIND_WIDGET_INITIAL_WIDTH) {
				// narrow down the find widget should be handled by CSS.
				return;
			}

			let maxWidth = parseFloat(dom.getComputedStyle(this._domNode).maxWidth) || 0;
			if (width > maxWidth) {
				return;
			}
			this._domNode.style.width = `${width}px`;
		}));
	}
}

interface ISimpleCheckboxOpts {
	parent: HTMLElement;
	title: string;
	onChange: () => void;
}

class SimpleCheckbox extends Widget {

	private static _COUNTER = 0;

	private _opts: ISimpleCheckboxOpts;
	private _domNode: HTMLElement;
	private _checkbox: HTMLInputElement;
	private _label: HTMLLabelElement;

	constructor(opts: ISimpleCheckboxOpts) {
		super();
		this._opts = opts;

		this._domNode = document.createElement('div');
		this._domNode.className = 'monaco-checkbox';
		this._domNode.title = this._opts.title;
		this._domNode.tabIndex = 0;

		this._checkbox = document.createElement('input');
		this._checkbox.type = 'checkbox';
		this._checkbox.className = 'checkbox';
		this._checkbox.id = 'checkbox-' + SimpleCheckbox._COUNTER++;
		this._checkbox.tabIndex = -1;

		this._label = document.createElement('label');
		this._label.className = 'label';
		// Connect the label and the checkbox. Checkbox will get checked when the label recieves a click.
		this._label.htmlFor = this._checkbox.id;
		this._label.tabIndex = -1;

		this._domNode.appendChild(this._checkbox);
		this._domNode.appendChild(this._label);

		this._opts.parent.appendChild(this._domNode);

		this.onchange(this._checkbox, (e) => {
			this._opts.onChange();
		});
	}

	public get domNode(): HTMLElement {
		return this._domNode;
	}

	public get checked(): boolean {
		return this._checkbox.checked;
	}

	public set checked(newValue: boolean) {
		this._checkbox.checked = newValue;
	}

	public focus(): void {
		this._checkbox.focus();
	}

	private enable(): void {
		this._checkbox.removeAttribute('disabled');
	}

	private disable(): void {
		this._checkbox.disabled = true;
	}

	public setEnabled(enabled: boolean): void {
		if (enabled) {
			this.enable();
			this.domNode.tabIndex = 0;
		} else {
			this.disable();
			this.domNode.tabIndex = -1;
		}
	}
}

interface ISimpleButtonOpts {
	label: string;
	className: string;
	onTrigger: () => void;
	onKeyDown: (e: IKeyboardEvent) => void;
}

class SimpleButton extends Widget {

	private _opts: ISimpleButtonOpts;
	private _domNode: HTMLElement;

	constructor(opts: ISimpleButtonOpts) {
		super();
		this._opts = opts;

		this._domNode = document.createElement('div');
		this._domNode.title = this._opts.label;
		this._domNode.tabIndex = 0;
		this._domNode.className = 'button ' + this._opts.className;
		this._domNode.setAttribute('role', 'button');
		this._domNode.setAttribute('aria-label', this._opts.label);

		this.onclick(this._domNode, (e) => {
			this._opts.onTrigger();
			e.preventDefault();
		});
		this.onkeydown(this._domNode, (e) => {
			if (e.equals(KeyCode.Space) || e.equals(KeyCode.Enter)) {
				this._opts.onTrigger();
				e.preventDefault();
				return;
			}
			this._opts.onKeyDown(e);
		});
	}

	public get domNode(): HTMLElement {
		return this._domNode;
	}

	public isEnabled(): boolean {
		return (this._domNode.tabIndex >= 0);
	}

	public focus(): void {
		this._domNode.focus();
	}

	public setEnabled(enabled: boolean): void {
		dom.toggleClass(this._domNode, 'disabled', !enabled);
		this._domNode.setAttribute('aria-disabled', String(!enabled));
		this._domNode.tabIndex = enabled ? 0 : -1;
	}

	public setExpanded(expanded: boolean): void {
		this._domNode.setAttribute('aria-expanded', String(!!expanded));
	}

	public toggleClass(className: string, shouldHaveIt: boolean): void {
		dom.toggleClass(this._domNode, className, shouldHaveIt);
	}
}
