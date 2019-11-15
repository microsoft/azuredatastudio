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

import { IQueryModelService } from 'sql/platform/query/common/queryModel';
import { bootstrapAngular } from 'sql/platform/bootstrap/browser/bootstrapService';
import { BareResultsGridInfo, getBareResultsGridInfoStyles } from 'sql/workbench/parts/query/browser/queryResultsEditor';
import { IEditDataComponentParams } from 'sql/platform/bootstrap/common/bootstrapParams';
import { EditDataModule } from 'sql/workbench/parts/editData/browser/editData.module';
import { EDITDATA_SELECTOR, EditDataGridPanel } from 'sql/workbench/parts/editData/browser/editDataGridPanel';
import { EditDataResultsInput } from 'sql/workbench/parts/editData/browser/editDataResultsInput';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IStorageService } from 'vs/platform/storage/common/storage';


import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { Table } from 'sql/base/browser/ui/table/table';
import { INotificationService } from 'vs/platform/notification/common/notification';


export class EditDataResultsEditor extends BaseEditor {

	public static ID: string = 'workbench.editor.editDataResultsEditor';
	public static AngularSelectorString: string = 'slickgrid-container.slickgridContainer';
	protected _input: EditDataResultsInput;
	protected _rawOptions: BareResultsGridInfo;

	private styleSheet = DOM.createStyleSheet();

	//my own reference to the new grid panel
	private editGridPanel: EditDataGridPanel;

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
		return this._input as EditDataResultsInput;
	}

	public createEditor(parent: HTMLElement): void {
		this.styleSheet.remove();
		parent.appendChild(this.styleSheet);
	}

	public dispose(): void {
		this.styleSheet.remove();
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

	clearInput() {
		super.clearInput();
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

	/**
	 * Load the angular components and record for this input that we have done so
	 */
	private createGridPanel(): void {
		let input = <EditDataResultsInput>this.input;
		let uri = input.uri;

		// Pass the correct DataService to the new angular component
		let dataService = this._queryModelService.getDataService(uri);
		if (!dataService) {
			throw new Error('DataService not found for URI: ' + uri);
		}

		const parent = input.container;

		//Stuff afterwards can be ignored
		// Mark that we have bootstrapped
		input.setBootstrappedTrue();

		// Get the bootstrap params and perform the bootstrap
		// Note: pass in input so on disposal this is cleaned up.
		// Otherwise many components will be left around and be subscribed
		// to events from the backing data service

		let params: IEditDataComponentParams = {
			dataService: dataService,
			onSaveViewState: input.onSaveViewStateEmitter.event,
			onRestoreViewState: input.onRestoreViewStateEmitter.event
		};

		this._applySettings();

		let editGridPanel = this._register(this._instantiationService.createInstance(EditDataGridPanel, params));
		editGridPanel.render(this.getContainer());

		// bootstrapAngular(this._instantiationService,
		// 	EditDataModule,
		// 	parent,
		// 	EDITDATA_SELECTOR,
		// 	params,
		// 	input);
	}

	/*
	 * Add the subscription to the list of things to be disposed on destroy, or else on a new component init
	 * may get the "destroyed" object still getting called back.
	 */
	// 	protected subscribeWithDispose<T>(subject: Subject<T>, event: (value: any) => void): void {
	// 		let sub: Subscription = subject.subscribe(event);
	// 		this.toDispose.add(subscriptionToDisposable(sub));
	// 	}

	// 	initializeTable(): void {
	// 		const self = this;
	// 		this.baseInit();

	// 		// Add the subscription to the list of things to be disposed on destroy, or else on a new component init
	// 		// may get the "destroyed" object still getting called back.
	// 		this.subscribeWithDispose(this.dataService.queryEventObserver, (event) => {
	// 			switch (event.type) {
	// 				case 'start':
	// 					self.handleStart(self, event);
	// 					break;
	// 				case 'complete':
	// 					self.handleComplete(self, event);
	// 					break;
	// 				case 'message':
	// 					self.handleMessage(self, event);
	// 					break;
	// 				case 'resultSet':
	// 					self.handleResultSet(self, event);
	// 					break;
	// 				case 'editSessionReady':
	// 					self.handleEditSessionReady(self, event);
	// 					break;
	// 				default:
	// 					this.logService.error('Unexpected query event type "' + event.type + '" sent');
	// 					break;
	// 			}
	// 		});
	// 	}
}
