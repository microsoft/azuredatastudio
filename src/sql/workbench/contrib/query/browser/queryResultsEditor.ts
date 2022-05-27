/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorOpenContext } from 'vs/workbench/common/editor';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { getZoomLevel } from 'vs/base/browser/browser';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import * as DOM from 'vs/base/browser/dom';
import * as types from 'vs/base/common/types';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { BareResultsGridInfo, getBareResultsGridInfoStyles } from 'sql/workbench/contrib/query/browser/queryEditor';
import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';
import { QueryResultsView } from 'sql/workbench/contrib/query/browser/queryResultsView';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IEditorOptions } from 'vs/platform/editor/common/editor';

export const TextCompareEditorVisible = new RawContextKey<boolean>('textCompareEditorVisible', false);

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

	public get getResultsView(): QueryResultsView {
		return this.resultsView;
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

	override setInput(input: QueryResultsInput, options: IEditorOptions, context: IEditorOpenContext): Promise<void> {
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

	public showTopOperation(xml: string) {
		this.resultsView.showTopOperations(xml);
	}

	public registerQueryModelViewTab(title: string, componentId: string): void {
		this.resultsView.registerQueryModelViewTab(title, componentId);
	}

	public override focus(): void {
		this.resultsView.focus();
	}
}
