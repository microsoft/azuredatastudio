/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { ProfilerTableViewState } from 'sql/workbench/contrib/profiler/browser/profilerTableEditor';
import { CONTEXT_PROFILER_EDITOR } from 'sql/workbench/contrib/profiler/common/interfaces';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { DARK, HIGH_CONTRAST } from 'vs/platform/theme/common/themeService';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IStorageService } from 'vs/platform/storage/common/storage';
import * as DOM from 'vs/base/browser/dom';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { EditorOptions } from 'vs/workbench/common/editor';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IWorkbenchThemeService, VS_DARK_THEME, VS_HC_THEME } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IResourceViewerStateChangedEvent } from 'sql/workbench/common/editor/resourceViewer/resourceViewerState';
import { ResourceViewerInput } from 'sql/workbench/browser/editor/resourceViewer/resourceViewerInput';
import { ResourceViewerTable } from 'sql/workbench/contrib/resourceViewer/browser/resourceViewerTable';

export interface ResourceViewerTableViewState {
	scrollTop: number;
	scrollLeft: number;
}

export class ResourceViewerEditor extends BaseEditor {
	public static readonly ID: string = 'workbench.editor.resource-viewer';

	private _container: HTMLElement;
	private _header: HTMLElement;
	private _actionBar: Taskbar;
	private _resourceViewerTable: ResourceViewerTable;
	private _stateListener: IDisposable;
	private _columnChangeListener: IDisposable;
	private _rowCountChangeListener: IDisposable;
	private _filterStateChangeListener: IDisposable;

	private _resourceViewerEditorContextKey: IContextKey<boolean>;

	private _savedTableViewStates = new Map<ResourceViewerInput, ProfilerTableViewState>();

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkbenchThemeService themeService: IWorkbenchThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IContextKeyService private _contextKeyService: IContextKeyService,
		@IEditorService editorService: IEditorService,
		@IStorageService storageService: IStorageService
	) {
		super(ResourceViewerEditor.ID, telemetryService, themeService, storageService);
		this._resourceViewerEditorContextKey = CONTEXT_PROFILER_EDITOR.bindTo(this._contextKeyService);

		if (editorService) {
			editorService.overrideOpenEditor({
				open: (editor, options, group) => {
					if (this.isVisible() && (editor !== this.input || group !== this.group)) {
						this.saveEditorViewState();
					}
					return {};
				}
			});
		}
	}

	protected createEditor(parent: HTMLElement): void {
		this._container = document.createElement('div');
		this._container.className = 'resource-viewer';
		parent.appendChild(this._container);

		this._createHeader();

		let tableContainer = this.createResourceViewerTable();

		this._container.appendChild(tableContainer);
	}

	private _createHeader(): void {
		this._header = document.createElement('div');
		this._header.className = 'resource-viewer-header';
		this._container.appendChild(this._header);
		this._actionBar = new Taskbar(this._header);

		this._actionBar.setContent([
			// TODO - chgagnon add actions
		]);
	}

	private createResourceViewerTable(): HTMLElement {
		let resourceViewerTableContainer = document.createElement('div');
		resourceViewerTableContainer.className = 'resource-viewer-table monaco-editor';
		resourceViewerTableContainer.style.width = '100%';
		resourceViewerTableContainer.style.height = '100%';
		resourceViewerTableContainer.style.overflow = 'hidden';
		resourceViewerTableContainer.style.position = 'relative';
		let theme = this.themeService.getColorTheme();
		if (theme.type === DARK) {
			DOM.addClass(resourceViewerTableContainer, VS_DARK_THEME);
		} else if (theme.type === HIGH_CONTRAST) {
			DOM.addClass(resourceViewerTableContainer, VS_HC_THEME);
		}
		this.themeService.onDidColorThemeChange(e => {
			DOM.removeClasses(resourceViewerTableContainer, VS_DARK_THEME, VS_HC_THEME);
			if (e.type === DARK) {
				DOM.addClass(resourceViewerTableContainer, VS_DARK_THEME);
			} else if (e.type === HIGH_CONTRAST) {
				DOM.addClass(resourceViewerTableContainer, VS_HC_THEME);
			}
		});
		this._resourceViewerTable = this._instantiationService.createInstance(ResourceViewerTable, resourceViewerTableContainer);
		return resourceViewerTableContainer;
	}

	public get input(): ResourceViewerInput {
		return this._input as ResourceViewerInput;
	}

	public async setInput(input: ResourceViewerInput, options?: EditorOptions): Promise<void> {
		let savedViewState = this._savedTableViewStates.get(input);

		this._resourceViewerEditorContextKey.set(true);
		if (input instanceof ResourceViewerInput && input.matches(this.input)) {
			if (savedViewState) {
				this._resourceViewerTable.restoreViewState(savedViewState);
			}
			return undefined;
		}

		await super.setInput(input, options, CancellationToken.None);

		this._resourceViewerTable.data = input.data;
		this._columnChangeListener?.dispose();
		this._columnChangeListener = input.onColumnsChanged(columns => {
			this._resourceViewerTable.columns = columns;
		});

		this._rowCountChangeListener?.dispose();
		this._rowCountChangeListener = input.data.onRowCountChange(() => {
			this._resourceViewerTable.updateRowCount();
		});

		this._filterStateChangeListener?.dispose();
		this._filterStateChangeListener = input.data.onFilterStateChange(() => {
			this._resourceViewerTable.invalidateAllRows();
			this._resourceViewerTable.updateRowCount();
		});

		this._actionBar.context = input;

		this._stateListener?.dispose();
		this._stateListener = input.state.onResourceViewerStateChange(e => this.onStateChange(e));
		this.onStateChange({
		});

		this._resourceViewerTable.focus();
		if (savedViewState) {
			this._resourceViewerTable.restoreViewState(savedViewState);
		}
	}

	public clearInput(): void {
		this._resourceViewerEditorContextKey.set(false);
	}


	private onStateChange(e: IResourceViewerStateChangedEvent): void {

	}

	public layout(dimension: DOM.Dimension): void {
		this._container.style.width = dimension.width + 'px';
		this._container.style.height = dimension.height + 'px';
	}

	private saveEditorViewState(): void {
		if (this.input && this._resourceViewerTable) {
			this._savedTableViewStates.set(this.input, this._resourceViewerTable.saveViewState());
		}
	}

	public focus() {
		this._resourceViewerEditorContextKey.set(true);
		super.focus();
		let savedViewState = this._savedTableViewStates.get(this.input);
		if (savedViewState) {
			this._resourceViewerTable.restoreViewState(savedViewState);
		}
	}
}
