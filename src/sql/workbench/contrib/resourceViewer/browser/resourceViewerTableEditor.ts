/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Table } from 'sql/base/browser/ui/table/table';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { RowSelectionModel } from 'sql/base/browser/ui/table/plugins/rowSelectionModel.plugin';

import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IEditorAction } from 'vs/editor/common/editorCommon';
import { IOverlayWidget } from 'vs/editor/browser/editorBrowser';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { Event, Emitter } from 'vs/base/common/event';
import { Dimension } from 'vs/base/browser/dom';
import { textFormatter, slickGridDataItemColumnValueExtractor } from 'sql/base/browser/ui/table/formatters';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { CopyKeybind } from 'sql/base/browser/ui/table/plugins/copyKeybind.plugin';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { handleCopyRequest } from 'sql/workbench/contrib/profiler/browser/profilerCopyHandler';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { ResourceViewerInput } from 'sql/workbench/browser/editor/resourceViewer/resourceViewerInput';
import { IResourceViewerStateChangedEvent } from 'sql/workbench/common/editor/resourceViewer/resourceViewerState';
import { ITableController } from 'sql/workbench/contrib/profiler/browser/profilerFindWidget';

export interface IConfigurationChangedEvent {
	layoutInfo?: boolean;
}

export interface ResourceViewerTableViewState {
	scrollTop: number;
	scrollLeft: number;
}

export class ResourceViewerTableEditor extends BaseEditor implements ITableController {

	public static ID: string = 'workbench.editor.resource-viewer.table';
	protected _input: ResourceViewerInput | undefined;
	private _resourceViewerTable: Table<Slick.SlickData>;
	private _columnListener: IDisposable;
	private _stateListener: IDisposable;
	private _overlay: HTMLElement;
	private _currentDimensions: Dimension;
	private _actionMap: { [x: string]: IEditorAction } = {};

	private _onDidChangeConfiguration = new Emitter<IConfigurationChangedEvent>();
	public onDidChangeConfiguration: Event<IConfigurationChangedEvent> = this._onDidChangeConfiguration.event;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkbenchThemeService private _themeService: IWorkbenchThemeService,
		@IStorageService storageService: IStorageService,
		@IClipboardService private _clipboardService: IClipboardService,
		@ITextResourcePropertiesService private readonly textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super(ResourceViewerTableEditor.ID, telemetryService, _themeService, storageService);
	}

	public createEditor(parent: HTMLElement): void {

		this._overlay = document.createElement('div');
		this._overlay.className = 'overlayWidgets';
		this._overlay.style.width = '100%';
		this._overlay.style.zIndex = '4';
		parent.appendChild(this._overlay);

		this._resourceViewerTable = new Table(parent, {
			sorter: (args) => {
				this._input?.data.sort(args);
			}
		}, {
			dataItemColumnValueExtractor: slickGridDataItemColumnValueExtractor
		});
		this._resourceViewerTable.setSelectionModel(new RowSelectionModel());
		const copyKeybind = new CopyKeybind();
		copyKeybind.onCopy((e) => {
			// in context of this table, the selection mode is row selection, copy the whole row will get a lot of unwanted data
			// ignore the passed in range and create a range so that it only copies the currently selected cell value.
			const activeCell = this._resourceViewerTable.activeCell;
			handleCopyRequest(this._clipboardService, this.textResourcePropertiesService, new Slick.Range(activeCell.row, activeCell.cell), (row, cell) => {
				const fieldName = this._input.columns[cell].field;
				return this._input.data.getItem(row)[fieldName];
			});
		});
		this._resourceViewerTable.registerPlugin(copyKeybind);

		attachTableStyler(this._resourceViewerTable, this._themeService);
	}

	public async setInput(input: ResourceViewerInput): Promise<void> {
		this._input = input;

		if (this._columnListener) {
			this._columnListener.dispose();
		}
		this._columnListener = input.onColumnsChanged(e => {
			this._resourceViewerTable.columns = e.map(e => {
				e.formatter = textFormatter;
				return e;
			});
			this._resourceViewerTable.autosizeColumns();
		});
		if (this._stateListener) {
			this._stateListener.dispose();
		}
		this._stateListener = input.state.onResourceViewerStateChange(e => this.onStateChange(e));
		input.data.onRowCountChange(() => {
			this._resourceViewerTable.updateRowCount();
		});

		input.data.onFilterStateChange(() => {
			this._resourceViewerTable.grid.invalidateAllRows();
			this._resourceViewerTable.updateRowCount();
		});

		this._resourceViewerTable.setData(input.data);
		this._resourceViewerTable.columns = input.columns.map(c => {
			c.formatter = textFormatter;
			return c;
		});

		this._resourceViewerTable.autosizeColumns();
		this._input.data.currentFindPosition.then(val => {
			this._resourceViewerTable.setActiveCell(val.row, val.col);
		}, er => { });
	}

	public getConfiguration() {
		return {
			layoutInfo: {
				width: this._currentDimensions ? this._currentDimensions.width : 0
			}
		};
	}

	public layoutOverlayWidget(widget: IOverlayWidget): void {
		// no op
	}

	public addOverlayWidget(widget: IOverlayWidget): void {
		// no op
	}

	public getAction(id: string): IEditorAction {
		return this._actionMap[id];
	}

	public focus(): void {
		this._resourceViewerTable.focus();
	}

	public layout(dimension: Dimension): void {
		this._currentDimensions = dimension;
		this._resourceViewerTable.layout(dimension);
		this._resourceViewerTable.autosizeColumns();
		this._onDidChangeConfiguration.fire({ layoutInfo: true });
	}

	public onSelectedRowsChanged(fn: (e: Slick.EventData, args: Slick.OnSelectedRowsChangedEventArgs<Slick.SlickData>) => any): void {
		if (this._resourceViewerTable) {
			this._resourceViewerTable.onSelectedRowsChanged(fn);
		}
	}

	private onStateChange(e: IResourceViewerStateChangedEvent): void {

	}

	public updateState(): void {
		this.onStateChange({ autoscroll: true });
	}

	public saveViewState(): ResourceViewerTableViewState {
		let viewElement = this._resourceViewerTable.grid.getCanvasNode().parentElement;
		return {
			scrollTop: viewElement.scrollTop,
			scrollLeft: viewElement.scrollLeft
		};
	}

	public restoreViewState(state: ResourceViewerTableViewState): void {
		let viewElement = this._resourceViewerTable.grid.getCanvasNode().parentElement;
		viewElement.scrollTop = state.scrollTop;
		viewElement.scrollLeft = state.scrollLeft;
	}
}
