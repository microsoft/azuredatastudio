/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { EditorOptions } from 'vs/workbench/common/editor';
import { getZoomLevel } from 'vs/base/browser/browser';
import { Configuration } from 'vs/editor/browser/config/configuration';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import * as types from 'vs/base/common/types';

import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';
import { BareResultsGridInfo, getBareResultsGridInfoStyles } from 'sql/workbench/contrib/query/browser/queryResultsEditor';
import { EditDataGridPanel } from 'sql/workbench/contrib/editData/browser/editDataGridPanel';
import { EditDataResultsInput } from 'sql/workbench/browser/editData/editDataResultsInput';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IStorageService } from 'vs/platform/storage/common/storage';

export class EditDataResultsEditor extends BaseEditor {

	public static ID: string = 'workbench.editor.editDataResultsEditor';
	protected _input: EditDataResultsInput;
	protected _rawOptions: BareResultsGridInfo;

	private styleSheet = DOM.createStyleSheet();

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IQueryModelService private _queryModelService: IQueryModelService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService
	) {
		super(EditDataResultsEditor.ID, telemetryService, themeService, storageService);
		this._rawOptions = BareResultsGridInfo.createFromRawSettings(this._configurationService.getValue('resultsGrid'), getZoomLevel());
		this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('resultsGrid')) {
				this._rawOptions = BareResultsGridInfo.createFromRawSettings(this._configurationService.getValue('resultsGrid'), getZoomLevel());
				this._applySettings();
			}
		});
	}

	public get input(): EditDataResultsInput {
		return this._input;
	}

	public createEditor(parent: HTMLElement): void {
		parent.appendChild(this.styleSheet);
	}

	public dispose(): void {
		this.styleSheet = undefined;
		super.dispose();
	}

	public layout(dimension: DOM.Dimension): void {
	}

	public setInput(input: EditDataResultsInput, options: EditorOptions): Promise<void> {
		super.setInput(input, options, CancellationToken.None);
		this._applySettings();
		if (!input.hasBootstrapped) {
			this.createGridPanel();
		}
		return Promise.resolve<void>(null);
	}

	private _applySettings() {
		if (this.input && this.input.container) {
			Configuration.applyFontInfoSlow(this.getContainer(), this._rawOptions);
			if (!this.input.css) {
				this.input.css = DOM.createStyleSheet(this.input.container);
			}
			let cssRuleText = '';
			if (types.isNumber(this._rawOptions.cellPadding)) {
				cssRuleText = this._rawOptions.cellPadding + 'px';
			} else {
				cssRuleText = this._rawOptions.cellPadding.join('px ') + 'px;';
			}
			let content = `.grid .slick-cell { padding: ${cssRuleText}; }`;
			content += `.grid-panel .monaco-table, .message-tree { ${getBareResultsGridInfoStyles(this._rawOptions)} }`;
			this.input.css.innerHTML = content;
		}
	}

	private createGridPanel(): void {
		let input = <EditDataResultsInput>this.input;
		let uri = input.uri;
		// Pass the correct DataService to the new angular component
		let dataService = this._queryModelService.getDataService(uri);
		if (!dataService) {
			throw new Error('DataService not found for URI: ' + uri);
		}
		// Mark that we have bootstrapped
		input.setBootstrappedTrue();
		// Note: pass in input so on disposal this is cleaned up.
		// Otherwise many components will be left around and be subscribed
		// to events from the backing data service
		this._applySettings();
		let editGridPanel = this._register(this._instantiationService.createInstance(EditDataGridPanel, dataService, input.onSaveViewStateEmitter.event, input.onRestoreViewStateEmitter.event));
		editGridPanel.render(this.getContainer());
	}
}
