/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { EditorOptions } from 'vs/workbench/common/editor';
import * as DOM from 'vs/base/browser/dom';
import { bootstrapAngular } from 'sql/platform/bootstrap/browser/bootstrapService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CancellationToken } from 'vs/base/common/cancellation';
import { NotebookInput } from 'sql/workbench/parts/notebook/common/models/notebookInput';
import { NotebookModule } from 'sql/workbench/parts/notebook/browser/notebook.module';
import { NOTEBOOK_SELECTOR } from 'sql/workbench/parts/notebook/browser/notebook.component';
import { INotebookParams } from 'sql/workbench/services/notebook/common/notebookService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ACTION_IDS, PROFILER_MAX_MATCHES, INotebookController, FindWidget, IConfigurationChangedEvent } from 'sql/workbench/parts/notebook/browser/notebookFindWidget';
import { IOverlayWidget } from 'vs/editor/browser/editorBrowser';
import { FindReplaceState, FindReplaceStateChangedEvent } from 'vs/editor/contrib/find/findState';
import { IEditorAction } from 'vs/editor/common/editorCommon';
import { Event, Emitter } from 'vs/base/common/event';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { NotebookFindNext, NotebookFindPrevious } from 'sql/workbench/parts/notebook/browser/notebookActions';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { INotebookModel } from 'sql/workbench/parts/notebook/common/models/modelInterfaces';

export class NotebookEditor extends BaseEditor implements INotebookController {

	public static ID: string = 'workbench.editor.notebookEditor';
	private _notebookContainer: HTMLElement;
	private _currentDimensions: DOM.Dimension;
	private _overlay: HTMLElement;
	private _findState: FindReplaceState;
	private _finder: FindWidget;
	private _actionMap: { [x: string]: IEditorAction } = {};
	private _onDidChangeConfiguration = new Emitter<IConfigurationChangedEvent>();
	public onDidChangeConfiguration: Event<IConfigurationChangedEvent> = this._onDidChangeConfiguration.event;


	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IKeybindingService private _keybindingService: IKeybindingService,
		@IContextKeyService private _contextKeyService: IContextKeyService,
		@IWorkbenchThemeService private _themeService: IWorkbenchThemeService
	) {
		super(NotebookEditor.ID, telemetryService, themeService, storageService);

		this._actionMap[ACTION_IDS.FIND_NEXT] = this._instantiationService.createInstance(NotebookFindNext, this);
		this._actionMap[ACTION_IDS.FIND_PREVIOUS] = this._instantiationService.createInstance(NotebookFindPrevious, this);
	}

	public get notebookInput(): NotebookInput {
		return this.input as NotebookInput;
	}

	public get notebookModel(): INotebookModel {
		let model: INotebookModel;
		this.notebookInput.resolve().then(m => {
			model = m.getNotebookModel();
		});
		return model;
	}

    /**
     * Called to create the editor in the parent element.
     */
	public createEditor(parent: HTMLElement): void {
		this._overlay = document.createElement('div');
		this._overlay.className = 'overlayWidgets';
		this._overlay.style.width = '100%';
		this._overlay.style.zIndex = '4';
		parent.appendChild(this._overlay);

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

    /**
     * Sets focus on this editor. Specifically, it sets the focus on the hosted text editor.
     */
	public focus(): void {
	}

    /**
     * Updates the internal variable keeping track of the editor's size, and re-calculates the sash position.
     * To be called when the container of this editor changes size.
     */
	public layout(dimension: DOM.Dimension): void {
		this._currentDimensions = dimension;
		if (this.notebookInput) {
			this.notebookInput.doChangeLayout();
		}
	}

	public setInput(input: NotebookInput, options: EditorOptions): Promise<void> {
		if (this.input && this.input.matches(input)) {
			return Promise.resolve(undefined);
		}

		const parentElement = this.getContainer();

		super.setInput(input, options, CancellationToken.None);

		DOM.clearNode(parentElement);

		if (!input.hasBootstrapped) {
			let container = DOM.$<HTMLElement>('.notebookEditor');
			container.style.height = '100%';
			this._notebookContainer = DOM.append(parentElement, container);
			input.container = this._notebookContainer;
			return Promise.resolve(this.bootstrapAngular(input));
		} else {
			this._notebookContainer = DOM.append(parentElement, input.container);
			input.doChangeLayout();
			return Promise.resolve(null);
		}
	}

    /**
     * Load the angular components and record for this input that we have done so
     */
	private bootstrapAngular(input: NotebookInput): void {
		// Get the bootstrap params and perform the bootstrap
		input.hasBootstrapped = true;
		let params: INotebookParams = {
			notebookUri: input.notebookUri,
			input: input,
			providerInfo: input.getProviderInfo(),
			profile: input.connectionProfile
		};
		bootstrapAngular(this._instantiationService,
			NotebookModule,
			this._notebookContainer,
			NOTEBOOK_SELECTOR,
			params,
			input
		);
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
			if (this.notebookInput && this.notebookInput.data) {
				if (this._findState.searchString) {
					this.notebookInput.data.find(this._findState.searchString, PROFILER_MAX_MATCHES).then(p => {
						if (p) {
							// TODO: set active cell
							// this.notebookModel.activeCell = p;
							this._updateFinderMatchState();
							this._finder.focusFindInput();
						}
					});
				} else {
					this.notebookInput.data.clearFind();
				}
			}
		}
	}

	public findNext(): void {
		this.notebookModel.findNext().then(p => {
			// TODO: set active cell
			// this.notebookModel.activeCell = p;
			this._updateFinderMatchState();
		}, er => { });
	}

	public findPrevious(): void {
		this.notebookModel.findPrevious().then(p => {
			// TODO: set active cell
			// this.notebookModel.activeCell = p;
			this._updateFinderMatchState();
		}, er => { });
	}

	private _updateFinderMatchState(): void {
		if (this.notebookInput && this.notebookInput.data) {
			this._findState.changeMatchInfo(this.notebookInput.data.findPosition, this.notebookInput.data.findCount, undefined);
		} else {
			this._findState.changeMatchInfo(0, 0, undefined);
		}
	}
}

