/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import * as dom from 'vs/base/browser/dom';
import { CancellationToken } from 'vs/base/common/cancellation';
import { Color, RGBA } from 'vs/base/common/color';
import { IMarkdownString, MarkdownString, isEmptyMarkdownString, markedStringsEquals } from 'vs/base/common/htmlContent';
import { Disposable, IDisposable, combinedDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { Position } from 'vs/editor/common/core/position';
import { IRange, Range } from 'vs/editor/common/core/range';
import { ModelDecorationOptions } from 'vs/editor/common/model/textModel';
import { DocumentColorProvider, Hover as MarkdownHover, HoverProviderRegistry, IColor } from 'vs/editor/common/modes';
import { getColorPresentations } from 'vs/editor/contrib/colorPicker/color';
import { ColorDetector } from 'vs/editor/contrib/colorPicker/colorDetector';
import { ColorPickerModel } from 'vs/editor/contrib/colorPicker/colorPickerModel';
import { ColorPickerWidget } from 'vs/editor/contrib/colorPicker/colorPickerWidget';
import { getHover } from 'vs/editor/contrib/hover/getHover';
import { HoverOperation, HoverStartMode, IHoverComputer } from 'vs/editor/contrib/hover/hoverOperation';
import { ContentHoverWidget } from 'vs/editor/contrib/hover/hoverWidgets';
import { MarkdownRenderer } from 'vs/editor/contrib/markdown/markdownRenderer';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { coalesce, isNonEmptyArray, asArray } from 'vs/base/common/arrays';
import { IMarker, IMarkerData, MarkerSeverity } from 'vs/platform/markers/common/markers';
import { basename } from 'vs/base/common/resources';
import { IMarkerDecorationsService } from 'vs/editor/common/services/markersDecorationService';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IOpenerService, NullOpenerService } from 'vs/platform/opener/common/opener';
import { MarkerController, NextMarkerAction } from 'vs/editor/contrib/gotoError/gotoError';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IBulkEditService } from 'vs/editor/browser/services/bulkEditService';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { CancelablePromise, createCancelablePromise } from 'vs/base/common/async';
import { getCodeActions } from 'vs/editor/contrib/codeAction/codeAction';
import { applyCodeAction, QuickFixAction } from 'vs/editor/contrib/codeAction/codeActionCommands';
import { Action } from 'vs/base/common/actions';
import { CodeActionKind } from 'vs/editor/contrib/codeAction/codeActionTrigger';
import { IModeService } from 'vs/editor/common/services/modeService';
import { withNullAsUndefined } from 'vs/base/common/types';

const $ = dom.$;

class ColorHover {

	constructor(
		public readonly range: IRange,
		public readonly color: IColor,
		public readonly provider: DocumentColorProvider
	) { }
}

class MarkerHover {

	constructor(
		public readonly range: IRange,
		public readonly marker: IMarker,
	) { }
}

type HoverPart = MarkdownHover | ColorHover | MarkerHover;

class ModesContentComputer implements IHoverComputer<HoverPart[]> {

	private readonly _editor: ICodeEditor;
	private _result: HoverPart[];
	private _range: Range | null;

	constructor(
		editor: ICodeEditor,
		private readonly _markerDecorationsService: IMarkerDecorationsService
	) {
		this._editor = editor;
		this._range = null;
	}

	setRange(range: Range): void {
		this._range = range;
		this._result = [];
	}

	clearResult(): void {
		this._result = [];
	}

	computeAsync(token: CancellationToken): Promise<HoverPart[]> {
		if (!this._editor.hasModel() || !this._range) {
			return Promise.resolve([]);
		}

		const model = this._editor.getModel();

		if (!HoverProviderRegistry.has(model)) {
			return Promise.resolve([]);
		}

		return getHover(model, new Position(
			this._range.startLineNumber,
			this._range.startColumn
		), token);
	}

	computeSync(): HoverPart[] {
		if (!this._editor.hasModel() || !this._range) {
			return [];
		}

		const model = this._editor.getModel();
		const lineNumber = this._range.startLineNumber;

		if (lineNumber > this._editor.getModel().getLineCount()) {
			// Illegal line number => no results
			return [];
		}

		const colorDetector = ColorDetector.get(this._editor);
		const maxColumn = model.getLineMaxColumn(lineNumber);
		const lineDecorations = this._editor.getLineDecorations(lineNumber);
		let didFindColor = false;

		const hoverRange = this._range;
		const result = lineDecorations.map((d): HoverPart | null => {
			const startColumn = (d.range.startLineNumber === lineNumber) ? d.range.startColumn : 1;
			const endColumn = (d.range.endLineNumber === lineNumber) ? d.range.endColumn : maxColumn;

			if (startColumn > hoverRange.startColumn || hoverRange.endColumn > endColumn) {
				return null;
			}

			const range = new Range(hoverRange.startLineNumber, startColumn, hoverRange.startLineNumber, endColumn);
			const marker = this._markerDecorationsService.getMarker(model, d);
			if (marker) {
				return new MarkerHover(range, marker);
			}

			const colorData = colorDetector.getColorData(d.range.getStartPosition());

			if (!didFindColor && colorData) {
				didFindColor = true;

				const { color, range } = colorData.colorInfo;
				return new ColorHover(range, color, colorData.provider);
			} else {
				if (isEmptyMarkdownString(d.options.hoverMessage)) {
					return null;
				}

				const contents: IMarkdownString[] = d.options.hoverMessage ? asArray(d.options.hoverMessage) : [];
				return { contents, range };
			}
		});

		return coalesce(result);
	}

	onResult(result: HoverPart[], isFromSynchronousComputation: boolean): void {
		// Always put synchronous messages before asynchronous ones
		if (isFromSynchronousComputation) {
			this._result = result.concat(this._result.sort((a, b) => {
				if (a instanceof ColorHover) { // sort picker messages at to the top
					return -1;
				} else if (b instanceof ColorHover) {
					return 1;
				}
				return 0;
			}));
		} else {
			this._result = this._result.concat(result);
		}
	}

	getResult(): HoverPart[] {
		return this._result.slice(0);
	}

	getResultWithLoadingMessage(): HoverPart[] {
		return this._result.slice(0).concat([this._getLoadingMessage()]);
	}

	private _getLoadingMessage(): HoverPart {
		return {
			range: withNullAsUndefined(this._range),
			contents: [new MarkdownString().appendText(nls.localize('modesContentHover.loading', "Loading..."))]
		};
	}
}

export class ModesContentHoverWidget extends ContentHoverWidget {

	static readonly ID = 'editor.contrib.modesContentHoverWidget';

	private _messages: HoverPart[];
	private _lastRange: Range | null;
	private readonly _computer: ModesContentComputer;
	private readonly _hoverOperation: HoverOperation<HoverPart[]>;
	private _highlightDecorations: string[];
	private _isChangingDecorations: boolean;
	private _shouldFocus: boolean;
	private _colorPicker: ColorPickerWidget | null;

	private renderDisposable: IDisposable = Disposable.None;

	constructor(
		editor: ICodeEditor,
		markerDecorationsService: IMarkerDecorationsService,
		private readonly _themeService: IThemeService,
		private readonly _keybindingService: IKeybindingService,
		private readonly _contextMenuService: IContextMenuService,
		private readonly _bulkEditService: IBulkEditService,
		private readonly _commandService: ICommandService,
		private readonly _modeService: IModeService,
		private readonly _openerService: IOpenerService | null = NullOpenerService,
	) {
		super(ModesContentHoverWidget.ID, editor);

		this._messages = [];
		this._lastRange = null;
		this._computer = new ModesContentComputer(this._editor, markerDecorationsService);
		this._highlightDecorations = [];
		this._isChangingDecorations = false;

		this._hoverOperation = new HoverOperation(
			this._computer,
			result => this._withResult(result, true),
			null,
			result => this._withResult(result, false),
			this._editor.getConfiguration().contribInfo.hover.delay
		);

		this._register(dom.addStandardDisposableListener(this.getDomNode(), dom.EventType.FOCUS, () => {
			if (this._colorPicker) {
				dom.addClass(this.getDomNode(), 'colorpicker-hover');
			}
		}));
		this._register(dom.addStandardDisposableListener(this.getDomNode(), dom.EventType.BLUR, () => {
			dom.removeClass(this.getDomNode(), 'colorpicker-hover');
		}));
		this._register(editor.onDidChangeConfiguration((e) => {
			this._hoverOperation.setHoverTime(this._editor.getConfiguration().contribInfo.hover.delay);
		}));
	}

	dispose(): void {
		this.renderDisposable.dispose();
		this.renderDisposable = Disposable.None;
		this._hoverOperation.cancel();
		super.dispose();
	}

	onModelDecorationsChanged(): void {
		if (this._isChangingDecorations) {
			return;
		}
		if (this.isVisible) {
			// The decorations have changed and the hover is visible,
			// we need to recompute the displayed text
			this._hoverOperation.cancel();
			this._computer.clearResult();

			if (!this._colorPicker) { // TODO@Michel ensure that displayed text for other decorations is computed even if color picker is in place
				this._hoverOperation.start(HoverStartMode.Delayed);
			}
		}
	}

	startShowingAt(range: Range, mode: HoverStartMode, focus: boolean): void {
		if (this._lastRange && this._lastRange.equalsRange(range)) {
			// We have to show the widget at the exact same range as before, so no work is needed
			return;
		}

		this._hoverOperation.cancel();

		if (this.isVisible) {
			// The range might have changed, but the hover is visible
			// Instead of hiding it completely, filter out messages that are still in the new range and
			// kick off a new computation
			if (!this._showAtPosition || this._showAtPosition.lineNumber !== range.startLineNumber) {
				this.hide();
			} else {
				let filteredMessages: HoverPart[] = [];
				for (let i = 0, len = this._messages.length; i < len; i++) {
					const msg = this._messages[i];
					const rng = msg.range;
					if (rng && rng.startColumn <= range.startColumn && rng.endColumn >= range.endColumn) {
						filteredMessages.push(msg);
					}
				}
				if (filteredMessages.length > 0) {
					if (hoverContentsEquals(filteredMessages, this._messages)) {
						return;
					}
					this._renderMessages(range, filteredMessages);
				} else {
					this.hide();
				}
			}
		}

		this._lastRange = range;
		this._computer.setRange(range);
		this._shouldFocus = focus;
		this._hoverOperation.start(mode);
	}

	hide(): void {
		this._lastRange = null;
		this._hoverOperation.cancel();
		super.hide();
		this._isChangingDecorations = true;
		this._highlightDecorations = this._editor.deltaDecorations(this._highlightDecorations, []);
		this._isChangingDecorations = false;
		this.renderDisposable.dispose();
		this.renderDisposable = Disposable.None;
		this._colorPicker = null;
	}

	isColorPickerVisible(): boolean {
		if (this._colorPicker) {
			return true;
		}
		return false;
	}

	private _withResult(result: HoverPart[], complete: boolean): void {
		this._messages = result;

		if (this._lastRange && this._messages.length > 0) {
			this._renderMessages(this._lastRange, this._messages);
		} else if (complete) {
			this.hide();
		}
	}

	private _renderMessages(renderRange: Range, messages: HoverPart[]): void {
		this.renderDisposable.dispose();
		this._colorPicker = null;

		// update column from which to show
		let renderColumn = Number.MAX_VALUE;
		let highlightRange: Range | null = messages[0].range ? Range.lift(messages[0].range) : null;
		let fragment = document.createDocumentFragment();
		let isEmptyHoverContent = true;

		let containColorPicker = false;
		let markdownDisposeables: IDisposable[] = [];
		const markerMessages: MarkerHover[] = [];
		messages.forEach((msg) => {
			if (!msg.range) {
				return;
			}

			renderColumn = Math.min(renderColumn, msg.range.startColumn);
			highlightRange = highlightRange ? Range.plusRange(highlightRange, msg.range) : Range.lift(msg.range);

			if (msg instanceof ColorHover) {
				containColorPicker = true;

				const { red, green, blue, alpha } = msg.color;
				const rgba = new RGBA(red * 255, green * 255, blue * 255, alpha);
				const color = new Color(rgba);

				if (!this._editor.hasModel()) {
					return;
				}

				const editorModel = this._editor.getModel();
				let range = new Range(msg.range.startLineNumber, msg.range.startColumn, msg.range.endLineNumber, msg.range.endColumn);
				let colorInfo = { range: msg.range, color: msg.color };

				// create blank olor picker model and widget first to ensure it's positioned correctly.
				const model = new ColorPickerModel(color, [], 0);
				const widget = new ColorPickerWidget(fragment, model, this._editor.getConfiguration().pixelRatio, this._themeService);

				getColorPresentations(editorModel, colorInfo, msg.provider, CancellationToken.None).then(colorPresentations => {
					model.colorPresentations = colorPresentations || [];
					if (!this._editor.hasModel()) {
						// gone...
						return;
					}
					const originalText = this._editor.getModel().getValueInRange(msg.range);
					model.guessColorPresentation(color, originalText);

					const updateEditorModel = () => {
						let textEdits;
						let newRange;
						if (model.presentation.textEdit) {
							textEdits = [model.presentation.textEdit];
							newRange = new Range(
								model.presentation.textEdit.range.startLineNumber,
								model.presentation.textEdit.range.startColumn,
								model.presentation.textEdit.range.endLineNumber,
								model.presentation.textEdit.range.endColumn
							);
							newRange = newRange.setEndPosition(newRange.endLineNumber, newRange.startColumn + model.presentation.textEdit.text.length);
						} else {
							textEdits = [{ identifier: null, range, text: model.presentation.label, forceMoveMarkers: false }];
							newRange = range.setEndPosition(range.endLineNumber, range.startColumn + model.presentation.label.length);
						}

						this._editor.pushUndoStop();
						this._editor.executeEdits('colorpicker', textEdits);

						if (model.presentation.additionalTextEdits) {
							textEdits = [...model.presentation.additionalTextEdits];
							this._editor.executeEdits('colorpicker', textEdits);
							this.hide();
						}
						this._editor.pushUndoStop();
						range = newRange;
					};

					const updateColorPresentations = (color: Color) => {
						return getColorPresentations(editorModel, {
							range: range,
							color: {
								red: color.rgba.r / 255,
								green: color.rgba.g / 255,
								blue: color.rgba.b / 255,
								alpha: color.rgba.a
							}
						}, msg.provider, CancellationToken.None).then((colorPresentations) => {
							model.colorPresentations = colorPresentations || [];
						});
					};

					const colorListener = model.onColorFlushed((color: Color) => {
						updateColorPresentations(color).then(updateEditorModel);
					});
					const colorChangeListener = model.onDidChangeColor(updateColorPresentations);

					this._colorPicker = widget;
					this.showAt(range.getStartPosition(), range, this._shouldFocus);
					this.updateContents(fragment);
					this._colorPicker.layout();

					this.renderDisposable = combinedDisposable([colorListener, colorChangeListener, widget, ...markdownDisposeables]);
				});
			} else {
				if (msg instanceof MarkerHover) {
					markerMessages.push(msg);
					isEmptyHoverContent = false;
				} else {
					msg.contents
						.filter(contents => !isEmptyMarkdownString(contents))
						.forEach(contents => {
							const markdownHoverElement = $('div.hover-row.markdown-hover');
							const hoverContentsElement = dom.append(markdownHoverElement, $('div.hover-contents'));
							const renderer = new MarkdownRenderer(this._editor, this._modeService, this._openerService);
							markdownDisposeables.push(renderer.onDidRenderCodeBlock(() => {
								hoverContentsElement.className = 'hover-contents code-hover-contents';
								this.onContentsChange();
							}));
							const renderedContents = renderer.render(contents);
							hoverContentsElement.appendChild(renderedContents.element);
							fragment.appendChild(markdownHoverElement);
							markdownDisposeables.push(renderedContents);
							isEmptyHoverContent = false;
						});
				}
			}
		});

		if (markerMessages.length) {
			markerMessages.forEach(msg => fragment.appendChild(this.renderMarkerHover(msg)));
			const markerHoverForStatusbar = markerMessages.length === 1 ? markerMessages[0] : markerMessages.sort((a, b) => MarkerSeverity.compare(a.marker.severity, b.marker.severity))[0];
			fragment.appendChild(this.renderMarkerStatusbar(markerHoverForStatusbar));
		}

		// show

		if (!containColorPicker && !isEmptyHoverContent) {
			this.showAt(new Position(renderRange.startLineNumber, renderColumn), highlightRange, this._shouldFocus);
			this.updateContents(fragment);
		}

		this._isChangingDecorations = true;
		this._highlightDecorations = this._editor.deltaDecorations(this._highlightDecorations, highlightRange ? [{
			range: highlightRange,
			options: ModesContentHoverWidget._DECORATION_OPTIONS
		}] : []);
		this._isChangingDecorations = false;
	}

	private renderMarkerHover(markerHover: MarkerHover): HTMLElement {
		const hoverElement = $('div.hover-row');
		const markerElement = dom.append(hoverElement, $('div.marker.hover-contents'));
		const { source, message, code, relatedInformation } = markerHover.marker;

		this._editor.applyFontInfo(markerElement);
		const messageElement = dom.append(markerElement, $('span'));
		messageElement.style.whiteSpace = 'pre-wrap';
		messageElement.innerText = message;

		if (source || code) {
			const detailsElement = dom.append(markerElement, $('span'));
			detailsElement.style.opacity = '0.6';
			detailsElement.style.paddingLeft = '6px';
			detailsElement.innerText = source && code ? `${source}(${code})` : source ? source : `(${code})`;
		}

		if (isNonEmptyArray(relatedInformation)) {
			for (const { message, resource, startLineNumber, startColumn } of relatedInformation) {
				const relatedInfoContainer = dom.append(markerElement, $('div'));
				relatedInfoContainer.style.marginTop = '8px';
				const a = dom.append(relatedInfoContainer, $('a'));
				a.innerText = `${basename(resource)}(${startLineNumber}, ${startColumn}): `;
				a.style.cursor = 'pointer';
				a.onclick = e => {
					e.stopPropagation();
					e.preventDefault();
					if (this._openerService) {
						this._openerService.open(resource.with({ fragment: `${startLineNumber},${startColumn}` })).catch(onUnexpectedError);
					}
				};
				const messageElement = dom.append<HTMLAnchorElement>(relatedInfoContainer, $('span'));
				messageElement.innerText = message;
				this._editor.applyFontInfo(messageElement);
			}
		}

		return hoverElement;
	}

	private renderMarkerStatusbar(markerHover: MarkerHover): HTMLElement {
		const hoverElement = $('div.hover-row.status-bar');
		const disposables: IDisposable[] = [];
		const actionsElement = dom.append(hoverElement, $('div.actions'));
		disposables.push(this.renderAction(actionsElement, {
			label: nls.localize('quick fixes', "Quick Fix..."),
			commandId: QuickFixAction.Id,
			run: async (target) => {
				const codeActionsPromise = this.getCodeActions(markerHover.marker);
				disposables.push(toDisposable(() => codeActionsPromise.cancel()));
				const actions = await codeActionsPromise;
				const elementPosition = dom.getDomNodePagePosition(target);
				this._contextMenuService.showContextMenu({
					getAnchor: () => ({ x: elementPosition.left + 6, y: elementPosition.top + elementPosition.height + 6 }),
					getActions: () => actions
				});
			}
		}));
		if (markerHover.marker.severity === MarkerSeverity.Error || markerHover.marker.severity === MarkerSeverity.Warning || markerHover.marker.severity === MarkerSeverity.Info) {
			disposables.push(this.renderAction(actionsElement, {
				label: nls.localize('peek problem', "Peek Problem"),
				commandId: NextMarkerAction.ID,
				run: () => {
					this.hide();
					MarkerController.get(this._editor).show(markerHover.marker);
					this._editor.focus();
				}
			}));
		}
		this.renderDisposable = combinedDisposable(disposables);
		return hoverElement;
	}

	private getCodeActions(marker: IMarker): CancelablePromise<Action[]> {
		return createCancelablePromise(async cancellationToken => {
			const codeActions = await getCodeActions(this._editor.getModel()!, new Range(marker.startLineNumber, marker.startColumn, marker.endLineNumber, marker.endColumn), { type: 'manual', filter: { kind: CodeActionKind.QuickFix } }, cancellationToken);
			if (codeActions.actions.length) {
				return codeActions.actions.map(codeAction => new Action(
					codeAction.command ? codeAction.command.id : codeAction.title,
					codeAction.title,
					undefined,
					true,
					() => applyCodeAction(codeAction, this._bulkEditService, this._commandService)));
			}
			return [
				new Action('', nls.localize('editor.action.quickFix.noneMessage', "No code actions available"))
			];
		});
	}

	private renderAction(parent: HTMLElement, actionOptions: { label: string, iconClass?: string, run: (target: HTMLElement) => void, commandId: string }): IDisposable {
		const actionContainer = dom.append(parent, $('div.action-container'));
		const action = dom.append(actionContainer, $('a.action'));
		if (actionOptions.iconClass) {
			dom.append(action, $(`span.icon.${actionOptions.iconClass}`));
		}
		const label = dom.append(action, $('span'));
		label.textContent = actionOptions.label;
		const keybinding = this._keybindingService.lookupKeybinding(actionOptions.commandId);
		if (keybinding) {
			label.title = `${actionOptions.label} (${keybinding.getLabel()})`;
		}
		return dom.addDisposableListener(actionContainer, dom.EventType.CLICK, e => {
			e.stopPropagation();
			e.preventDefault();
			actionOptions.run(actionContainer);
		});
	}

	private static readonly _DECORATION_OPTIONS = ModelDecorationOptions.register({
		className: 'hoverHighlight'
	});
}

function hoverContentsEquals(first: HoverPart[], second: HoverPart[]): boolean {
	if ((!first && second) || (first && !second) || first.length !== second.length) {
		return false;
	}
	for (let i = 0; i < first.length; i++) {
		const firstElement = first[i];
		const secondElement = second[i];
		if (firstElement instanceof MarkerHover && secondElement instanceof MarkerHover) {
			return IMarkerData.makeKey(firstElement.marker) === IMarkerData.makeKey(secondElement.marker);
		}
		if (firstElement instanceof ColorHover || secondElement instanceof ColorHover) {
			return false;
		}
		if (firstElement instanceof MarkerHover || secondElement instanceof MarkerHover) {
			return false;
		}
		if (!markedStringsEquals(firstElement.contents, secondElement.contents)) {
			return false;
		}
	}
	return true;
}
