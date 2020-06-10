/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IProfilerController } from 'sql/workbench/contrib/profiler/common/interfaces';
import { ProfilerInput } from 'sql/workbench/browser/editor/profiler/profilerInput';
import { Table } from 'sql/base/browser/ui/table/table';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { RowSelectionModel } from 'sql/base/browser/ui/table/plugins/rowSelectionModel.plugin';
import { IProfilerStateChangedEvent } from 'sql/workbench/common/editor/profiler/profilerState';
import { FindWidget, ITableController, IConfigurationChangedEvent, ACTION_IDS, PROFILER_MAX_MATCHES } from 'sql/workbench/contrib/profiler/browser/profilerFindWidget';
import { ProfilerFindNext, ProfilerFindPrevious } from 'sql/workbench/contrib/profiler/browser/profilerActions';

import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IEditorAction } from 'vs/editor/common/editorCommon';
import { IOverlayWidget } from 'vs/editor/browser/editorBrowser';
import { FindReplaceState, FindReplaceStateChangedEvent } from 'vs/editor/contrib/find/findState';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { Event, Emitter } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Dimension } from 'vs/base/browser/dom';
import { textFormatter, slickGridDataItemColumnValueExtractor } from 'sql/base/browser/ui/table/formatters';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IStatusbarService, StatusbarAlignment } from 'vs/workbench/services/statusbar/common/statusbar';
import { localize } from 'vs/nls';
import { CopyKeybind } from 'sql/base/browser/ui/table/plugins/copyKeybind.plugin';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { handleCopyRequest } from 'sql/workbench/contrib/profiler/browser/profilerCopyHandler';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';

export interface ProfilerTableViewState {
	scrollTop: number;
	scrollLeft: number;
}

export class ProfilerTableEditor extends BaseEditor implements IProfilerController, ITableController {

	public static ID: string = 'workbench.editor.profiler.table';
	protected _input: ProfilerInput;
	private _profilerTable: Table<Slick.SlickData>;
	private _columnListener: IDisposable;
	private _stateListener: IDisposable;
	private _findCountChangeListener: IDisposable;
	private _findState: FindReplaceState;
	private _finder: FindWidget;
	private _overlay: HTMLElement;
	private _currentDimensions: Dimension;
	private _actionMap: { [x: string]: IEditorAction } = {};
	private _statusbarItem: IDisposable;
	private _showStatusBarItem: boolean;

	private _onDidChangeConfiguration = new Emitter<IConfigurationChangedEvent>();
	public onDidChangeConfiguration: Event<IConfigurationChangedEvent> = this._onDidChangeConfiguration.event;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkbenchThemeService private _themeService: IWorkbenchThemeService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IKeybindingService private _keybindingService: IKeybindingService,
		@IContextKeyService private _contextKeyService: IContextKeyService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@IStatusbarService private _statusbarService: IStatusbarService,
		@IClipboardService private _clipboardService: IClipboardService,
		@ITextResourcePropertiesService private readonly textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super(ProfilerTableEditor.ID, telemetryService, _themeService, storageService);
		this._actionMap[ACTION_IDS.FIND_NEXT] = this._instantiationService.createInstance(ProfilerFindNext, this);
		this._actionMap[ACTION_IDS.FIND_PREVIOUS] = this._instantiationService.createInstance(ProfilerFindPrevious, this);
		this._showStatusBarItem = true;
	}

	public createEditor(parent: HTMLElement): void {

		this._overlay = document.createElement('div');
		this._overlay.className = 'overlayWidgets';
		this._overlay.style.width = '100%';
		this._overlay.style.zIndex = '4';
		parent.appendChild(this._overlay);

		this._profilerTable = new Table(parent, {
			sorter: (args) => {
				let input = this.input as ProfilerInput;
				if (input && input.data) {
					input.data.sort(args);
				}
			}
		}, {
			dataItemColumnValueExtractor: slickGridDataItemColumnValueExtractor
		});
		this._profilerTable.setSelectionModel(new RowSelectionModel());
		const copyKeybind = new CopyKeybind();
		copyKeybind.onCopy((e) => {
			// in context of this table, the selection mode is row selection, copy the whole row will get a lot of unwanted data
			// ignore the passed in range and create a range so that it only copies the currently selected cell value.
			const activeCell = this._profilerTable.activeCell;
			handleCopyRequest(this._clipboardService, this.textResourcePropertiesService, new Slick.Range(activeCell.row, activeCell.cell), (row, cell) => {
				const fieldName = this._input.columns[cell].field;
				return this._input.data.getItem(row)[fieldName];
			});
		});
		this._profilerTable.registerPlugin(copyKeybind);
		attachTableStyler(this._profilerTable, this._themeService);

		this._findState = new FindReplaceState();
		this._findState.onFindReplaceStateChange(e => this._onFindStateChange(e));

		this._finder = new FindWidget(
			this,
			this._findState,
			this._contextViewService,
			this._keybindingService,
			this._contextKeyService,
			this._themeService
		);
	}

	public setInput(input: ProfilerInput): Promise<void> {
		this._showStatusBarItem = true;
		this._input = input;

		this._updateRowCountStatus();

		if (this._columnListener) {
			this._columnListener.dispose();
		}
		this._columnListener = input.onColumnsChanged(e => {
			this._profilerTable.columns = e.map(e => {
				e.formatter = textFormatter;
				return e;
			});
			this._profilerTable.autosizeColumns();
		});
		if (this._stateListener) {
			this._stateListener.dispose();
		}
		this._stateListener = input.state.onProfilerStateChange(e => this._onStateChange(e));
		input.data.onRowCountChange(() => {
			this._profilerTable.updateRowCount();
			this._updateRowCountStatus();
		});

		input.data.onFilterStateChange(() => {
			this._profilerTable.grid.invalidateAllRows();
			this._profilerTable.updateRowCount();
			this._updateRowCountStatus();
		});

		if (this._findCountChangeListener) {
			this._findCountChangeListener.dispose();
		}
		this._findCountChangeListener = input.data.onFindCountChange(() => this._updateFinderMatchState());

		this._profilerTable.setData(input.data);
		this._profilerTable.columns = input.columns.map(c => {
			c.formatter = textFormatter;
			return c;
		});

		this._profilerTable.autosizeColumns();
		this._input.data.currentFindPosition.then(val => {
			this._profilerTable.setActiveCell(val.row, val.col);
			this._updateFinderMatchState();
		}, er => { });

		this._input.onDispose(() => {
			this._disposeStatusbarItem();
		});
		return Promise.resolve(null);
	}

	public toggleSearch(): void {
		this._findState.change({
			isRevealed: true
		}, false);
		this._finder.focusFindInput();
	}

	public findNext(): void {
		this._input.data.findNext().then(p => {
			this._profilerTable.setActiveCell(p.row, p.col);
			this._updateFinderMatchState();
		}, er => { });
	}

	public findPrevious(): void {
		this._input.data.findPrevious().then(p => {
			this._profilerTable.setActiveCell(p.row, p.col);
			this._updateFinderMatchState();
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
		let domNode = widget.getDomNode();
		domNode.style.right = '28px';
		this._overlay.appendChild(widget.getDomNode());
		this._findState.change({ isRevealed: false }, false);
	}

	public getAction(id: string): IEditorAction {
		return this._actionMap[id];
	}

	public focus(): void {
		this._profilerTable.focus();
	}

	public layout(dimension: Dimension): void {
		this._currentDimensions = dimension;
		this._profilerTable.layout(dimension);
		this._profilerTable.autosizeColumns();
		this._onDidChangeConfiguration.fire({ layoutInfo: true });
	}

	public onSelectedRowsChanged(fn: (e: Slick.EventData, args: Slick.OnSelectedRowsChangedEventArgs<Slick.SlickData>) => any): void {
		if (this._profilerTable) {
			this._profilerTable.onSelectedRowsChanged(fn);
		}
	}

	private _onStateChange(e: IProfilerStateChangedEvent): void {
		if (e.autoscroll) {
			this._profilerTable.autoScroll = this._input.state.autoscroll;
		}
	}

	public updateState(): void {
		this._onStateChange({ autoscroll: true });
	}

	private _onFindStateChange(e: FindReplaceStateChangedEvent): void {
		if (e.isRevealed) {
			if (this._findState.isRevealed) {
				this._finder.getDomNode().style.top = '0px';
				this._updateFinderMatchState();
			} else {
				this._finder.getDomNode().style.top = '';
			}
		}

		if (e.searchString) {
			if (this._input && this._input.data) {
				if (this._findState.searchString) {
					this._input.data.find(this._findState.searchString, PROFILER_MAX_MATCHES).then(p => {
						if (p) {
							this._profilerTable.setActiveCell(p.row, p.col);
							this._updateFinderMatchState();
							this._finder.focusFindInput();
						}
					});
				} else {
					this._input.data.clearFind();
				}
			}
		}
	}

	private _updateFinderMatchState(): void {
		if (this._input && this._input.data) {
			this._findState.changeMatchInfo(this._input.data.findPosition, this._input.data.findCount, undefined);
		} else {
			this._findState.changeMatchInfo(0, 0, undefined);
		}
	}

	private _updateRowCountStatus(): void {
		if (this._showStatusBarItem) {
			let message = this._input.data.filterEnabled ?
				localize('ProfilerTableEditor.eventCountFiltered', "Events (Filtered): {0}/{1}", this._input.data.getLength(), this._input.data.getLengthNonFiltered())
				: localize('ProfilerTableEditor.eventCount', "Events: {0}", this._input.data.getLength());

			this._disposeStatusbarItem();
			this._statusbarItem = this._statusbarService.addEntry({ text: message, ariaLabel: message }, 'status.eventCount', localize('status.eventCount', "Event Count"), StatusbarAlignment.RIGHT);
		}
	}

	private _disposeStatusbarItem() {
		if (this._statusbarItem) {
			this._statusbarItem.dispose();
		}
	}

	public saveViewState(): ProfilerTableViewState {
		this._disposeStatusbarItem();
		this._showStatusBarItem = false;
		let viewElement = this._profilerTable.grid.getCanvasNode().parentElement;
		return {
			scrollTop: viewElement.scrollTop,
			scrollLeft: viewElement.scrollLeft
		};
	}

	public restoreViewState(state: ProfilerTableViewState): void {
		this._showStatusBarItem = true;
		this._updateRowCountStatus();
		let viewElement = this._profilerTable.grid.getCanvasNode().parentElement;
		viewElement.scrollTop = state.scrollTop;
		viewElement.scrollLeft = state.scrollLeft;
	}
}
