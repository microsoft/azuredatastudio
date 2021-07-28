/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorOptions, IEditorOpenContext } from 'vs/workbench/common/editor';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { BareFontInfo } from 'vs/editor/common/config/fontInfo';
import { getPixelRatio, getZoomLevel } from 'vs/base/browser/browser';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import * as DOM from 'vs/base/browser/dom';
import * as types from 'vs/base/common/types';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';
import { QueryResultsView } from 'sql/workbench/contrib/query/browser/queryResultsView';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { RESULTS_GRID_DEFAULTS } from 'sql/workbench/common/constants';

export const TextCompareEditorVisible = new RawContextKey<boolean>('textCompareEditorVisible', false);

export class BareResultsGridInfo extends BareFontInfo {

	public static override createFromRawSettings(opts: {
		fontFamily?: string;
		fontWeight?: string;
		fontSize?: number;
		lineHeight?: number;
		letterSpacing?: number;
		cellPadding?: number | number[];
	}, zoomLevel: number): BareResultsGridInfo {
		let cellPadding = !types.isUndefinedOrNull(opts.cellPadding) ? opts.cellPadding : RESULTS_GRID_DEFAULTS.cellPadding;
		return new BareResultsGridInfo(BareFontInfo.createFromRawSettings(opts, zoomLevel, getPixelRatio()), { cellPadding });
	}

	readonly cellPadding: number | number[];

	protected constructor(fontInfo: BareFontInfo, opts: {
		cellPadding: number | number[];
	}) {
		super(fontInfo);
		this.cellPadding = opts.cellPadding;
	}
}

export function getBareResultsGridInfoStyles(info: BareResultsGridInfo): string {
	let content = '';
	if (info.fontFamily) {
		content += `font-family: ${info.fontFamily};`;
	}
	if (info.fontWeight) {
		content += `font-weight: ${info.fontWeight};`;
	}
	if (info.fontSize) {
		content += `font-size: ${info.fontSize}px;`;
	}
	if (info.lineHeight) {
		content += `line-height: ${info.lineHeight}px;`;
	}
	if (info.letterSpacing) {
		content += `letter-spacing: ${info.letterSpacing}px;`;
	}
	return content;
}

/**
 * Editor associated with viewing and editing the data of a query results grid.
 */
export class QueryResultsEditor extends EditorPane {

	public static ID: string = 'workbench.editor.queryResultsEditor';
	protected _rawOptions: BareResultsGridInfo;

	private resultsView: QueryResultsView;
	private styleSheet = DOM.createStyleSheet();

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService
	) {
		super(QueryResultsEditor.ID, telemetryService, themeService, storageService);
		this._rawOptions = BareResultsGridInfo.createFromRawSettings(this._configurationService.getValue('resultsGrid'), getZoomLevel());
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('resultsGrid')) {
				this._rawOptions = BareResultsGridInfo.createFromRawSettings(this._configurationService.getValue('resultsGrid'), getZoomLevel());
				this.applySettings();
			}
		}));
		this.applySettings();
	}

	public override get input(): QueryResultsInput {
		return this._input as QueryResultsInput;
	}

	private applySettings() {
		let cssRuleText = '';
		if (types.isNumber(this._rawOptions.cellPadding)) {
			cssRuleText = this._rawOptions.cellPadding + 'px';
		} else {
			cssRuleText = this._rawOptions.cellPadding.join('px ') + 'px;';
		}
		let content = `.grid-panel .monaco-table .slick-cell { padding: ${cssRuleText} }`;
		content += `.grid-panel .monaco-table, .message-tree { ${getBareResultsGridInfoStyles(this._rawOptions)} }`;
		this.styleSheet.innerHTML = content;
	}

	createEditor(parent: HTMLElement): void {
		this.styleSheet.remove();
		parent.appendChild(this.styleSheet);
		if (!this.resultsView) {
			this.resultsView = this._register(this._instantiationService.createInstance(QueryResultsView, parent));
		}
	}

	override dispose() {
		this.styleSheet.remove();
		this.styleSheet = undefined;
		super.dispose();
	}

	layout(dimension: DOM.Dimension): void {
		this.resultsView.layout(dimension);
	}

	override setInput(input: QueryResultsInput, options: EditorOptions, context: IEditorOpenContext): Promise<void> {
		super.setInput(input, options, context, CancellationToken.None);
		this.resultsView.input = input;
		return Promise.resolve<void>(null);
	}

	override clearInput() {
		this.resultsView.clearInput();
		super.clearInput();
	}

	public chart(dataId: { batchId: number, resultId: number }) {
		this.resultsView.chartData(dataId);
	}

	public showQueryPlan(xml: string) {
		this.resultsView.showPlan(xml);
	}

	public registerQueryModelViewTab(title: string, componentId: string): void {
		this.resultsView.registerQueryModelViewTab(title, componentId);
	}

	public override focus(): void {
		this.resultsView.focus();
	}
}
