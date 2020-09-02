/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { IDisposable } from 'vs/base/common/lifecycle';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IStorageService } from 'vs/platform/storage/common/storage';
import * as DOM from 'vs/base/browser/dom';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { EditorOptions } from 'vs/workbench/common/editor';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IResourceViewerStateChangedEvent } from 'sql/workbench/common/editor/resourceViewer/resourceViewerState';
import { ResourceViewerInput } from 'sql/workbench/browser/editor/resourceViewer/resourceViewerInput';
import { ResourceViewerTable } from 'sql/workbench/contrib/resourceViewer/browser/resourceViewerTable';

export class ResourceViewerEditor extends BaseEditor {
	public static readonly ID: string = 'workbench.editor.resource-viewer';

	private _container!: HTMLElement;
	private _actionBar!: Taskbar;
	private _resourceViewerTable!: ResourceViewerTable;
	private _stateListener: IDisposable | undefined;
	private _columnChangeListener: IDisposable | undefined;
	private _rowCountChangeListener: IDisposable | undefined;
	private _filterStateChangeListener: IDisposable | undefined;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkbenchThemeService themeService: IWorkbenchThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService
	) {
		super(ResourceViewerEditor.ID, telemetryService, themeService, storageService);
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
		const header = document.createElement('div');
		header.className = 'resource-viewer-header';
		this._container.appendChild(header);
		this._actionBar = new Taskbar(header);

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
		this._resourceViewerTable = this._instantiationService.createInstance(ResourceViewerTable, resourceViewerTableContainer);
		return resourceViewerTableContainer;
	}

	public get input(): ResourceViewerInput {
		return this._input as ResourceViewerInput;
	}

	public async setInput(input: ResourceViewerInput, options?: EditorOptions): Promise<void> {
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

		input.columns = ['c1', 'c2', 'c3'];
		input.data.push([{ c1: 'c1.1', c2: 'c2.1', c3: 'c3.1' }, { c1: 'c1.2', c2: 'c2.2', 'c3': 'c3.2' }]);
		input.data.filter();
	}


	private onStateChange(e: IResourceViewerStateChangedEvent): void {

	}

	public layout(dimension: DOM.Dimension): void {
		this._container.style.width = dimension.width + 'px';
		this._container.style.height = dimension.height + 'px';
	}
}
