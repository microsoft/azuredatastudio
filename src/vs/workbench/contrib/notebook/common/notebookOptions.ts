/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { IConfigurationChangeEvent, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { InteractiveWindowCollapseCodeCells, NotebookCellDefaultCollapseConfig, NotebookCellInternalMetadata, NotebookSetting, ShowCellStatusBarType } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { INotebookExecutionStateService } from 'vs/workbench/contrib/notebook/common/notebookExecutionStateService';

const SCROLLABLE_ELEMENT_PADDING_TOP = 18;

let EDITOR_TOP_PADDING = 12;
const editorTopPaddingChangeEmitter = new Emitter<void>();

export const EditorTopPaddingChangeEvent = editorTopPaddingChangeEmitter.event;

export function updateEditorTopPadding(top: number) {
	EDITOR_TOP_PADDING = top;
	editorTopPaddingChangeEmitter.fire();
}

export function getEditorTopPadding() {
	return EDITOR_TOP_PADDING;
}

export const OutputInnerContainerTopPadding = 4;

export interface NotebookLayoutConfiguration {
	cellRightMargin: number;
	cellRunGutter: number;
	cellTopMargin: number;
	cellBottomMargin: number;
	cellOutputPadding: number;
	codeCellLeftMargin: number;
	markdownCellLeftMargin: number;
	markdownCellGutter: number;
	markdownCellTopMargin: number;
	markdownCellBottomMargin: number;
	markdownPreviewPadding: number;
	markdownFoldHintHeight: number;
	// bottomToolbarGap: number;
	// bottomToolbarHeight: number;
	editorToolbarHeight: number;
	editorTopPadding: number;
	editorBottomPadding: number;
	editorBottomPaddingWithoutStatusBar: number;
	collapsedIndicatorHeight: number;
	showCellStatusBar: ShowCellStatusBarType;
	cellStatusBarHeight: number;
	cellToolbarLocation: string | { [key: string]: string };
	cellToolbarInteraction: string;
	compactView: boolean;
	focusIndicator: 'border' | 'gutter';
	insertToolbarPosition: 'betweenCells' | 'notebookToolbar' | 'both' | 'hidden';
	insertToolbarAlignment: 'left' | 'center';
	globalToolbar: boolean;
	consolidatedOutputButton: boolean;
	consolidatedRunButton: boolean;
	showFoldingControls: 'always' | 'never' | 'mouseover';
	dragAndDropEnabled: boolean;
	fontSize: number;
	outputFontSize: number;
	outputFontFamily: string;
	outputLineHeight: number;
	markupFontSize: number;
	focusIndicatorLeftMargin: number;
	editorOptionsCustomizations: any | undefined;
	focusIndicatorGap: number;
	interactiveWindowCollapseCodeCells: InteractiveWindowCollapseCodeCells;
}

export interface NotebookOptionsChangeEvent {
	readonly cellStatusBarVisibility?: boolean;
	readonly cellToolbarLocation?: boolean;
	readonly cellToolbarInteraction?: boolean;
	readonly editorTopPadding?: boolean;
	readonly compactView?: boolean;
	readonly focusIndicator?: boolean;
	readonly insertToolbarPosition?: boolean;
	readonly insertToolbarAlignment?: boolean;
	readonly globalToolbar?: boolean;
	readonly showFoldingControls?: boolean;
	readonly consolidatedOutputButton?: boolean;
	readonly consolidatedRunButton?: boolean;
	readonly dragAndDropEnabled?: boolean;
	readonly fontSize?: boolean;
	readonly outputFontSize?: boolean;
	readonly markupFontSize?: boolean;
	readonly fontFamily?: boolean;
	readonly outputFontFamily?: boolean;
	readonly editorOptionsCustomizations?: boolean;
	readonly interactiveWindowCollapseCodeCells?: boolean;
	readonly outputLineHeight?: boolean;
}

const defaultConfigConstants = Object.freeze({
	codeCellLeftMargin: 28,
	cellRunGutter: 32,
	markdownCellTopMargin: 8,
	markdownCellBottomMargin: 8,
	markdownCellLeftMargin: 0,
	markdownCellGutter: 32,
	focusIndicatorLeftMargin: 4
});

const compactConfigConstants = Object.freeze({
	codeCellLeftMargin: 8,
	cellRunGutter: 36,
	markdownCellTopMargin: 6,
	markdownCellBottomMargin: 6,
	markdownCellLeftMargin: 8,
	markdownCellGutter: 36,
	focusIndicatorLeftMargin: 4
});

export class NotebookOptions extends Disposable {
	private _layoutConfiguration: NotebookLayoutConfiguration;
	protected readonly _onDidChangeOptions = this._register(new Emitter<NotebookOptionsChangeEvent>());
	readonly onDidChangeOptions = this._onDidChangeOptions.event;

	constructor(
		private readonly configurationService: IConfigurationService,
		private readonly notebookExecutionStateService: INotebookExecutionStateService,
		private readonly overrides?: { cellToolbarInteraction: string; globalToolbar: boolean; defaultCellCollapseConfig?: NotebookCellDefaultCollapseConfig }
	) {
		super();
		const showCellStatusBar = this.configurationService.getValue<ShowCellStatusBarType>(NotebookSetting.showCellStatusBar);
		const globalToolbar = overrides?.globalToolbar ?? this.configurationService.getValue<boolean | undefined>(NotebookSetting.globalToolbar) ?? true;
		const consolidatedOutputButton = this.configurationService.getValue<boolean | undefined>(NotebookSetting.consolidatedOutputButton) ?? true;
		const consolidatedRunButton = this.configurationService.getValue<boolean | undefined>(NotebookSetting.consolidatedRunButton) ?? false;
		const dragAndDropEnabled = this.configurationService.getValue<boolean | undefined>(NotebookSetting.dragAndDropEnabled) ?? true;
		const cellToolbarLocation = this.configurationService.getValue<string | { [key: string]: string }>(NotebookSetting.cellToolbarLocation) ?? { 'default': 'right' };
		const cellToolbarInteraction = overrides?.cellToolbarInteraction ?? this.configurationService.getValue<string>(NotebookSetting.cellToolbarVisibility);
		const compactView = this.configurationService.getValue<boolean | undefined>(NotebookSetting.compactView) ?? true;
		const focusIndicator = this._computeFocusIndicatorOption();
		const insertToolbarPosition = this._computeInsertToolbarPositionOption();
		const insertToolbarAlignment = this._computeInsertToolbarAlignmentOption();
		const showFoldingControls = this._computeShowFoldingControlsOption();
		// const { bottomToolbarGap, bottomToolbarHeight } = this._computeBottomToolbarDimensions(compactView, insertToolbarPosition, insertToolbarAlignment);
		const fontSize = this.configurationService.getValue<number>('editor.fontSize');
		const outputFontSize = this.configurationService.getValue<number>(NotebookSetting.outputFontSize);
		const outputFontFamily = this.configurationService.getValue<string>(NotebookSetting.outputFontFamily);
		const markupFontSize = this.configurationService.getValue<number>(NotebookSetting.markupFontSize);
		const editorOptionsCustomizations = this.configurationService.getValue(NotebookSetting.cellEditorOptionsCustomizations);
		const interactiveWindowCollapseCodeCells: InteractiveWindowCollapseCodeCells = this.configurationService.getValue(NotebookSetting.interactiveWindowCollapseCodeCells);
		const outputLineHeight = this._computeOutputLineHeight();

		this._layoutConfiguration = {
			...(compactView ? compactConfigConstants : defaultConfigConstants),
			cellTopMargin: 6,
			cellBottomMargin: 6,
			cellRightMargin: 16,
			cellStatusBarHeight: 22,
			cellOutputPadding: 8,
			markdownPreviewPadding: 8,
			// bottomToolbarHeight: bottomToolbarHeight,
			// bottomToolbarGap: bottomToolbarGap,
			editorToolbarHeight: 0,
			editorTopPadding: EDITOR_TOP_PADDING,
			editorBottomPadding: 4,
			editorBottomPaddingWithoutStatusBar: 12,
			collapsedIndicatorHeight: 28,
			showCellStatusBar,
			globalToolbar,
			consolidatedOutputButton,
			consolidatedRunButton,
			dragAndDropEnabled,
			cellToolbarLocation,
			cellToolbarInteraction,
			compactView,
			focusIndicator,
			insertToolbarPosition,
			insertToolbarAlignment,
			showFoldingControls,
			fontSize,
			outputFontSize,
			outputFontFamily,
			outputLineHeight,
			markupFontSize,
			editorOptionsCustomizations,
			focusIndicatorGap: 3,
			interactiveWindowCollapseCodeCells,
			markdownFoldHintHeight: 22
		};

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			this._updateConfiguration(e);
		}));

		this._register(EditorTopPaddingChangeEvent(() => {
			const configuration = Object.assign({}, this._layoutConfiguration);
			configuration.editorTopPadding = getEditorTopPadding();
			this._layoutConfiguration = configuration;
			this._onDidChangeOptions.fire({ editorTopPadding: true });
		}));
	}

	private _computeOutputLineHeight(): number {
		const minimumLineHeight = 8;
		let lineHeight = this.configurationService.getValue<number>(NotebookSetting.outputLineHeight);

		if (lineHeight < minimumLineHeight) {
			// Values too small to be line heights in pixels are in ems.
			let fontSize = this.configurationService.getValue<number>(NotebookSetting.outputFontSize);
			if (fontSize === 0) {
				fontSize = this.configurationService.getValue<number>('editor.fontSize');
			}

			lineHeight = lineHeight * fontSize;
		}

		// Enforce integer, minimum constraints
		lineHeight = Math.round(lineHeight);
		if (lineHeight < minimumLineHeight) {
			lineHeight = minimumLineHeight;
		}

		return lineHeight;
	}

	private _updateConfiguration(e: IConfigurationChangeEvent) {
		const cellStatusBarVisibility = e.affectsConfiguration(NotebookSetting.showCellStatusBar);
		const cellToolbarLocation = e.affectsConfiguration(NotebookSetting.cellToolbarLocation);
		const cellToolbarInteraction = e.affectsConfiguration(NotebookSetting.cellToolbarVisibility);
		const compactView = e.affectsConfiguration(NotebookSetting.compactView);
		const focusIndicator = e.affectsConfiguration(NotebookSetting.focusIndicator);
		const insertToolbarPosition = e.affectsConfiguration(NotebookSetting.insertToolbarLocation);
		const insertToolbarAlignment = e.affectsConfiguration(NotebookSetting.experimentalInsertToolbarAlignment);
		const globalToolbar = e.affectsConfiguration(NotebookSetting.globalToolbar);
		const consolidatedOutputButton = e.affectsConfiguration(NotebookSetting.consolidatedOutputButton);
		const consolidatedRunButton = e.affectsConfiguration(NotebookSetting.consolidatedRunButton);
		const showFoldingControls = e.affectsConfiguration(NotebookSetting.showFoldingControls);
		const dragAndDropEnabled = e.affectsConfiguration(NotebookSetting.dragAndDropEnabled);
		const fontSize = e.affectsConfiguration('editor.fontSize');
		const outputFontSize = e.affectsConfiguration(NotebookSetting.outputFontSize);
		const markupFontSize = e.affectsConfiguration(NotebookSetting.markupFontSize);
		const fontFamily = e.affectsConfiguration('editor.fontFamily');
		const outputFontFamily = e.affectsConfiguration(NotebookSetting.outputFontFamily);
		const editorOptionsCustomizations = e.affectsConfiguration(NotebookSetting.cellEditorOptionsCustomizations);
		const interactiveWindowCollapseCodeCells = e.affectsConfiguration(NotebookSetting.interactiveWindowCollapseCodeCells);
		const outputLineHeight = e.affectsConfiguration(NotebookSetting.outputLineHeight);

		if (
			!cellStatusBarVisibility
			&& !cellToolbarLocation
			&& !cellToolbarInteraction
			&& !compactView
			&& !focusIndicator
			&& !insertToolbarPosition
			&& !insertToolbarAlignment
			&& !globalToolbar
			&& !consolidatedOutputButton
			&& !consolidatedRunButton
			&& !showFoldingControls
			&& !dragAndDropEnabled
			&& !fontSize
			&& !outputFontSize
			&& !markupFontSize
			&& !fontFamily
			&& !outputFontFamily
			&& !editorOptionsCustomizations
			&& !interactiveWindowCollapseCodeCells
			&& !outputLineHeight) {
			return;
		}

		let configuration = Object.assign({}, this._layoutConfiguration);

		if (cellStatusBarVisibility) {
			configuration.showCellStatusBar = this.configurationService.getValue<ShowCellStatusBarType>(NotebookSetting.showCellStatusBar);
		}

		if (cellToolbarLocation) {
			configuration.cellToolbarLocation = this.configurationService.getValue<string | { [key: string]: string }>(NotebookSetting.cellToolbarLocation) ?? { 'default': 'right' };
		}

		if (cellToolbarInteraction && !this.overrides?.cellToolbarInteraction) {
			configuration.cellToolbarInteraction = this.configurationService.getValue<string>(NotebookSetting.cellToolbarVisibility);
		}

		if (focusIndicator) {
			configuration.focusIndicator = this._computeFocusIndicatorOption();
		}

		if (compactView) {
			const compactViewValue = this.configurationService.getValue<boolean | undefined>(NotebookSetting.compactView) ?? true;
			configuration = Object.assign(configuration, {
				...(compactViewValue ? compactConfigConstants : defaultConfigConstants),
			});
			configuration.compactView = compactViewValue;
		}

		if (insertToolbarAlignment) {
			configuration.insertToolbarAlignment = this._computeInsertToolbarAlignmentOption();
		}

		if (insertToolbarPosition) {
			configuration.insertToolbarPosition = this._computeInsertToolbarPositionOption();
		}

		if (globalToolbar && this.overrides?.globalToolbar === undefined) {
			configuration.globalToolbar = this.configurationService.getValue<boolean>(NotebookSetting.globalToolbar) ?? true;
		}

		if (consolidatedOutputButton) {
			configuration.consolidatedOutputButton = this.configurationService.getValue<boolean>(NotebookSetting.consolidatedOutputButton) ?? true;
		}

		if (consolidatedRunButton) {
			configuration.consolidatedRunButton = this.configurationService.getValue<boolean>(NotebookSetting.consolidatedRunButton) ?? true;
		}

		if (showFoldingControls) {
			configuration.showFoldingControls = this._computeShowFoldingControlsOption();
		}

		if (dragAndDropEnabled) {
			configuration.dragAndDropEnabled = this.configurationService.getValue<boolean>(NotebookSetting.dragAndDropEnabled) ?? true;
		}

		if (fontSize) {
			configuration.fontSize = this.configurationService.getValue<number>('editor.fontSize');
		}

		if (outputFontSize) {
			configuration.outputFontSize = this.configurationService.getValue<number>(NotebookSetting.outputFontSize) ?? configuration.fontSize;
		}

		if (markupFontSize) {
			configuration.markupFontSize = this.configurationService.getValue<number>(NotebookSetting.markupFontSize);
		}

		if (outputFontFamily) {
			configuration.outputFontFamily = this.configurationService.getValue<string>(NotebookSetting.outputFontFamily);
		}

		if (editorOptionsCustomizations) {
			configuration.editorOptionsCustomizations = this.configurationService.getValue(NotebookSetting.cellEditorOptionsCustomizations);
		}

		if (interactiveWindowCollapseCodeCells) {
			configuration.interactiveWindowCollapseCodeCells = this.configurationService.getValue(NotebookSetting.interactiveWindowCollapseCodeCells);
		}

		if (outputLineHeight || fontSize || outputFontSize) {
			configuration.outputLineHeight = this._computeOutputLineHeight();
		}

		this._layoutConfiguration = Object.freeze(configuration);

		// trigger event
		this._onDidChangeOptions.fire({
			cellStatusBarVisibility,
			cellToolbarLocation,
			cellToolbarInteraction,
			compactView,
			focusIndicator,
			insertToolbarPosition,
			insertToolbarAlignment,
			globalToolbar,
			showFoldingControls,
			consolidatedOutputButton,
			consolidatedRunButton,
			dragAndDropEnabled,
			fontSize,
			outputFontSize,
			markupFontSize,
			fontFamily,
			outputFontFamily,
			editorOptionsCustomizations,
			interactiveWindowCollapseCodeCells,
			outputLineHeight
		});
	}

	private _computeInsertToolbarPositionOption() {
		return this.configurationService.getValue<'betweenCells' | 'notebookToolbar' | 'both' | 'hidden'>(NotebookSetting.insertToolbarLocation) ?? 'both';
	}

	private _computeInsertToolbarAlignmentOption() {
		return this.configurationService.getValue<'left' | 'center'>(NotebookSetting.experimentalInsertToolbarAlignment) ?? 'center';
	}

	private _computeShowFoldingControlsOption() {
		return this.configurationService.getValue<'always' | 'never' | 'mouseover'>(NotebookSetting.showFoldingControls) ?? 'mouseover';
	}

	private _computeFocusIndicatorOption() {
		return this.configurationService.getValue<'border' | 'gutter'>(NotebookSetting.focusIndicator) ?? 'gutter';
	}

	getCellCollapseDefault(): NotebookCellDefaultCollapseConfig {
		return this._layoutConfiguration.interactiveWindowCollapseCodeCells === 'never' ?
			{
				codeCell: {
					inputCollapsed: false
				}
			} : {
				codeCell: {
					inputCollapsed: true
				}
			};
	}

	getLayoutConfiguration(): NotebookLayoutConfiguration {
		return this._layoutConfiguration;
	}

	computeCollapsedMarkdownCellHeight(viewType: string): number {
		const { bottomToolbarGap } = this.computeBottomToolbarDimensions(viewType);
		return this._layoutConfiguration.markdownCellTopMargin
			+ this._layoutConfiguration.collapsedIndicatorHeight
			+ bottomToolbarGap
			+ this._layoutConfiguration.markdownCellBottomMargin;
	}

	computeBottomToolbarOffset(totalHeight: number, viewType: string) {
		const { bottomToolbarGap, bottomToolbarHeight } = this.computeBottomToolbarDimensions(viewType);

		return totalHeight
			- bottomToolbarGap
			- bottomToolbarHeight / 2;
	}

	computeCodeCellEditorWidth(outerWidth: number): number {
		return outerWidth - (
			this._layoutConfiguration.codeCellLeftMargin
			+ this._layoutConfiguration.cellRunGutter
			+ this._layoutConfiguration.cellRightMargin
		);
	}

	computeMarkdownCellEditorWidth(outerWidth: number): number {
		return outerWidth
			- this._layoutConfiguration.markdownCellGutter
			- this._layoutConfiguration.markdownCellLeftMargin
			- this._layoutConfiguration.cellRightMargin;
	}

	computeStatusBarHeight(): number {
		return this._layoutConfiguration.cellStatusBarHeight;
	}

	private _computeBottomToolbarDimensions(compactView: boolean, insertToolbarPosition: 'betweenCells' | 'notebookToolbar' | 'both' | 'hidden', insertToolbarAlignment: 'left' | 'center', cellToolbar: 'right' | 'left' | 'hidden'): { bottomToolbarGap: number; bottomToolbarHeight: number } {
		if (insertToolbarAlignment === 'left' || cellToolbar !== 'hidden') {
			return {
				bottomToolbarGap: 18,
				bottomToolbarHeight: 18
			};
		}

		if (insertToolbarPosition === 'betweenCells' || insertToolbarPosition === 'both') {
			return compactView ? {
				bottomToolbarGap: 12,
				bottomToolbarHeight: 20
			} : {
				bottomToolbarGap: 20,
				bottomToolbarHeight: 20
			};
		} else {
			return {
				bottomToolbarGap: 0,
				bottomToolbarHeight: 0
			};
		}
	}

	computeBottomToolbarDimensions(viewType?: string): { bottomToolbarGap: number; bottomToolbarHeight: number } {
		const configuration = this._layoutConfiguration;
		const cellToolbarPosition = this.computeCellToolbarLocation(viewType);
		const { bottomToolbarGap, bottomToolbarHeight } = this._computeBottomToolbarDimensions(configuration.compactView, configuration.insertToolbarPosition, configuration.insertToolbarAlignment, cellToolbarPosition);
		return {
			bottomToolbarGap,
			bottomToolbarHeight
		};
	}

	computeCellToolbarLocation(viewType?: string): 'right' | 'left' | 'hidden' {
		const cellToolbarLocation = this._layoutConfiguration.cellToolbarLocation;

		if (typeof cellToolbarLocation === 'string') {
			if (cellToolbarLocation === 'left' || cellToolbarLocation === 'right' || cellToolbarLocation === 'hidden') {
				return cellToolbarLocation;
			}
		} else {
			if (viewType) {
				const notebookSpecificSetting = cellToolbarLocation[viewType] ?? cellToolbarLocation['default'];
				let cellToolbarLocationForCurrentView: 'right' | 'left' | 'hidden' = 'right';

				switch (notebookSpecificSetting) {
					case 'left':
						cellToolbarLocationForCurrentView = 'left';
						break;
					case 'right':
						cellToolbarLocationForCurrentView = 'right';
						break;
					case 'hidden':
						cellToolbarLocationForCurrentView = 'hidden';
						break;
					default:
						cellToolbarLocationForCurrentView = 'right';
						break;
				}

				return cellToolbarLocationForCurrentView;
			}
		}

		return 'right';
	}

	computeTopInsertToolbarHeight(viewType?: string): number {
		if (this._layoutConfiguration.insertToolbarPosition === 'betweenCells' || this._layoutConfiguration.insertToolbarPosition === 'both') {
			return SCROLLABLE_ELEMENT_PADDING_TOP;
		}

		const cellToolbarLocation = this.computeCellToolbarLocation(viewType);

		if (cellToolbarLocation === 'left' || cellToolbarLocation === 'right') {
			return SCROLLABLE_ELEMENT_PADDING_TOP;
		}

		return 0;
	}

	computeEditorPadding(internalMetadata: NotebookCellInternalMetadata, cellUri: URI) {
		return {
			top: getEditorTopPadding(),
			bottom: this.statusBarIsVisible(internalMetadata, cellUri)
				? this._layoutConfiguration.editorBottomPadding
				: this._layoutConfiguration.editorBottomPaddingWithoutStatusBar
		};
	}


	computeEditorStatusbarHeight(internalMetadata: NotebookCellInternalMetadata, cellUri: URI) {
		return this.statusBarIsVisible(internalMetadata, cellUri) ? this.computeStatusBarHeight() : 0;
	}

	private statusBarIsVisible(internalMetadata: NotebookCellInternalMetadata, cellUri: URI): boolean {
		const exe = this.notebookExecutionStateService.getCellExecution(cellUri);
		if (this._layoutConfiguration.showCellStatusBar === 'visible') {
			return true;
		} else if (this._layoutConfiguration.showCellStatusBar === 'visibleAfterExecute') {
			return typeof internalMetadata.lastRunSuccess === 'boolean' || exe !== undefined;
		} else {
			return false;
		}
	}

	computeWebviewOptions() {
		return {
			outputNodePadding: this._layoutConfiguration.cellOutputPadding,
			outputNodeLeftPadding: this._layoutConfiguration.cellOutputPadding,
			previewNodePadding: this._layoutConfiguration.markdownPreviewPadding,
			markdownLeftMargin: this._layoutConfiguration.markdownCellGutter + this._layoutConfiguration.markdownCellLeftMargin,
			leftMargin: this._layoutConfiguration.codeCellLeftMargin,
			rightMargin: this._layoutConfiguration.cellRightMargin,
			runGutter: this._layoutConfiguration.cellRunGutter,
			dragAndDropEnabled: this._layoutConfiguration.dragAndDropEnabled,
			fontSize: this._layoutConfiguration.fontSize,
			outputFontSize: this._layoutConfiguration.outputFontSize,
			outputFontFamily: this._layoutConfiguration.outputFontFamily,
			markupFontSize: this._layoutConfiguration.markupFontSize,
			outputLineHeight: this._layoutConfiguration.outputLineHeight,
		};
	}

	computeDiffWebviewOptions() {
		return {
			outputNodePadding: this._layoutConfiguration.cellOutputPadding,
			outputNodeLeftPadding: 0,
			previewNodePadding: this._layoutConfiguration.markdownPreviewPadding,
			markdownLeftMargin: 0,
			leftMargin: 32,
			rightMargin: 0,
			runGutter: 0,
			dragAndDropEnabled: false,
			fontSize: this._layoutConfiguration.fontSize,
			outputFontSize: this._layoutConfiguration.outputFontSize,
			outputFontFamily: this._layoutConfiguration.outputFontFamily,
			markupFontSize: this._layoutConfiguration.markupFontSize,
			outputLineHeight: this._layoutConfiguration.outputLineHeight,
		};
	}

	computeIndicatorPosition(totalHeight: number, foldHintHeight: number, viewType?: string) {
		const { bottomToolbarGap } = this.computeBottomToolbarDimensions(viewType);

		return {
			bottomIndicatorTop: totalHeight - bottomToolbarGap - this._layoutConfiguration.cellBottomMargin - foldHintHeight,
			verticalIndicatorHeight: totalHeight - bottomToolbarGap - foldHintHeight
		};
	}
}
