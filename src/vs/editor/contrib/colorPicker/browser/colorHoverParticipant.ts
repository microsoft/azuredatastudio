/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AsyncIterableObject } from 'vs/base/common/async';
import { CancellationToken } from 'vs/base/common/cancellation';
import { Color, RGBA } from 'vs/base/common/color';
import { Disposable, DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { EditorOption } from 'vs/editor/common/config/editorOptions';
import { Range } from 'vs/editor/common/core/range';
import { IModelDecoration, ITextModel, TrackedRangeStickiness } from 'vs/editor/common/model';
import { DocumentColorProvider, IColorInformation } from 'vs/editor/common/languages';
import { getColorPresentations } from 'vs/editor/contrib/colorPicker/browser/color';
import { ColorDetector } from 'vs/editor/contrib/colorPicker/browser/colorDetector';
import { ColorPickerModel } from 'vs/editor/contrib/colorPicker/browser/colorPickerModel';
import { ColorPickerWidget } from 'vs/editor/contrib/colorPicker/browser/colorPickerWidget';
import { HoverAnchor, HoverAnchorType, IEditorHoverParticipant, IEditorHoverRenderContext, IHoverPart } from 'vs/editor/contrib/hover/browser/hoverTypes';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ISingleEditOperation } from 'vs/editor/common/core/editOperation';

export class ColorHover implements IHoverPart {

	/**
	 * Force the hover to always be rendered at this specific range,
	 * even in the case of multiple hover parts.
	 */
	public readonly forceShowAtRange: boolean = true;

	constructor(
		public readonly owner: IEditorHoverParticipant<ColorHover>,
		public readonly range: Range,
		public readonly model: ColorPickerModel,
		public readonly provider: DocumentColorProvider
	) { }

	public isValidForHoverAnchor(anchor: HoverAnchor): boolean {
		return (
			anchor.type === HoverAnchorType.Range
			&& this.range.startColumn <= anchor.range.startColumn
			&& this.range.endColumn >= anchor.range.endColumn
		);
	}
}

export class ColorHoverParticipant implements IEditorHoverParticipant<ColorHover> {

	public readonly hoverOrdinal: number = 1;

	constructor(
		private readonly _editor: ICodeEditor,
		@IThemeService private readonly _themeService: IThemeService,
	) { }

	public computeSync(anchor: HoverAnchor, lineDecorations: IModelDecoration[]): ColorHover[] {
		return [];
	}

	public computeAsync(anchor: HoverAnchor, lineDecorations: IModelDecoration[], token: CancellationToken): AsyncIterableObject<ColorHover> {
		return AsyncIterableObject.fromPromise(this._computeAsync(anchor, lineDecorations, token));
	}

	private async _computeAsync(anchor: HoverAnchor, lineDecorations: IModelDecoration[], token: CancellationToken): Promise<ColorHover[]> {
		if (!this._editor.hasModel()) {
			return [];
		}
		const colorDetector = ColorDetector.get(this._editor);
		if (!colorDetector) {
			return [];
		}
		for (const d of lineDecorations) {
			if (!colorDetector.isColorDecorationId(d.id)) {
				continue;
			}

			const colorData = colorDetector.getColorData(d.range.getStartPosition());
			if (colorData) {
				const colorHover = await this._createColorHover(this._editor.getModel(), colorData.colorInfo, colorData.provider);
				return [colorHover];
			}

		}
		return [];
	}

	private async _createColorHover(editorModel: ITextModel, colorInfo: IColorInformation, provider: DocumentColorProvider): Promise<ColorHover> {
		const originalText = editorModel.getValueInRange(colorInfo.range);
		const { red, green, blue, alpha } = colorInfo.color;
		const rgba = new RGBA(Math.round(red * 255), Math.round(green * 255), Math.round(blue * 255), alpha);
		const color = new Color(rgba);

		const colorPresentations = await getColorPresentations(editorModel, colorInfo, provider, CancellationToken.None);
		const model = new ColorPickerModel(color, [], 0);
		model.colorPresentations = colorPresentations || [];
		model.guessColorPresentation(color, originalText);

		return new ColorHover(this, Range.lift(colorInfo.range), model, provider);
	}

	public renderHoverParts(context: IEditorHoverRenderContext, hoverParts: ColorHover[]): IDisposable {
		if (hoverParts.length === 0 || !this._editor.hasModel()) {
			return Disposable.None;
		}

		const disposables = new DisposableStore();
		const colorHover = hoverParts[0];
		const editorModel = this._editor.getModel();
		const model = colorHover.model;
		const widget = disposables.add(new ColorPickerWidget(context.fragment, model, this._editor.getOption(EditorOption.pixelRatio), this._themeService));
		context.setColorPicker(widget);

		let range = new Range(colorHover.range.startLineNumber, colorHover.range.startColumn, colorHover.range.endLineNumber, colorHover.range.endColumn);

		const updateEditorModel = () => {
			let textEdits: ISingleEditOperation[];
			let newRange: Range;
			if (model.presentation.textEdit) {
				textEdits = [model.presentation.textEdit];
				newRange = new Range(
					model.presentation.textEdit.range.startLineNumber,
					model.presentation.textEdit.range.startColumn,
					model.presentation.textEdit.range.endLineNumber,
					model.presentation.textEdit.range.endColumn
				);
				const trackedRange = this._editor.getModel()!._setTrackedRange(null, newRange, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter);
				this._editor.pushUndoStop();
				this._editor.executeEdits('colorpicker', textEdits);
				newRange = this._editor.getModel()!._getTrackedRange(trackedRange) || newRange;
			} else {
				textEdits = [{ range, text: model.presentation.label, forceMoveMarkers: false }];
				newRange = range.setEndPosition(range.endLineNumber, range.startColumn + model.presentation.label.length);
				this._editor.pushUndoStop();
				this._editor.executeEdits('colorpicker', textEdits);
			}

			if (model.presentation.additionalTextEdits) {
				textEdits = [...model.presentation.additionalTextEdits];
				this._editor.executeEdits('colorpicker', textEdits);
				context.hide();
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
			}, colorHover.provider, CancellationToken.None).then((colorPresentations) => {
				model.colorPresentations = colorPresentations || [];
			});
		};

		disposables.add(model.onColorFlushed((color: Color) => {
			updateColorPresentations(color).then(updateEditorModel);
		}));
		disposables.add(model.onDidChangeColor(updateColorPresentations));

		return disposables;
	}
}
