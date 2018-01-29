/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/parts/query/editor/media/queryEditor';

import { TPromise } from 'vs/base/common/winjs.base';
import * as DOM from 'vs/base/browser/dom';
import * as nls from 'vs/nls';
import { Builder, Dimension } from 'vs/base/browser/builder';

import { EditorOptions } from 'vs/workbench/common/editor';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { Position } from 'vs/platform/editor/common/editor';

import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { EditDataInput } from 'sql/parts/editData/common/editDataInput';

import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { Taskbar, ITaskbarContent } from 'sql/base/browser/ui/taskbar/taskbar';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IActionItem } from 'vs/base/browser/ui/actionbar/actionbar';
import { Action } from 'vs/base/common/actions';
import { IQueryModelService } from 'sql/parts/query/execution/queryModel';
import { IEditorDescriptorService } from 'sql/parts/query/editor/editorDescriptorService';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import {
	RefreshTableAction, StopRefreshTableAction,
	ChangeMaxRowsAction, ChangeMaxRowsActionItem
} from 'sql/parts/editData/execution/editDataActions';
import { EditDataModule } from 'sql/parts/grid/views/editData/editData.module';
import { IBootstrapService } from 'sql/services/bootstrap/bootstrapService';
import { EDITDATA_SELECTOR } from 'sql/parts/grid/views/editData/editData.component';
import { EditDataComponentParams } from 'sql/services/bootstrap/bootstrapParams';

/**
 * Editor that hosts an action bar and a resultSetInput for an edit data session
 */
export class EditDataEditor extends BaseEditor {

	public static ID: string = 'workbench.editor.editDataEditor';

	private _dimension: Dimension;
	private _container: HTMLElement;
	private _taskbar: Taskbar;
	private _taskbarContainer: HTMLElement;
	private _changeMaxRowsActionItem: ChangeMaxRowsActionItem;
	private _stopRefreshTableAction: StopRefreshTableAction;
	private _refreshTableAction: RefreshTableAction;
	private _changeMaxRowsAction: ChangeMaxRowsAction;
	private _spinnerElement: HTMLElement;
	private _initialized: boolean = false;

	constructor(
		@ITelemetryService _telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IWorkbenchEditorService private _editorService: IWorkbenchEditorService,
		@IContextMenuService private _contextMenuService: IContextMenuService,
		@IQueryModelService private _queryModelService: IQueryModelService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IBootstrapService private _bootstrapService: IBootstrapService
	) {
		super(EditDataEditor.ID, _telemetryService, themeService);
	}

	// PUBLIC METHODS ////////////////////////////////////////////////////////////

	// Getters and Setters
	public get editDataInput(): EditDataInput { return <EditDataInput>this.input; }
	public get uri(): string { return this.input ? this.editDataInput.uri.toString() : undefined; }
	public get tableName(): string { return this.editDataInput.tableName; }


	/**
	 * Called to create the editor in the parent builder.
	 */
	public createEditor(parent: Builder): void {
		const parentElement = parent.getHTMLElement();
		DOM.addClass(parentElement, 'side-by-side-editor');
		this._createTaskbar(parentElement);
		this._container = document.createElement('div');
		this._container.style.height = 'calc(100% - 28px)';
		DOM.append(parentElement, this._container);
	}

	/**
	 * Sets the input data for this editor.
	 */
	public setInput(newInput: EditDataInput, options?: EditorOptions): TPromise<void> {
		let oldInput = <EditDataInput>this.input;
		if (!newInput.setup) {
			this._initialized = false;
			this._register(newInput.updateTaskbar((owner) => this._updateTaskbar(owner)));
			this._register(newInput.editorInitializing((initializing) => this.onEditorInitializingChanged(initializing)));
			this._register(newInput.showTableView(() => this._showTableView()));
			newInput.onRowDropDownSet(this._changeMaxRowsActionItem.defaultRowCount);
			newInput.setupComplete();
		}

		return super.setInput(newInput, options)
			.then(() => this._updateInput(oldInput, newInput, options));
	}

	private onEditorInitializingChanged(initializing: boolean): void {
		if (initializing) {
			this.showSpinner();
		} else {
			this._initialized = true;
			this.hideSpinner();
		}
	}

	/**
	 * Show the spinner element that shows something is happening, hidden by default
	 */
	public showSpinner(): void {
		setTimeout(() => {
			if (!this._initialized) {
				this._spinnerElement.style.visibility = 'visible';
			}
		}, 200);
	}

	/**
	 * Hide the spinner element to show that something was happening, hidden by default
	 */
	public hideSpinner(): void {
		this._spinnerElement.style.visibility = 'hidden';
	}

	/**
	 * Sets this editor and the sub-editors to visible.
	 */
	public setEditorVisible(visible: boolean, position: Position): void {
		super.setEditorVisible(visible, position);
	}

	/**
	 * Changes the position of the editor.
	 */
	public changePosition(position: Position): void {
		super.changePosition(position);
	}

	/**
	 * Called to indicate to the editor that the input should be cleared and resources associated with the
	 * input should be freed.
	 */
	public clearInput(): void {
		this._disposeEditors();
		super.clearInput();
	}

	/**
	 * Updates the internal variable keeping track of the editor's size, and re-calculates the sash position.
	 * To be called when the container of this editor changes size.
	 */
	public layout(dimension: Dimension): void {
		this._dimension = dimension;
		let input: EditDataInput = <EditDataInput>this.input;
		if (input) {
			let uri: string = input.uri;
			if (uri) {
				this._queryModelService.resizeResultsets(uri);
			}
		}
	}

	public dispose(): void {
		this._disposeEditors();
		super.dispose();
	}

	public close(): void {
		this.input.close();
	}

	/**
	 * Returns true if the results table for the current edit data session is visible
	 * Public for testing only.
	 */
	public _isResultsEditorVisible(): boolean {
		if (!this.editDataInput) {
			return false;
		}
		return this.editDataInput.visible;
	}

	/**
	 * Makes visible the results table for the current edit data session
	 */
	private _showTableView(): void {
		if (this._isResultsEditorVisible()) {
			return;
		}

		this._createTableViewContainer();
		this._setTableViewVisible();
		this.setInput(this.editDataInput, this.options);
	}

	// PRIVATE METHODS ////////////////////////////////////////////////////////////
	private _updateTaskbar(owner: EditDataInput): void {
		// Update the taskbar if the owner of this call is being presented
		if (owner.matches(this.editDataInput)) {
			this._refreshTableAction.enabled = owner.refreshButtonEnabled;
			this._stopRefreshTableAction.enabled = owner.stopButtonEnabled;
			this._changeMaxRowsActionItem.setCurrentOptionIndex = owner.rowLimit;
		}
	}

	private _createTaskbar(parentElement: HTMLElement): void {
		// Create QueryTaskbar
		this._taskbarContainer = DOM.append(parentElement, DOM.$('div'));
		this._taskbar = new Taskbar(this._taskbarContainer, this._contextMenuService, {
			actionItemProvider: (action: Action) => this._getChangeMaxRowsAction(action)
		});

		// Create Actions for the toolbar
		this._stopRefreshTableAction = this._instantiationService.createInstance(StopRefreshTableAction, this);
		this._refreshTableAction = this._instantiationService.createInstance(RefreshTableAction, this);
		this._changeMaxRowsAction = this._instantiationService.createInstance(ChangeMaxRowsAction, this);

		// Create HTML Elements for the taskbar
		let separator = Taskbar.createTaskbarSeparator();
		let textSeperator = Taskbar.createTaskbarText(nls.localize('maxRowTaskbar', 'Max Rows:'));

		this._spinnerElement = Taskbar.createTaskbarSpinner();
		// Set the content in the order we desire
		let content: ITaskbarContent[] = [
			{ action: this._stopRefreshTableAction },
			{ action: this._refreshTableAction },
			{ element: separator },
			{ element: textSeperator },
			{ action: this._changeMaxRowsAction },
			{ element: this._spinnerElement }
		];
		this._taskbar.setContent(content);
	}

	/**
	 * Gets the IActionItem for the list of row number drop down
	 */
	private _getChangeMaxRowsAction(action: Action): IActionItem {
		let actionID = ChangeMaxRowsAction.ID;
		if (action.id === actionID) {
			if (!this._changeMaxRowsActionItem) {
				this._changeMaxRowsActionItem = this._instantiationService.createInstance(ChangeMaxRowsActionItem, this);
			}
			return this._changeMaxRowsActionItem;
		}

		return null;
	}

	/**
	 * Handles setting input for this editor. If this new input does not match the old input (e.g. a new file
	 * has been opened with the same editor, or we are opening the editor for the first time).
	 */
	private _updateInput(oldInput: EditDataInput, newInput: EditDataInput, options?: EditorOptions): TPromise<void> {
		let returnValue: TPromise<void>;

		if (!newInput.matches(oldInput)) {
			this._disposeEditors();

			if (this._isResultsEditorVisible()) {
				this._createTableViewContainer();
				let uri: string = newInput.uri;
				if (uri) {
					this._queryModelService.refreshResultsets(uri);
				}
			}

			returnValue = this._setNewInput(newInput, options);
		} else {
			this._setNewInput(newInput, options);
			returnValue = TPromise.as(null);
		}

		this._updateTaskbar(newInput);
		return returnValue;
	}

	/**
	 * Handles setting input and creating editors when this QueryEditor is either:
	 * - Opened for the first time
	 * - Opened with a new EditDataInput
	 */
	private _setNewInput(newInput: EditDataInput, options?: EditorOptions): TPromise<void> {
		if (this._isResultsEditorVisible()) {
			// If both editors exist, create a joined promise and wait for both editors to be created
			return this._bootstrapAngularAndResults(newInput, options);
		}

		return TPromise.as(undefined);
	}
	/**
	 * Appends the HTML for the edit data table view
	 */
	private _createTableViewContainer() {
		if (!this.editDataInput.container) {
			this.editDataInput.container = DOM.append(this._container, DOM.$('.editDataContainer'));
			this.editDataInput.container.style.height = '100%';
		} else {
			DOM.append(this._container, this.editDataInput.container);
		}
	}

	private _disposeEditors(): void {
		if (this._container) {
			new Builder(this._container).clearChildren();
		}
	}

	/**
	 * Load the angular components and record for this input that we have done so
	 */
	private _bootstrapAngularAndResults(input: EditDataInput, options: EditorOptions): TPromise<void> {
		super.setInput(input, options);
		if (!input.hasBootstrapped) {
			let uri = this.editDataInput.uri;

			// Pass the correct DataService to the new angular component
			let dataService = this._queryModelService.getDataService(uri);
			if (!dataService) {
				throw new Error('DataService not found for URI: ' + uri);
			}

			// Mark that we have bootstrapped
			input.setBootstrappedTrue();

			// Get the bootstrap params and perform the bootstrap
			// Note: pass in input so on disposal this is cleaned up.
			// Otherwise many components will be left around and be subscribed
			// to events from the backing data service
			const parent = this.editDataInput.container;
			let params: EditDataComponentParams = {
				dataService: dataService
			};
			this._bootstrapService.bootstrap(
				EditDataModule,
				parent,
				EDITDATA_SELECTOR,
				params,
				this.editDataInput);
		}
		return TPromise.wrap<void>(null);
	}

	private _setTableViewVisible(): void {
		this.editDataInput.setVisibleTrue();
	}
}
