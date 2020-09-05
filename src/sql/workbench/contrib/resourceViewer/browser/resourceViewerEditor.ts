/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IStorageService } from 'vs/platform/storage/common/storage';
import * as DOM from 'vs/base/browser/dom';
import { EditorOptions, IEditorOpenContext } from 'vs/workbench/common/editor';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ResourceViewerInput } from 'sql/workbench/browser/editor/resourceViewer/resourceViewerInput';
import { ResourceViewerTable } from 'sql/workbench/contrib/resourceViewer/browser/resourceViewerTable';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';

export class ResourceViewerEditor extends EditorPane {
	public static readonly ID: string = 'workbench.editor.resource-viewer';

	private _container!: HTMLElement;
	private _actionBar!: Taskbar;
	private _resourceViewerTable!: ResourceViewerTable;
	private _inputDisposables = this._register(new DisposableStore());

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

		const header = this.createHeader();
		const tableContainer = this.createResourceViewerTable();

		this._container.appendChild(header);
		this._container.appendChild(tableContainer);
	}

	private createHeader(): HTMLElement {
		const header = document.createElement('div');
		header.className = 'resource-viewer-header';
		this._actionBar = this._register(new Taskbar(header));

		this._actionBar.setContent([
			// TODO - chgagnon add actions
		]);
		return header;
	}

	private createResourceViewerTable(): HTMLElement {
		let resourceViewerTableContainer = document.createElement('div');
		resourceViewerTableContainer.className = 'resource-viewer-table monaco-editor';
		resourceViewerTableContainer.style.width = '100%';
		resourceViewerTableContainer.style.height = '100%';
		resourceViewerTableContainer.style.overflow = 'hidden';
		resourceViewerTableContainer.style.position = 'relative';
		this._resourceViewerTable = this._register(this._instantiationService.createInstance(ResourceViewerTable, resourceViewerTableContainer));
		return resourceViewerTableContainer;
	}

	public get input(): ResourceViewerInput {
		return this._input as ResourceViewerInput;
	}

	async setInput(input: ResourceViewerInput, options: EditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);

		this._inputDisposables.clear();

		this._resourceViewerTable.data = input.data;
		this._resourceViewerTable.columns = input.columns;
		this._inputDisposables.add(input.onColumnsChanged(columns => {
			this._resourceViewerTable.columns = columns;
		}));
		this._inputDisposables.add(input.onDataChanged(() => {
			this._resourceViewerTable.data = input.data;
		}));

		this._actionBar.context = input;

		this._resourceViewerTable.focus();
	}

	public layout(dimension: DOM.Dimension): void {
		this._container.style.width = dimension.width + 'px';
		this._container.style.height = dimension.height + 'px';
	}
}
