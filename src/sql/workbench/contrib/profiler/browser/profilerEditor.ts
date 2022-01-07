/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProfilerInput } from 'sql/workbench/browser/editor/profiler/profilerInput';
import { TabbedPanel } from 'sql/base/browser/ui/panel/panel';
import { Table } from 'sql/base/browser/ui/table/table';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { IProfilerService, IProfilerViewTemplate } from 'sql/workbench/services/profiler/browser/interfaces';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { IProfilerStateChangedEvent } from 'sql/workbench/common/editor/profiler/profilerState';
import { ProfilerTableEditor, ProfilerTableViewState } from 'sql/workbench/contrib/profiler/browser/profilerTableEditor';
import * as Actions from 'sql/workbench/contrib/profiler/browser/profilerActions';
import { CONTEXT_PROFILER_EDITOR, PROFILER_TABLE_COMMAND_SEARCH } from 'sql/workbench/contrib/profiler/common/interfaces';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { textFormatter, slickGridDataItemColumnValueExtractor } from 'sql/base/browser/ui/table/formatters';
import { ProfilerResourceEditor } from 'sql/workbench/contrib/profiler/browser/profilerResourceEditor';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { ITextModel } from 'vs/editor/common/model';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { URI } from 'vs/base/common/uri';
import { Schemas } from 'vs/base/common/network';
import * as nls from 'vs/nls';
import { IModelService } from 'vs/editor/common/services/modelService';
import { DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { Command } from 'vs/editor/browser/editorExtensions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { ContextKeyExpr, IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { CommonFindController, FindStartFocusAction } from 'vs/editor/contrib/find/findController';
import * as types from 'vs/base/common/types';
import { attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import { ColorScheme } from 'vs/platform/theme/common/theme';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IView, SplitView, Sizing } from 'vs/base/browser/ui/splitview/splitview';
import * as DOM from 'vs/base/browser/dom';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IWorkbenchThemeService, VS_DARK_THEME, VS_HC_THEME } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { Event, Emitter } from 'vs/base/common/event';
import { clamp } from 'vs/base/common/numbers';
import { CopyKeybind } from 'sql/base/browser/ui/table/plugins/copyKeybind.plugin';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';
import { handleCopyRequest } from 'sql/workbench/contrib/profiler/browser/profilerCopyHandler';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { attachTabbedPanelStyler } from 'sql/workbench/common/styler';
import { UntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { IEditorGroup, IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';

class BasicView implements IView {
	public get element(): HTMLElement {
		return this._element;
	}
	private _onDidChange = new Emitter<number>();
	public readonly onDidChange: Event<number> = this._onDidChange.event;

	private _collapsed = false;
	private size: number;
	private previousSize: number;
	private _minimumSize: number;
	public get minimumSize(): number {
		return this._minimumSize;
	}

	private _maximumSize: number;
	public get maximumSize(): number {
		return this._maximumSize;
	}

	constructor(
		private _defaultMinimumSize: number,
		private _defaultMaximumSize: number,
		private _layout: (size: number) => void,
		private _element: HTMLElement,
		private options: { headersize?: number } = {}
	) {
		this._minimumSize = _defaultMinimumSize;
		this._maximumSize = _defaultMaximumSize;
	}

	public layout(size: number): void {
		this.size = size;
		this._layout(size);
	}

	public set collapsed(val: boolean) {
		if (val !== this._collapsed && this.options.headersize) {
			this._collapsed = val;
			if (this.collapsed) {
				this.previousSize = this.size;
				this._minimumSize = this.options.headersize;
				this._maximumSize = this.options.headersize;
				this._onDidChange.fire(undefined);
			} else {
				this._maximumSize = this._defaultMaximumSize;
				this._minimumSize = this._defaultMinimumSize;
				this._onDidChange.fire(clamp(this.previousSize, this.minimumSize, this.maximumSize));
			}
		}
	}

	public get collapsed(): boolean {
		return this._collapsed;
	}
}

export interface IDetailData {
	label: string;
	value: string;
}

export class ProfilerEditor extends EditorPane {
	public static readonly ID: string = 'workbench.editor.profiler';

	private _untitledTextEditorModel: UntitledTextEditorModel;
	private _editor: ProfilerResourceEditor;
	private _editorModel: ITextModel;
	private _editorInput: UntitledTextEditorInput;
	private _splitView: SplitView;
	private _container: HTMLElement;
	private _body: HTMLElement;
	private _header: HTMLElement;
	private _actionBar: Taskbar;
	private _tabbedPanel: TabbedPanel;
	private _profilerTableEditor: ProfilerTableEditor;
	private _detailTable: Table<IDetailData>;
	private _detailTableData: TableDataView<IDetailData>;
	private _stateListener: IDisposable;
	private _panelView: BasicView;

	private _profilerEditorContextKey: IContextKey<boolean>;

	private _viewTemplateSelector: SelectBox;
	private _viewTemplates: Array<IProfilerViewTemplate>;
	private _sessionSelector: SelectBox;
	private _sessionsList: Array<string>;

	// Actions
	private _connectAction: Actions.ProfilerConnect;
	private _startAction: Actions.ProfilerStart;
	private _pauseAction: Actions.ProfilerPause;
	private _stopAction: Actions.ProfilerStop;
	private _autoscrollAction: Actions.ProfilerAutoScroll;
	private _createAction: Actions.ProfilerCreate;
	private _collapsedPanelAction: Actions.ProfilerCollapsablePanelAction;
	private _filterAction: Actions.ProfilerFilterSession;
	private _clearFilterAction: Actions.ProfilerClearSessionFilter;

	private _savedTableViewStates = new Map<ProfilerInput, ProfilerTableViewState>();

	private readonly _disposables = new DisposableStore();
	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkbenchThemeService themeService: IWorkbenchThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IModelService private _modelService: IModelService,
		@IProfilerService private _profilerService: IProfilerService,
		@IContextKeyService private _contextKeyService: IContextKeyService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IEditorService editorService: IEditorService,
		@IStorageService storageService: IStorageService,
		@IClipboardService private _clipboardService: IClipboardService,
		@ITextResourcePropertiesService private readonly textResourcePropertiesService: ITextResourcePropertiesService,
		@IEditorGroupsService editorGroupsService: IEditorGroupsService
	) {
		super(ProfilerEditor.ID, telemetryService, themeService, storageService);
		this._profilerEditorContextKey = CONTEXT_PROFILER_EDITOR.bindTo(this._contextKeyService);

		if (editorGroupsService) {
			// Add all the initial groups to be listened to
			editorGroupsService.whenReady.then(() => editorGroupsService.groups.forEach(group => {
				this.registerGroupListener(group);
			}));

			// Additional groups added should also be listened to
			this._register(editorGroupsService.onDidAddGroup((group) => this.registerGroupListener(group)));

			this._register(this._disposables);
		}
	}

	private registerGroupListener(group: IEditorGroup): void {
		const listener = group.onWillOpenEditor(e => {
			if (this.isVisible() && (e.editor !== this.input || group !== this.group)) {
				this.saveEditorViewState();
			}
		});
		this._disposables.add(listener);
	}

	protected createEditor(parent: HTMLElement): void {
		this._container = document.createElement('div');
		this._container.className = 'carbon-profiler';
		parent.appendChild(this._container);

		this._createHeader();

		this._body = document.createElement('div');
		this._body.className = 'profiler-body';
		this._container.appendChild(this._body);
		this._splitView = new SplitView(this._body);

		let tableContainer = this._createProfilerTable();
		let paneContainer = this._createProfilerPane();
		this._splitView.addView(new BasicView(
			300,
			Number.POSITIVE_INFINITY,
			size => this._profilerTableEditor.layout(new DOM.Dimension(parseFloat(DOM.getComputedStyle(this._body).width), size)),
			tableContainer
		), Sizing.Distribute);

		this._panelView = new BasicView(
			300,
			Number.POSITIVE_INFINITY,
			size => this._tabbedPanel.layout(new DOM.Dimension(DOM.getTotalWidth(this._body), size)),
			paneContainer,
			{ headersize: 35 }
		);
		this._splitView.addView(this._panelView, Sizing.Distribute);
	}

	private _createHeader(): void {
		this._header = document.createElement('div');
		this._header.className = 'profiler-header';
		this._container.appendChild(this._header);
		this._actionBar = new Taskbar(this._header);
		this._startAction = this._instantiationService.createInstance(Actions.ProfilerStart, Actions.ProfilerStart.ID, Actions.ProfilerStart.LABEL);
		this._startAction.enabled = false;
		this._createAction = this._instantiationService.createInstance(Actions.ProfilerCreate, Actions.ProfilerCreate.ID, Actions.ProfilerCreate.LABEL);
		this._createAction.enabled = true;
		this._stopAction = this._instantiationService.createInstance(Actions.ProfilerStop, Actions.ProfilerStop.ID, Actions.ProfilerStop.LABEL);
		this._stopAction.enabled = false;
		this._pauseAction = this._instantiationService.createInstance(Actions.ProfilerPause, Actions.ProfilerPause.ID, Actions.ProfilerPause.LABEL);
		this._pauseAction.enabled = false;
		this._connectAction = this._instantiationService.createInstance(Actions.ProfilerConnect, Actions.ProfilerConnect.ID, Actions.ProfilerConnect.LABEL);
		this._autoscrollAction = this._instantiationService.createInstance(Actions.ProfilerAutoScroll, Actions.ProfilerAutoScroll.ID, Actions.ProfilerAutoScroll.LABEL);
		this._filterAction = this._instantiationService.createInstance(Actions.ProfilerFilterSession, Actions.ProfilerFilterSession.ID, Actions.ProfilerFilterSession.LABEL);
		this._filterAction.enabled = true;
		this._clearFilterAction = this._instantiationService.createInstance(Actions.ProfilerClearSessionFilter, Actions.ProfilerClearSessionFilter.ID, Actions.ProfilerClearSessionFilter.LABEL);
		this._clearFilterAction.enabled = true;
		this._viewTemplates = this._profilerService.getViewTemplates();
		this._viewTemplateSelector = new SelectBox(this._viewTemplates.map(i => i.name), 'Standard View', this._contextViewService);
		this._viewTemplateSelector.setAriaLabel(nls.localize('profiler.viewSelectAccessibleName', "Select View"));
		this._register(this._viewTemplateSelector.onDidSelect(e => {
			if (this.input) {
				this.input.setViewTemplate(this._viewTemplates.find(i => i.name === e.selected));
			}
		}));
		let viewTemplateContainer = document.createElement('div');
		viewTemplateContainer.style.width = '150px';
		viewTemplateContainer.style.paddingRight = '5px';
		this._viewTemplateSelector.render(viewTemplateContainer);

		this._sessionsList = [''];
		this._sessionSelector = new SelectBox(this._sessionsList, '', this._contextViewService);
		this._sessionSelector.setAriaLabel(nls.localize('profiler.sessionSelectAccessibleName', "Select Session"));
		this._register(this._sessionSelector.onDidSelect(e => {
			if (this.input) {
				this.input.setSessionName(e.selected);
			}
		}));
		let sessionsContainer = document.createElement('div');
		sessionsContainer.style.minWidth = '150px';
		sessionsContainer.style.maxWidth = '250px';
		sessionsContainer.style.paddingRight = '5px';
		this._sessionSelector.render(sessionsContainer);

		this._register(attachSelectBoxStyler(this._viewTemplateSelector, this.themeService));
		this._register(attachSelectBoxStyler(this._sessionSelector, this.themeService));

		this._actionBar.setContent([
			{ action: this._createAction },
			{ element: Taskbar.createTaskbarSeparator() },
			{ element: this._createTextElement(nls.localize('profiler.sessionSelectLabel', "Select Session:")) },
			{ element: sessionsContainer },
			{ action: this._startAction },
			{ action: this._stopAction },
			{ action: this._pauseAction },
			{ element: Taskbar.createTaskbarSeparator() },
			{ action: this._instantiationService.createInstance(Actions.ProfilerClear, Actions.ProfilerClear.ID, Actions.ProfilerClear.LABEL) },
			{ element: Taskbar.createTaskbarSeparator() },
			{ action: this._filterAction },
			{ action: this._clearFilterAction },
			{ element: Taskbar.createTaskbarSeparator() },
			{ element: this._createTextElement(nls.localize('profiler.viewSelectLabel', "Select View:")) },
			{ element: viewTemplateContainer },
			{ action: this._autoscrollAction }
		]);
	}

	private _createTextElement(text: string): HTMLDivElement {
		let textElement = document.createElement('div');
		textElement.style.paddingRight = '10px';
		textElement.innerText = text;
		textElement.style.textAlign = 'center';
		textElement.style.display = 'flex';
		textElement.style.alignItems = 'center';
		return textElement;
	}

	private _createProfilerTable(): HTMLElement {
		let profilerTableContainer = document.createElement('div');
		profilerTableContainer.className = 'profiler-table monaco-editor';
		profilerTableContainer.style.width = '100%';
		profilerTableContainer.style.height = '100%';
		profilerTableContainer.style.overflow = 'hidden';
		profilerTableContainer.style.position = 'relative';
		let theme = this.themeService.getColorTheme();
		if (theme.type === ColorScheme.DARK) {
			profilerTableContainer.classList.add(VS_DARK_THEME);
		} else if (theme.type === ColorScheme.HIGH_CONTRAST) {
			profilerTableContainer.classList.add(VS_HC_THEME);
		}
		this.themeService.onDidColorThemeChange(e => {
			profilerTableContainer.classList.remove(VS_DARK_THEME, VS_HC_THEME);
			if (e.type === ColorScheme.DARK) {
				profilerTableContainer.classList.add(VS_DARK_THEME);
			} else if (e.type === ColorScheme.HIGH_CONTRAST) {
				profilerTableContainer.classList.add(VS_HC_THEME);
			}
		});
		this._profilerTableEditor = this._instantiationService.createInstance(ProfilerTableEditor);
		this._profilerTableEditor.createEditor(profilerTableContainer);
		this._profilerTableEditor.onSelectedRowsChanged((e, args) => {
			let data = this.input.data.getItem(args.rows[0]);
			if (data) {
				this._modelService.updateModel(this._editorModel, data['TextData']);
				this._untitledTextEditorModel.setDirty(false);
				this._detailTableData.clear();
				this._detailTableData.push(Object.keys(data).filter(key => {
					return data[key] !== ' ';
				}).map(key => {
					return {
						label: key,
						value: data[key]
					};
				}));

				if (this.input && types.isUndefinedOrNull(this.input.state.isPanelCollapsed)) {
					this.input.state.change({ isPanelCollapsed: false });
				}
			} else {
				this._modelService.updateModel(this._editorModel, '');
				this._detailTableData.clear();
			}

		});

		return profilerTableContainer;
	}

	private _createProfilerPane(): HTMLElement {
		let editorContainer = this._createProfilerEditor();
		let tabbedPanelContainer = document.createElement('div');
		tabbedPanelContainer.className = 'profiler-tabbedPane';
		this._tabbedPanel = new TabbedPanel(tabbedPanelContainer);
		attachTabbedPanelStyler(this._tabbedPanel, this.themeService);

		const expandPanel = () => {
			if (this._collapsedPanelAction.collapsed) {
				this._collapsedPanelAction.run(this.input);
			}
		};

		this._tabbedPanel.pushTab({
			identifier: 'editor',
			title: nls.localize('text', "Text"),
			view: {
				layout: dim => this._editor.layout(dim),
				render: parent => parent.appendChild(editorContainer)
			},
			tabSelectedHandler: expandPanel
		});

		let detailTableContainer = document.createElement('div');
		detailTableContainer.className = 'profiler-detailTable';
		detailTableContainer.style.width = '100%';
		detailTableContainer.style.height = '100%';
		this._detailTableData = new TableDataView<IDetailData>();
		this._detailTable = new Table(detailTableContainer, {
			dataProvider: this._detailTableData, columns: [
				{
					id: 'label',
					name: nls.localize('label', "Label"),
					field: 'label',
					formatter: textFormatter
				},
				{
					id: 'value',
					name: nls.localize('profilerEditor.value', "Value"),
					field: 'value',
					formatter: textFormatter
				}
			]
		}, {
			forceFitColumns: true,
			dataItemColumnValueExtractor: slickGridDataItemColumnValueExtractor
		});

		this._detailTableData.onRowCountChange(() => {
			this._detailTable.updateRowCount();
		});

		const detailTableCopyKeybind = new CopyKeybind<IDetailData>();
		detailTableCopyKeybind.onCopy((ranges: Slick.Range[]) => {
			// we always only get 1 item in the ranges
			if (ranges && ranges.length === 1) {
				handleCopyRequest(this._clipboardService, this.textResourcePropertiesService, ranges[0], (row, cell) => {
					const item = this._detailTableData.getItem(row);
					// only 2 columns in this table
					return cell === 0 ? item.label : item.value;
				});
			}
		});
		this._detailTable.setSelectionModel(new CellSelectionModel());
		this._detailTable.registerPlugin(detailTableCopyKeybind);


		this._tabbedPanel.pushTab({
			identifier: 'detailTable',
			title: nls.localize('details', "Details"),
			view: {
				layout: dim => this._detailTable.layout(dim),
				render: parent => parent.appendChild(detailTableContainer)
			},
			tabSelectedHandler: expandPanel
		});

		this._collapsedPanelAction = this._instantiationService.createInstance(Actions.ProfilerCollapsablePanelAction, Actions.ProfilerCollapsablePanelAction.ID, Actions.ProfilerCollapsablePanelAction.LABEL);

		this._tabbedPanel.pushAction(this._collapsedPanelAction, { icon: true, label: false });

		this._register(attachTableStyler(this._detailTable, this.themeService));

		return tabbedPanelContainer;
	}

	private _createProfilerEditor(): HTMLElement {
		this._editor = this._instantiationService.createInstance(ProfilerResourceEditor);
		let editorContainer = document.createElement('div');
		editorContainer.className = 'profiler-editor';
		this._editor.create(editorContainer);
		this._editor.setVisible(true);
		this._untitledTextEditorModel = this._instantiationService.createInstance(UntitledTextEditorModel, URI.from({ scheme: Schemas.untitled }), false, undefined, 'sql', undefined);
		this._editorInput = this._instantiationService.createInstance(UntitledTextEditorInput, this._untitledTextEditorModel);
		this._editor.setInput(this._editorInput, undefined, undefined);
		this._editorInput.resolve().then(model => this._editorModel = model.textEditorModel);
		return editorContainer;
	}

	public override get input(): ProfilerInput {
		return this._input as ProfilerInput;
	}

	public override setInput(input: ProfilerInput, options?: IEditorOptions): Promise<void> {
		let savedViewState = this._savedTableViewStates.get(input);

		this._profilerEditorContextKey.set(true);
		if (input instanceof ProfilerInput && input.matches(this.input)) {
			if (savedViewState) {
				this._profilerTableEditor.restoreViewState(savedViewState);
			}
			return Promise.resolve(null);
		}

		return super.setInput(input, options, undefined, CancellationToken.None).then(() => {
			this._profilerTableEditor.setInput(input);

			if (input.viewTemplate) {
				this._viewTemplateSelector.selectWithOptionName(input.viewTemplate.name);
			} else {
				input.setViewTemplate(this._viewTemplates.find(i => i.name === 'Standard View'));
			}

			this._actionBar.context = input;
			this._tabbedPanel.actionBarContext = input;
			if (this._stateListener) {
				this._stateListener.dispose();
			}
			this._stateListener = input.state.onProfilerStateChange(e => this._onStateChange(e));
			this._onStateChange({
				isConnected: true,
				isRunning: true,
				isPaused: true,
				isStopped: true,
				autoscroll: true,
				isPanelCollapsed: true
			});
			this._profilerTableEditor.updateState();
			this._profilerTableEditor.focus();
			if (savedViewState) {
				this._profilerTableEditor.restoreViewState(savedViewState);
			}
		});
	}

	public override clearInput(): void {
		this._profilerEditorContextKey.set(false);
	}

	public toggleSearch(): void {
		if (this._editor.getControl().hasTextFocus()) {
			let editor = this._editor.getControl() as ICodeEditor;
			let controller = CommonFindController.get(editor);
			if (controller) {
				controller.start({
					forceRevealReplace: false,
					seedSearchStringFromGlobalClipboard: false,
					seedSearchStringFromSelection: (controller.getState().searchString.length === 0) ? 'single' : 'none',
					shouldFocus: FindStartFocusAction.FocusFindInput,
					shouldAnimate: true,
					updateSearchScope: false,
					loop: true,
					seedSearchStringFromNonEmptySelection: false
				});
			}
		} else {
			this._profilerTableEditor.toggleSearch();
		}
	}

	private _onStateChange(e: IProfilerStateChangedEvent): void {
		if (e.autoscroll) {
			this._autoscrollAction.checked = this.input.state.autoscroll;
		}

		if (e.isPanelCollapsed) {
			this._collapsedPanelAction.collapsed = this.input.state.isPanelCollapsed;
			this._tabbedPanel.collapsed = this.input.state.isPanelCollapsed;
			this._panelView.collapsed = this.input.state.isPanelCollapsed;
		}

		if (e.isConnected) {
			this._connectAction.connected = this.input.state.isConnected;

			if (this.input.state.isConnected) {
				this._updateToolbar();

				// Launch the create session dialog if openning a new window.
				let uiState = this._profilerService.getSessionViewState(this.input.id);
				let previousSessionName = uiState && uiState.previousSessionName;
				if (!this.input.sessionName && !previousSessionName) {
					this._profilerService.launchCreateSessionDialog(this.input);
				}

				this._updateSessionSelector(previousSessionName);
			} else {
				this._startAction.enabled = false;
				this._stopAction.enabled = false;
				this._pauseAction.enabled = false;
				this._sessionSelector.setOptions([]);
				this._sessionSelector.disable();
				return;
			}
		}

		if (e.isPaused) {
			this._pauseAction.paused = this.input.state.isPaused;
			this._updateToolbar();
		}

		if (e.isStopped || e.isRunning) {
			if (this.input.state.isRunning) {
				this._updateToolbar();
				this._sessionSelector.setOptions([this.input.sessionName]);
				this._sessionSelector.selectWithOptionName(this.input.sessionName);
				this._sessionSelector.disable();
				this._viewTemplateSelector.selectWithOptionName(this.input.viewTemplate.name);
			}
			if (this.input.state.isStopped) {
				this._updateToolbar();
				this._updateSessionSelector();
			}
		}
	}

	private _updateSessionSelector(previousSessionName: string = undefined) {
		this._sessionSelector.enable();
		this._profilerService.getXEventSessions(this.input.id).then((r) => {
			if (!r) {
				r = [];
			}

			this._sessionSelector.setOptions(r);
			this._sessionsList = r;
			if (this._sessionsList.length > 0) {
				if (!this.input.sessionName) {
					this.input.setSessionName(previousSessionName);
				}

				if (this._sessionsList.indexOf(this.input.sessionName) === -1) {
					this.input.setSessionName(this._sessionsList[0]);
				}

				this._sessionSelector.selectWithOptionName(this.input.sessionName);
			}
		});

	}

	private _updateToolbar(): void {
		this._startAction.enabled = !this.input.state.isRunning && !this.input.state.isPaused && this.input.state.isConnected;
		this._createAction.enabled = !this.input.state.isRunning && !this.input.state.isPaused && this.input.state.isConnected;
		this._stopAction.enabled = !this.input.state.isStopped && (this.input.state.isRunning || this.input.state.isPaused) && this.input.state.isConnected;
		this._pauseAction.enabled = !this.input.state.isStopped && (this.input.state.isRunning || this.input.state.isPaused && this.input.state.isConnected);
	}

	public layout(dimension: DOM.Dimension): void {
		this._container.style.width = dimension.width + 'px';
		this._container.style.height = dimension.height + 'px';
		this._body.style.width = dimension.width + 'px';
		this._body.style.height = (dimension.height - (28 + 4)) + 'px';
		this._splitView.layout(dimension.height - (28 + 4));
	}

	private saveEditorViewState(): void {
		if (this.input && this._profilerTableEditor) {
			this._savedTableViewStates.set(this.input, this._profilerTableEditor.saveViewState());
		}
	}

	public override focus() {
		this._profilerEditorContextKey.set(true);
		super.focus();
		let savedViewState = this._savedTableViewStates.get(this.input);
		if (savedViewState) {
			this._profilerTableEditor.restoreViewState(savedViewState);
		}
	}
}

abstract class SettingsCommand extends Command {

	protected getProfilerEditor(accessor: ServicesAccessor): ProfilerEditor {
		const activeEditor = accessor.get(IEditorService).activeEditorPane;
		if (activeEditor instanceof ProfilerEditor) {
			return activeEditor;
		}
		return null;
	}

}

class StartSearchProfilerTableCommand extends SettingsCommand {

	public runCommand(accessor: ServicesAccessor, args: any): void {
		const preferencesEditor = this.getProfilerEditor(accessor);
		if (preferencesEditor) {
			preferencesEditor.toggleSearch();
		}
	}

}

const command = new StartSearchProfilerTableCommand({
	id: PROFILER_TABLE_COMMAND_SEARCH,
	precondition: ContextKeyExpr.and(CONTEXT_PROFILER_EDITOR),
	kbOpts: {
		primary: KeyMod.CtrlCmd | KeyCode.KEY_F,
		weight: KeybindingWeight.EditorContrib
	}
});
command.register();
