/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./ghostText';
import * as dom from 'vs/base/browser/dom';
import { Disposable, DisposableStore, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { Range } from 'vs/editor/common/core/range';
import { ContentWidgetPositionPreference, ICodeEditor, IContentWidget, IContentWidgetPosition } from 'vs/editor/browser/editorBrowser';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import * as strings from 'vs/base/common/strings';
import { RenderLineInput, renderViewLine } from 'vs/editor/common/viewLayout/viewLineRenderer';
import { EditorFontLigatures, EditorOption, IComputedEditorOptions } from 'vs/editor/common/config/editorOptions';
import { createStringBuilder } from 'vs/editor/common/core/stringBuilder';
import { Configuration } from 'vs/editor/browser/config/configuration';
import { LineTokens } from 'vs/editor/common/core/lineTokens';
import { Position } from 'vs/editor/common/core/position';
import { IThemeService, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { ghostTextBorder, ghostTextForeground } from 'vs/editor/common/view/editorColorRegistry';
import { RGBA, Color } from 'vs/base/common/color';
import { CursorColumns } from 'vs/editor/common/controller/cursorCommon';
import { IDecorationRenderOptions } from 'vs/editor/common/editorCommon';
import { GhostTextWidgetModel } from 'vs/editor/contrib/inlineCompletions/ghostText';
import { IModelDeltaDecoration } from 'vs/editor/common/model';
import { LineDecoration } from 'vs/editor/common/viewLayout/lineDecorations';
import { InlineDecorationType } from 'vs/editor/common/viewModel/viewModel';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

const ttPolicy = window.trustedTypes?.createPolicy('editorGhostText', { createHTML: value => value });

export class GhostTextWidget extends Disposable {
	private disposed = false;
	private readonly partsWidget = this._register(this.instantiationService.createInstance(DecorationsWidget, this.editor));
	private readonly additionalLinesWidget = this._register(new AdditionalLinesWidget(this.editor));
	private viewMoreContentWidget: ViewMoreLinesContentWidget | undefined = undefined;

	constructor(
		private readonly editor: ICodeEditor,
		private readonly model: GhostTextWidgetModel,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();

		this._register(this.editor.onDidChangeConfiguration((e) => {
			if (
				e.hasChanged(EditorOption.disableMonospaceOptimizations)
				|| e.hasChanged(EditorOption.stopRenderingLineAfter)
				|| e.hasChanged(EditorOption.renderWhitespace)
				|| e.hasChanged(EditorOption.renderControlCharacters)
				|| e.hasChanged(EditorOption.fontLigatures)
				|| e.hasChanged(EditorOption.fontInfo)
				|| e.hasChanged(EditorOption.lineHeight)
			) {
				this.update();
			}
		}));

		this._register(toDisposable(() => {
			this.disposed = true;
			this.update();

			this.viewMoreContentWidget?.dispose();
			this.viewMoreContentWidget = undefined;
		}));

		this._register(model.onDidChange(() => {
			this.update();
		}));
		this.update();
	}

	public shouldShowHoverAtViewZone(viewZoneId: string): boolean {
		return (this.additionalLinesWidget.viewZoneId === viewZoneId);
	}

	private update(): void {
		const ghostText = this.model.ghostText;

		if (!this.editor.hasModel() || !ghostText || this.disposed) {
			this.partsWidget.clear();
			this.additionalLinesWidget.clear();
			return;
		}

		const inlineTexts = new Array<InsertedInlineText>();
		const additionalLines = new Array<LineData>();

		function addToAdditionalLines(lines: readonly string[], className: string | undefined) {
			if (additionalLines.length > 0) {
				const lastLine = additionalLines[additionalLines.length - 1];
				if (className) {
					lastLine.decorations.push(new LineDecoration(lastLine.content.length + 1, lastLine.content.length + 1 + lines[0].length, className, InlineDecorationType.Regular));
				}
				lastLine.content += lines[0];

				lines = lines.slice(1);
			}
			for (const line of lines) {
				additionalLines.push({
					content: line,
					decorations: className ? [new LineDecoration(1, line.length + 1, className, InlineDecorationType.Regular)] : []
				});
			}
		}

		const textBufferLine = this.editor.getModel().getLineContent(ghostText.lineNumber);
		this.editor.getModel().getLineTokens(ghostText.lineNumber);

		let hiddenTextStartColumn: number | undefined = undefined;
		let lastIdx = 0;
		for (const part of ghostText.parts) {
			let lines = part.lines;
			if (hiddenTextStartColumn === undefined) {
				inlineTexts.push({
					column: part.column,
					text: lines[0],
				});
				lines = lines.slice(1);
			} else {
				addToAdditionalLines([textBufferLine.substring(lastIdx, part.column - 1)], undefined);
			}

			if (lines.length > 0) {
				addToAdditionalLines(lines, 'ghost-text');
				if (hiddenTextStartColumn === undefined && part.column <= textBufferLine.length) {
					hiddenTextStartColumn = part.column;
				}
			}

			lastIdx = part.column - 1;
		}
		if (hiddenTextStartColumn !== undefined) {
			addToAdditionalLines([textBufferLine.substring(lastIdx)], undefined);
		}

		this.partsWidget.setParts(ghostText.lineNumber, inlineTexts,
			hiddenTextStartColumn !== undefined ? { column: hiddenTextStartColumn, length: textBufferLine.length + 1 - hiddenTextStartColumn } : undefined);
		this.additionalLinesWidget.updateLines(ghostText.lineNumber, additionalLines, ghostText.additionalReservedLineCount);

		if (ghostText.parts.some(p => p.lines.length < 0)) {
			// Not supported at the moment, condition is always false.
			this.viewMoreContentWidget = this.renderViewMoreLines(
				new Position(ghostText.lineNumber, this.editor.getModel()!.getLineMaxColumn(ghostText.lineNumber)),
				'', 0
			);
		} else {
			this.viewMoreContentWidget?.dispose();
			this.viewMoreContentWidget = undefined;
		}
	}

	private renderViewMoreLines(position: Position, firstLineText: string, remainingLinesLength: number): ViewMoreLinesContentWidget {
		const fontInfo = this.editor.getOption(EditorOption.fontInfo);
		const domNode = document.createElement('div');
		domNode.className = 'suggest-preview-additional-widget';
		Configuration.applyFontInfoSlow(domNode, fontInfo);

		const spacer = document.createElement('span');
		spacer.className = 'content-spacer';
		spacer.append(firstLineText);
		domNode.append(spacer);

		const newline = document.createElement('span');
		newline.className = 'content-newline suggest-preview-text';
		newline.append('⏎  ');
		domNode.append(newline);

		const disposableStore = new DisposableStore();

		const button = document.createElement('div');
		button.className = 'button suggest-preview-text';
		button.append(`+${remainingLinesLength} lines…`);

		disposableStore.add(dom.addStandardDisposableListener(button, 'mousedown', (e) => {
			this.model?.setExpanded(true);
			e.preventDefault();
			this.editor.focus();
		}));

		domNode.append(button);
		return new ViewMoreLinesContentWidget(this.editor, position, domNode, disposableStore);
	}
}

interface HiddenText {
	column: number;
	length: number;
}

interface InsertedInlineText {
	column: number;
	text: string;
}

class DecorationsWidget implements IDisposable {
	private decorationIds: string[] = [];
	private disposableStore: DisposableStore = new DisposableStore();

	constructor(
		private readonly editor: ICodeEditor,
		@ICodeEditorService private readonly codeEditorService: ICodeEditorService,
		@IThemeService private readonly themeService: IThemeService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService
	) {
	}

	public dispose(): void {
		this.clear();
		this.disposableStore.dispose();
	}

	public clear(): void {
		this.editor.deltaDecorations(this.decorationIds, []);
		this.disposableStore.clear();
	}

	public setParts(lineNumber: number, parts: InsertedInlineText[], hiddenText?: HiddenText): void {
		this.disposableStore.clear();

		const colorTheme = this.themeService.getColorTheme();
		const foreground = colorTheme.getColor(ghostTextForeground);
		let opacity: string | undefined = undefined;
		let color: string | undefined = undefined;
		if (foreground) {
			opacity = String(foreground.rgba.a);
			color = Color.Format.CSS.format(opaque(foreground))!;
		}

		const borderColor = colorTheme.getColor(ghostTextBorder);
		let border: string | undefined = undefined;
		if (borderColor) {
			border = `2px dashed ${borderColor}`;
		}

		const textModel = this.editor.getModel();
		if (!textModel) {
			return;
		}

		const { tabSize } = textModel.getOptions();

		const line = textModel.getLineContent(lineNumber) || '';
		let lastIndex = 0;
		let currentLinePrefix = '';

		const hiddenTextDecorations = new Array<IModelDeltaDecoration>();
		if (hiddenText) {
			hiddenTextDecorations.push({
				range: Range.fromPositions(new Position(lineNumber, hiddenText.column), new Position(lineNumber, hiddenText.column + hiddenText.length)),
				options: {
					inlineClassName: 'ghost-text-hidden',
					description: 'ghost-text-hidden'
				}
			});
		}

		const key = this.contextKeyService.getContextKeyValue('config.editor.useInjectedText');
		const shouldUseInjectedText = key === undefined ? true : !!key;

		this.decorationIds = this.editor.deltaDecorations(this.decorationIds, parts.map<IModelDeltaDecoration>(p => {
			currentLinePrefix += line.substring(lastIndex, p.column - 1);
			lastIndex = p.column - 1;

			// To avoid visual confusion, we don't want to render visible whitespace
			const contentText = shouldUseInjectedText ? p.text : this.renderSingleLineText(p.text, currentLinePrefix, tabSize, false);

			const decorationType = this.disposableStore.add(registerDecorationType(this.codeEditorService, 'ghost-text', '0-ghost-text-', {
				after: {
					// TODO: escape?
					contentText,
					opacity,
					color,
					border,
				},
			}));

			return ({
				range: Range.fromPositions(new Position(lineNumber, p.column)),
				options: shouldUseInjectedText ? {
					description: 'ghost-text',
					after: { content: contentText, inlineClassName: 'ghost-text-decoration' }
				} : {
					...decorationType.resolve()
				}
			});
		}).concat(hiddenTextDecorations));
	}

	private renderSingleLineText(text: string, lineStart: string, tabSize: number, renderWhitespace: boolean): string {
		const newLine = lineStart + text;
		const visibleColumnsByColumns = CursorColumns.visibleColumnsByColumns(newLine, tabSize);

		let contentText = '';
		let curCol = lineStart.length + 1;
		for (const c of text) {
			if (c === '\t') {
				const width = visibleColumnsByColumns[curCol + 1] - visibleColumnsByColumns[curCol];
				if (renderWhitespace) {
					contentText += '→';
					for (let i = 1; i < width; i++) {
						contentText += '\xa0';
					}
				} else {
					for (let i = 0; i < width; i++) {
						contentText += '\xa0';
					}
				}
			} else if (c === ' ') {
				if (renderWhitespace) {
					contentText += '·';
				} else {
					contentText += '\xa0';
				}
			} else {
				contentText += c;
			}
			curCol += 1;
		}

		return contentText;
	}
}

function opaque(color: Color): Color {
	const { r, b, g } = color.rgba;
	return new Color(new RGBA(r, g, b, 255));
}

class AdditionalLinesWidget implements IDisposable {
	private _viewZoneId: string | undefined = undefined;
	public get viewZoneId(): string | undefined { return this._viewZoneId; }

	constructor(private readonly editor: ICodeEditor) { }

	public dispose(): void {
		this.clear();
	}

	public clear(): void {
		this.editor.changeViewZones((changeAccessor) => {
			if (this._viewZoneId) {
				changeAccessor.removeZone(this._viewZoneId);
				this._viewZoneId = undefined;
			}
		});
	}

	public updateLines(lineNumber: number, additionalLines: LineData[], minReservedLineCount: number): void {
		const textModel = this.editor.getModel();
		if (!textModel) {
			return;
		}

		const { tabSize } = textModel.getOptions();

		this.editor.changeViewZones((changeAccessor) => {
			if (this._viewZoneId) {
				changeAccessor.removeZone(this._viewZoneId);
				this._viewZoneId = undefined;
			}

			const heightInLines = Math.max(additionalLines.length, minReservedLineCount);
			if (heightInLines > 0) {
				const domNode = document.createElement('div');
				renderLines(domNode, tabSize, additionalLines, this.editor.getOptions());

				this._viewZoneId = changeAccessor.addZone({
					afterLineNumber: lineNumber,
					heightInLines: heightInLines,
					domNode,
				});
			}
		});
	}
}

interface LineData {
	content: string;
	decorations: LineDecoration[];
}

function renderLines(domNode: HTMLElement, tabSize: number, lines: LineData[], opts: IComputedEditorOptions): void {
	const disableMonospaceOptimizations = opts.get(EditorOption.disableMonospaceOptimizations);
	const stopRenderingLineAfter = opts.get(EditorOption.stopRenderingLineAfter);
	// To avoid visual confusion, we don't want to render visible whitespace
	const renderWhitespace = 'none';
	const renderControlCharacters = opts.get(EditorOption.renderControlCharacters);
	const fontLigatures = opts.get(EditorOption.fontLigatures);
	const fontInfo = opts.get(EditorOption.fontInfo);
	const lineHeight = opts.get(EditorOption.lineHeight);

	const sb = createStringBuilder(10000);
	sb.appendASCIIString('<div class="suggest-preview-text">');

	for (let i = 0, len = lines.length; i < len; i++) {
		const lineData = lines[i];
		const line = lineData.content;
		sb.appendASCIIString('<div class="view-line');
		sb.appendASCIIString('" style="top:');
		sb.appendASCIIString(String(i * lineHeight));
		sb.appendASCIIString('px;width:1000000px;">');

		const isBasicASCII = strings.isBasicASCII(line);
		const containsRTL = strings.containsRTL(line);
		const lineTokens = LineTokens.createEmpty(line);

		renderViewLine(new RenderLineInput(
			(fontInfo.isMonospace && !disableMonospaceOptimizations),
			fontInfo.canUseHalfwidthRightwardsArrow,
			line,
			false,
			isBasicASCII,
			containsRTL,
			0,
			lineTokens,
			lineData.decorations,
			tabSize,
			0,
			fontInfo.spaceWidth,
			fontInfo.middotWidth,
			fontInfo.wsmiddotWidth,
			stopRenderingLineAfter,
			renderWhitespace,
			renderControlCharacters,
			fontLigatures !== EditorFontLigatures.OFF,
			null
		), sb);

		sb.appendASCIIString('</div>');
	}
	sb.appendASCIIString('</div>');

	Configuration.applyFontInfoSlow(domNode, fontInfo);
	const html = sb.build();
	const trustedhtml = ttPolicy ? ttPolicy.createHTML(html) : html;
	domNode.innerHTML = trustedhtml as string;
}

let keyCounter = 0;

function registerDecorationType(service: ICodeEditorService, description: string, keyPrefix: string, options: IDecorationRenderOptions) {
	const key = keyPrefix + (keyCounter++);
	service.registerDecorationType(description, key, options);
	return {
		dispose() {
			service.removeDecorationType(key);
		},
		resolve() {
			return service.resolveDecorationOptions(key, true);
		}
	};
}

class ViewMoreLinesContentWidget extends Disposable implements IContentWidget {
	readonly allowEditorOverflow = false;
	readonly suppressMouseDown = false;

	constructor(
		private editor: ICodeEditor,
		private position: Position,
		private domNode: HTMLElement,
		disposableStore: DisposableStore
	) {
		super();
		this._register(disposableStore);
		this._register(toDisposable(() => {
			this.editor.removeContentWidget(this);
		}));
		this.editor.addContentWidget(this);
	}

	getId(): string {
		return 'editor.widget.viewMoreLinesWidget';
	}

	getDomNode(): HTMLElement {
		return this.domNode;
	}

	getPosition(): IContentWidgetPosition | null {
		return {
			position: this.position,
			preference: [ContentWidgetPositionPreference.EXACT]
		};
	}
}

registerThemingParticipant((theme, collector) => {
	const foreground = theme.getColor(ghostTextForeground);

	if (foreground) {
		const opacity = String(foreground.rgba.a);
		const color = Color.Format.CSS.format(opaque(foreground))!;

		collector.addRule(`.monaco-editor .ghost-text-decoration { opacity: ${opacity}; color: ${color}; }`);
		collector.addRule(`.monaco-editor .suggest-preview-text .ghost-text { opacity: ${opacity}; color: ${color}; }`);
	}

	const border = theme.getColor(ghostTextBorder);
	if (border) {
		collector.addRule(`.monaco-editor .suggest-preview-text .ghost-text { border: 2px dashed ${border}; }`);
	}
});
