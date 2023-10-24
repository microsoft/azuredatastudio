/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore, toDisposable } from 'vs/base/common/lifecycle';
import { IActiveCodeEditor, ICodeEditor, MouseTargetType } from 'vs/editor/browser/editorBrowser';
import { IEditorContribution, ScrollType } from 'vs/editor/common/editorCommon';
import { ILanguageFeaturesService } from 'vs/editor/common/services/languageFeatures';
import { EditorOption, RenderLineNumbersType } from 'vs/editor/common/config/editorOptions';
import { StickyScrollWidget, StickyScrollWidgetState } from './stickyScrollWidget';
import { IStickyLineCandidateProvider, StickyLineCandidateProvider } from './stickyScrollProvider';
import { IModelTokensChangedEvent } from 'vs/editor/common/textModelEvents';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { MenuId } from 'vs/platform/actions/common/actions';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { ClickLinkGesture, ClickLinkMouseEvent } from 'vs/editor/contrib/gotoSymbol/browser/link/clickLinkGesture';
import { IRange, Range } from 'vs/editor/common/core/range';
import { getDefinitionsAtPosition } from 'vs/editor/contrib/gotoSymbol/browser/goToSymbol';
import { goToDefinitionWithLocation } from 'vs/editor/contrib/inlayHints/browser/inlayHintsLocations';
import { IPosition, Position } from 'vs/editor/common/core/position';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { ILanguageConfigurationService } from 'vs/editor/common/languages/languageConfigurationRegistry';
import { ILanguageFeatureDebounceService } from 'vs/editor/common/services/languageFeatureDebounce';
import * as dom from 'vs/base/browser/dom';
import { StickyRange } from 'vs/editor/contrib/stickyScroll/browser/stickyScrollElement';
import { IMouseEvent, StandardMouseEvent } from 'vs/base/browser/mouseEvent';

export interface IStickyScrollController {
	get stickyScrollCandidateProvider(): IStickyLineCandidateProvider;
	get stickyScrollWidgetState(): StickyScrollWidgetState;
	focus(): void;
	focusNext(): void;
	focusPrevious(): void;
	goToFocused(): void;
	findScrollWidgetState(): StickyScrollWidgetState;
	dispose(): void;
	selectEditor(): void;
}

export class StickyScrollController extends Disposable implements IEditorContribution, IStickyScrollController {

	static readonly ID = 'store.contrib.stickyScrollController';

	private readonly _stickyScrollWidget: StickyScrollWidget;
	private readonly _stickyLineCandidateProvider: IStickyLineCandidateProvider;
	private readonly _sessionStore: DisposableStore = new DisposableStore();

	private _widgetState: StickyScrollWidgetState;
	private _maxStickyLines: number = Number.MAX_SAFE_INTEGER;

	private _stickyRangeProjectedOnEditor: IRange | undefined;
	private _candidateDefinitionsLength: number = -1;

	private _stickyScrollFocusedContextKey: IContextKey<boolean>;
	private _stickyScrollVisibleContextKey: IContextKey<boolean>;

	private _focusDisposableStore: DisposableStore | undefined;
	private _focusedStickyElementIndex: number = -1;
	private _enabled = false;
	private _focused = false;
	private _positionRevealed = false;
	private _onMouseDown = false;
	private _endLineNumbers: number[] = [];
	private _showEndForLine: number | null = null;

	constructor(
		private readonly _editor: ICodeEditor,
		@IContextMenuService private readonly _contextMenuService: IContextMenuService,
		@ILanguageFeaturesService private readonly _languageFeaturesService: ILanguageFeaturesService,
		@IInstantiationService private readonly _instaService: IInstantiationService,
		@ILanguageConfigurationService _languageConfigurationService: ILanguageConfigurationService,
		@ILanguageFeatureDebounceService _languageFeatureDebounceService: ILanguageFeatureDebounceService,
		@IContextKeyService private readonly _contextKeyService: IContextKeyService
	) {
		super();
		this._stickyScrollWidget = new StickyScrollWidget(this._editor);
		this._stickyLineCandidateProvider = new StickyLineCandidateProvider(this._editor, _languageFeaturesService, _languageConfigurationService);
		this._register(this._stickyScrollWidget);
		this._register(this._stickyLineCandidateProvider);

		this._widgetState = new StickyScrollWidgetState([], [], 0);
		this._readConfiguration();
		const stickyScrollDomNode = this._stickyScrollWidget.getDomNode();
		this._register(this._editor.onDidChangeConfiguration(e => {
			if (
				e.hasChanged(EditorOption.stickyScroll)
				|| e.hasChanged(EditorOption.minimap)
				|| e.hasChanged(EditorOption.lineHeight)
				|| e.hasChanged(EditorOption.showFoldingControls)
			) {
				this._readConfiguration();
			}
		}));
		this._register(dom.addDisposableListener(stickyScrollDomNode, dom.EventType.CONTEXT_MENU, async (event: MouseEvent) => {
			this._onContextMenu(event);
		}));
		this._stickyScrollFocusedContextKey = EditorContextKeys.stickyScrollFocused.bindTo(this._contextKeyService);
		this._stickyScrollVisibleContextKey = EditorContextKeys.stickyScrollVisible.bindTo(this._contextKeyService);
		const focusTracker = this._register(dom.trackFocus(stickyScrollDomNode));
		this._register(focusTracker.onDidBlur(_ => {
			// Suppose that the blurring is caused by scrolling, then keep the focus on the sticky scroll
			// This is determined by the fact that the height of the widget has become zero and there has been no position revealing
			if (this._positionRevealed === false && stickyScrollDomNode.clientHeight === 0) {
				this._focusedStickyElementIndex = -1;
				this.focus();

			}
			// In all other casees, dispose the focus on the sticky scroll
			else {
				this._disposeFocusStickyScrollStore();
			}
		}));
		this._register(focusTracker.onDidFocus(_ => {
			this.focus();
		}));
		this._registerMouseListeners();
		// Suppose that mouse down on the sticky scroll, then do not focus on the sticky scroll because this will be followed by the revealing of a position
		this._register(dom.addDisposableListener(stickyScrollDomNode, dom.EventType.MOUSE_DOWN, (e) => {
			this._onMouseDown = true;
		}));
	}

	get stickyScrollCandidateProvider(): IStickyLineCandidateProvider {
		return this._stickyLineCandidateProvider;
	}

	get stickyScrollWidgetState(): StickyScrollWidgetState {
		return this._widgetState;
	}

	public static get(editor: ICodeEditor): IStickyScrollController | null {
		return editor.getContribution<StickyScrollController>(StickyScrollController.ID);
	}

	private _disposeFocusStickyScrollStore() {
		this._stickyScrollFocusedContextKey.set(false);
		this._focusDisposableStore?.dispose();
		this._focused = false;
		this._positionRevealed = false;
		this._onMouseDown = false;
	}

	public focus(): void {
		// If the mouse is down, do not focus on the sticky scroll
		if (this._onMouseDown) {
			this._onMouseDown = false;
			this._editor.focus();
			return;
		}
		const focusState = this._stickyScrollFocusedContextKey.get();
		if (focusState === true) {
			return;
		}
		this._focused = true;
		this._focusDisposableStore = new DisposableStore();
		this._stickyScrollFocusedContextKey.set(true);
		this._focusedStickyElementIndex = this._stickyScrollWidget.lineNumbers.length - 1;
		this._stickyScrollWidget.focusLineWithIndex(this._focusedStickyElementIndex);
	}

	public focusNext(): void {
		if (this._focusedStickyElementIndex < this._stickyScrollWidget.lineNumberCount - 1) {
			this._focusNav(true);
		}
	}

	public focusPrevious(): void {
		if (this._focusedStickyElementIndex > 0) {
			this._focusNav(false);
		}
	}

	public selectEditor(): void {
		this._editor.focus();
	}

	// True is next, false is previous
	private _focusNav(direction: boolean): void {
		this._focusedStickyElementIndex = direction ? this._focusedStickyElementIndex + 1 : this._focusedStickyElementIndex - 1;
		this._stickyScrollWidget.focusLineWithIndex(this._focusedStickyElementIndex);
	}

	public goToFocused(): void {
		const lineNumbers = this._stickyScrollWidget.lineNumbers;
		this._disposeFocusStickyScrollStore();
		this._revealPosition({ lineNumber: lineNumbers[this._focusedStickyElementIndex], column: 1 });
	}

	private _revealPosition(position: IPosition): void {
		this._reveaInEditor(position, () => this._editor.revealPosition(position));
	}

	private _revealLineInCenterIfOutsideViewport(position: IPosition): void {
		this._reveaInEditor(position, () => this._editor.revealLineInCenterIfOutsideViewport(position.lineNumber, ScrollType.Smooth));
	}

	private _reveaInEditor(position: IPosition, revealFunction: () => void): void {
		if (this._focused) {
			this._disposeFocusStickyScrollStore();
		}
		this._positionRevealed = true;
		revealFunction();
		this._editor.setSelection(Range.fromPositions(position));
		this._editor.focus();
	}

	private _registerMouseListeners(): void {

		const sessionStore = this._register(new DisposableStore());
		const gesture = this._register(new ClickLinkGesture(this._editor, {
			extractLineNumberFromMouseEvent: (e) => {
				const position = this._stickyScrollWidget.getEditorPositionFromNode(e.target.element);
				return position ? position.lineNumber : 0;
			}
		}));

		const getMouseEventTarget = (mouseEvent: ClickLinkMouseEvent): { range: Range; textElement: HTMLElement } | null => {
			if (!this._editor.hasModel()) {
				return null;
			}
			if (mouseEvent.target.type !== MouseTargetType.OVERLAY_WIDGET || mouseEvent.target.detail !== this._stickyScrollWidget.getId()) {
				// not hovering over our widget
				return null;
			}
			const mouseTargetElement = mouseEvent.target.element;
			if (!mouseTargetElement || mouseTargetElement.innerText !== mouseTargetElement.innerHTML) {
				// not on a span element rendering text
				return null;
			}
			const position = this._stickyScrollWidget.getEditorPositionFromNode(mouseTargetElement);
			if (!position) {
				// not hovering a sticky scroll line
				return null;
			}
			return {
				range: new Range(position.lineNumber, position.column, position.lineNumber, position.column + mouseTargetElement.innerText.length),
				textElement: mouseTargetElement
			};
		};

		const stickyScrollWidgetDomNode = this._stickyScrollWidget.getDomNode();
		this._register(dom.addStandardDisposableListener(stickyScrollWidgetDomNode, dom.EventType.CLICK, (mouseEvent: IMouseEvent) => {
			if (mouseEvent.ctrlKey || mouseEvent.altKey || mouseEvent.metaKey) {
				// modifier pressed
				return;
			}
			if (!mouseEvent.leftButton) {
				// not left click
				return;
			}
			if (mouseEvent.shiftKey) {
				// shift click
				const lineIndex = this._stickyScrollWidget.getStickyLineIndexFromChildDomNode(mouseEvent.target);
				if (lineIndex === null) {
					return;
				}
				const position = new Position(this._endLineNumbers[lineIndex], 1);
				this._revealLineInCenterIfOutsideViewport(position);
				return;
			}
			// normal click
			let position = this._stickyScrollWidget.getEditorPositionFromNode(mouseEvent.target);
			if (!position) {
				const lineNumber = this._stickyScrollWidget.getLineNumberFromChildDomNode(mouseEvent.target);
				if (lineNumber === null) {
					// not hovering a sticky scroll line
					return;
				}
				position = new Position(lineNumber, 1);
			}
			this._revealPosition(position);
		}));
		this._register(dom.addStandardDisposableListener(stickyScrollWidgetDomNode, dom.EventType.MOUSE_MOVE, (mouseEvent: IMouseEvent) => {
			if (mouseEvent.shiftKey) {
				const currentEndForLineIndex = this._stickyScrollWidget.getStickyLineIndexFromChildDomNode(mouseEvent.target);
				if (currentEndForLineIndex === null || this._showEndForLine !== null && this._showEndForLine === currentEndForLineIndex) {
					return;
				}
				this._showEndForLine = currentEndForLineIndex;
				this._renderStickyScroll();
				return;
			}
			if (this._showEndForLine !== null) {
				this._showEndForLine = null;
				this._renderStickyScroll();
			}
		}));
		this._register(dom.addDisposableListener(stickyScrollWidgetDomNode, dom.EventType.MOUSE_LEAVE, (e) => {
			if (this._showEndForLine !== null) {
				this._showEndForLine = null;
				this._renderStickyScroll();
			}
		}));

		this._register(gesture.onMouseMoveOrRelevantKeyDown(([mouseEvent, _keyboardEvent]) => {
			const mouseTarget = getMouseEventTarget(mouseEvent);
			if (!mouseTarget || !mouseEvent.hasTriggerModifier || !this._editor.hasModel()) {
				sessionStore.clear();
				return;
			}
			const { range, textElement } = mouseTarget;

			if (!range.equalsRange(this._stickyRangeProjectedOnEditor)) {
				this._stickyRangeProjectedOnEditor = range;
				sessionStore.clear();
			} else if (textElement.style.textDecoration === 'underline') {
				return;
			}

			const cancellationToken = new CancellationTokenSource();
			sessionStore.add(toDisposable(() => cancellationToken.dispose(true)));

			let currentHTMLChild: HTMLElement;

			getDefinitionsAtPosition(this._languageFeaturesService.definitionProvider, this._editor.getModel(), new Position(range.startLineNumber, range.startColumn + 1), cancellationToken.token).then((candidateDefinitions => {
				if (cancellationToken.token.isCancellationRequested) {
					return;
				}
				if (candidateDefinitions.length !== 0) {
					this._candidateDefinitionsLength = candidateDefinitions.length;
					const childHTML: HTMLElement = textElement;
					if (currentHTMLChild !== childHTML) {
						sessionStore.clear();
						currentHTMLChild = childHTML;
						currentHTMLChild.style.textDecoration = 'underline';
						sessionStore.add(toDisposable(() => {
							currentHTMLChild.style.textDecoration = 'none';
						}));
					} else if (!currentHTMLChild) {
						currentHTMLChild = childHTML;
						currentHTMLChild.style.textDecoration = 'underline';
						sessionStore.add(toDisposable(() => {
							currentHTMLChild.style.textDecoration = 'none';
						}));
					}
				} else {
					sessionStore.clear();
				}
			}));
		}));
		this._register(gesture.onCancel(() => {
			sessionStore.clear();
		}));
		this._register(gesture.onExecute(async e => {
			if (e.target.type !== MouseTargetType.OVERLAY_WIDGET || e.target.detail !== this._stickyScrollWidget.getId()) {
				// not hovering over our widget
				return;
			}
			const position = this._stickyScrollWidget.getEditorPositionFromNode(e.target.element);
			if (!position) {
				// not hovering a sticky scroll line
				return;
			}
			if (this._candidateDefinitionsLength > 1) {
				if (this._focused) {
					this._disposeFocusStickyScrollStore();
				}
				this._revealPosition({ lineNumber: position.lineNumber, column: 1 });
			}
			this._instaService.invokeFunction(goToDefinitionWithLocation, e, this._editor as IActiveCodeEditor, { uri: this._editor.getModel()!.uri, range: this._stickyRangeProjectedOnEditor! });
		}));
	}

	private _onContextMenu(e: MouseEvent) {
		const event = new StandardMouseEvent(e);

		this._contextMenuService.showContextMenu({
			menuId: MenuId.StickyScrollContext,
			getAnchor: () => event,
		});
	}

	private _readConfiguration() {
		const options = this._editor.getOption(EditorOption.stickyScroll);
		if (options.enabled === false) {
			this._editor.removeOverlayWidget(this._stickyScrollWidget);
			this._sessionStore.clear();
			this._enabled = false;
			return;
		} else if (options.enabled && !this._enabled) {
			// When sticky scroll was just enabled, add the listeners on the sticky scroll
			this._editor.addOverlayWidget(this._stickyScrollWidget);
			this._sessionStore.add(this._editor.onDidScrollChange((e) => {
				if (e.scrollTopChanged) {
					this._showEndForLine = null;
					this._renderStickyScroll();
				}
			}));
			this._sessionStore.add(this._editor.onDidLayoutChange(() => this._onDidResize()));
			this._sessionStore.add(this._editor.onDidChangeModelTokens((e) => this._onTokensChange(e)));
			this._sessionStore.add(this._stickyLineCandidateProvider.onDidChangeStickyScroll(() => {
				this._showEndForLine = null;
				this._renderStickyScroll();
			}));
			this._enabled = true;
		}

		const lineNumberOption = this._editor.getOption(EditorOption.lineNumbers);
		if (lineNumberOption.renderType === RenderLineNumbersType.Relative) {
			this._sessionStore.add(this._editor.onDidChangeCursorPosition(() => {
				this._showEndForLine = null;
				this._renderStickyScroll();
			}));
		}
	}

	private _needsUpdate(event: IModelTokensChangedEvent) {
		const stickyLineNumbers = this._stickyScrollWidget.getCurrentLines();
		for (const stickyLineNumber of stickyLineNumbers) {
			for (const range of event.ranges) {
				if (stickyLineNumber >= range.fromLineNumber && stickyLineNumber <= range.toLineNumber) {
					return true;
				}
			}
		}
		return false;
	}

	private _onTokensChange(event: IModelTokensChangedEvent) {
		if (this._needsUpdate(event)) {
			this._renderStickyScroll();
		}
	}

	private _onDidResize() {
		const layoutInfo = this._editor.getLayoutInfo();
		// Make sure sticky scroll doesn't take up more than 25% of the editor
		const theoreticalLines = layoutInfo.height / this._editor.getOption(EditorOption.lineHeight);
		this._maxStickyLines = Math.round(theoreticalLines * .25);
	}

	private _renderStickyScroll() {
		const model = this._editor.getModel();
		if (!model || model.isTooLargeForTokenization()) {
			this._stickyScrollWidget.setState(undefined);
			return;
		}
		const stickyLineVersion = this._stickyLineCandidateProvider.getVersionId();
		if (stickyLineVersion === undefined || stickyLineVersion === model.getVersionId()) {
			this._widgetState = this.findScrollWidgetState();
			this._stickyScrollVisibleContextKey.set(!(this._widgetState.startLineNumbers.length === 0));

			if (!this._focused) {
				this._stickyScrollWidget.setState(this._widgetState);
			} else {
				// Suppose that previously the sticky scroll widget had height 0, then if there are visible lines, set the last line as focused
				if (this._focusedStickyElementIndex === -1) {
					this._stickyScrollWidget.setState(this._widgetState);
					this._focusedStickyElementIndex = this._stickyScrollWidget.lineNumberCount - 1;
					if (this._focusedStickyElementIndex !== -1) {
						this._stickyScrollWidget.focusLineWithIndex(this._focusedStickyElementIndex);
					}
				} else {
					const focusedStickyElementLineNumber = this._stickyScrollWidget.lineNumbers[this._focusedStickyElementIndex];
					this._stickyScrollWidget.setState(this._widgetState);
					// Suppose that after setting the state, there are no sticky lines, set the focused index to -1
					if (this._stickyScrollWidget.lineNumberCount === 0) {
						this._focusedStickyElementIndex = -1;
					} else {
						const previousFocusedLineNumberExists = this._stickyScrollWidget.lineNumbers.includes(focusedStickyElementLineNumber);

						// If the line number is still there, do not change anything
						// If the line number is not there, set the new focused line to be the last line
						if (!previousFocusedLineNumberExists) {
							this._focusedStickyElementIndex = this._stickyScrollWidget.lineNumberCount - 1;
						}
						this._stickyScrollWidget.focusLineWithIndex(this._focusedStickyElementIndex);
					}
				}
			}
		}
	}

	findScrollWidgetState(): StickyScrollWidgetState {
		const lineHeight: number = this._editor.getOption(EditorOption.lineHeight);
		const maxNumberStickyLines = Math.min(this._maxStickyLines, this._editor.getOption(EditorOption.stickyScroll).maxLineCount);
		const scrollTop: number = this._editor.getScrollTop();
		let lastLineRelativePosition: number = 0;
		const startLineNumbers: number[] = [];
		const endLineNumbers: number[] = [];
		const arrayVisibleRanges = this._editor.getVisibleRanges();
		if (arrayVisibleRanges.length !== 0) {
			const fullVisibleRange = new StickyRange(arrayVisibleRanges[0].startLineNumber, arrayVisibleRanges[arrayVisibleRanges.length - 1].endLineNumber);
			const candidateRanges = this._stickyLineCandidateProvider.getCandidateStickyLinesIntersecting(fullVisibleRange);
			for (const range of candidateRanges) {
				const start = range.startLineNumber;
				const end = range.endLineNumber;
				const depth = range.nestingDepth;
				if (end - start > 0) {
					const topOfElementAtDepth = (depth - 1) * lineHeight;
					const bottomOfElementAtDepth = depth * lineHeight;

					const bottomOfBeginningLine = this._editor.getBottomForLineNumber(start) - scrollTop;
					const topOfEndLine = this._editor.getTopForLineNumber(end) - scrollTop;
					const bottomOfEndLine = this._editor.getBottomForLineNumber(end) - scrollTop;

					if (topOfElementAtDepth > topOfEndLine && topOfElementAtDepth <= bottomOfEndLine) {
						startLineNumbers.push(start);
						endLineNumbers.push(end + 1);
						lastLineRelativePosition = bottomOfEndLine - bottomOfElementAtDepth;
						break;
					}
					else if (bottomOfElementAtDepth > bottomOfBeginningLine && bottomOfElementAtDepth <= bottomOfEndLine) {
						startLineNumbers.push(start);
						endLineNumbers.push(end + 1);
					}
					if (startLineNumbers.length === maxNumberStickyLines) {
						break;
					}
				}
			}
		}
		this._endLineNumbers = endLineNumbers;
		return new StickyScrollWidgetState(startLineNumbers, endLineNumbers, lastLineRelativePosition, this._showEndForLine);
	}

	override dispose(): void {
		super.dispose();
		this._sessionStore.dispose();
	}
}
