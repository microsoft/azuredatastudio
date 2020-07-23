/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { EditorOptions } from 'vs/workbench/common/editor';
import * as DOM from 'vs/base/browser/dom';
import { bootstrapAngular } from 'sql/workbench/services/bootstrap/browser/bootstrapService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { CancellationToken } from 'vs/base/common/cancellation';
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { NotebookModule } from 'sql/workbench/contrib/notebook/browser/notebook.module';
import { NOTEBOOK_SELECTOR } from 'sql/workbench/contrib/notebook/browser/notebook.component';
import { INotebookParams, INotebookService, NotebookRange } from 'sql/workbench/services/notebook/browser/notebookService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ACTION_IDS, NOTEBOOK_MAX_MATCHES, IFindNotebookController, FindWidget, IConfigurationChangedEvent } from 'sql/workbench/contrib/notebook/browser/find/notebookFindWidget';
import { IOverlayWidget } from 'vs/editor/browser/editorBrowser';
import { FindReplaceState, FindReplaceStateChangedEvent } from 'vs/editor/contrib/find/findState';
import { IEditorAction } from 'vs/editor/common/editorCommon';
import { Event, Emitter } from 'vs/base/common/event';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { NotebookFindNextAction, NotebookFindPreviousAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { INotebookModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { INotebookFindModel } from 'sql/workbench/contrib/notebook/browser/models/notebookFindModel';
import { IDisposable, DisposableStore } from 'vs/base/common/lifecycle';
import { IModelDecorationsChangeAccessor, IModelDeltaDecoration } from 'vs/editor/common/model';
import { NotebookFindDecorations } from 'sql/workbench/contrib/notebook/browser/find/notebookFindDecorations';
import { TimeoutTimer } from 'vs/base/common/async';
import { BaseTextEditor } from 'vs/workbench/browser/parts/editor/textEditor';
import { onUnexpectedError } from 'vs/base/common/errors';

export class NotebookEditor extends BaseEditor implements IFindNotebookController {

	public static ID: string = 'workbench.editor.notebookEditor';
	private _notebookContainer: HTMLElement;
	private _currentDimensions: DOM.Dimension;
	private _overlay: HTMLElement;
	private _findState: FindReplaceState;
	private _finder: FindWidget;
	private _actionMap: { [x: string]: IEditorAction } = {};
	private _onDidChangeConfiguration = new Emitter<IConfigurationChangedEvent>();
	public onDidChangeConfiguration: Event<IConfigurationChangedEvent> = this._onDidChangeConfiguration.event;
	private _notebookModel: INotebookModel;
	private _findCountChangeListener: IDisposable;
	private _currentMatch: NotebookRange;
	private _previousMatch: NotebookRange;
	private readonly _toDispose = new DisposableStore();
	private readonly _startSearchingTimer: TimeoutTimer;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IKeybindingService private _keybindingService: IKeybindingService,
		@IContextKeyService private _contextKeyService: IContextKeyService,
		@IWorkbenchThemeService private _themeService: IWorkbenchThemeService,
		@INotebookService private _notebookService?: INotebookService
	) {
		super(NotebookEditor.ID, telemetryService, themeService, storageService);
		this._startSearchingTimer = new TimeoutTimer();
		this._toDispose.add(this._startSearchingTimer);
		this._actionMap[ACTION_IDS.FIND_NEXT] = this._instantiationService.createInstance(NotebookFindNextAction, this);
		this._actionMap[ACTION_IDS.FIND_PREVIOUS] = this._instantiationService.createInstance(NotebookFindPreviousAction, this);
	}

	public dispose(): void {
		this._toDispose.dispose();
	}

	public get notebookInput(): NotebookInput {
		return this.input as NotebookInput;
	}

	private get _findDecorations(): NotebookFindDecorations {
		return this.notebookInput.notebookFindModel.findDecorations;
	}

	public getPosition(): NotebookRange {
		return this._currentMatch;
	}

	public getLastPosition(): NotebookRange {
		return this._previousMatch;
	}
	public getCellEditor(cellGuid: string): BaseTextEditor | undefined {
		let editorImpl = this._notebookService.findNotebookEditor(this.notebookInput.notebookUri);
		if (editorImpl) {
			let cellEditorProvider = editorImpl.cellEditors.filter(c => c.cellGuid() === cellGuid)[0];
			if (cellEditorProvider) {
				return cellEditorProvider.getEditor();
			}
		}
		return undefined;
	}

	// updateDecorations is only used for modifying decorations on markdown cells
	// changeDecorations is the function that handles the decorations w.r.t codeEditor cells.
	public updateDecorations(newDecorationRange: NotebookRange, oldDecorationRange: NotebookRange): void {
		let editorImpl = this._notebookService.findNotebookEditor(this.notebookInput.notebookUri);
		if (editorImpl) {
			editorImpl.deltaDecorations(newDecorationRange, oldDecorationRange);
		}
	}

	public changeDecorations(callback: (changeAccessor: IModelDecorationsChangeAccessor) => any): any {
		if (!this.notebookInput?.notebookFindModel) {
			// callback will not be called
			return null;
		}
		return this.notebookInput.notebookFindModel.changeDecorations(callback, undefined);
	}

	public deltaDecorations(oldDecorations: string[], newDecorations: IModelDeltaDecoration[]): string[] {
		return undefined;
	}

	async setNotebookModel(): Promise<void> {
		let notebookEditorModel = await this.notebookInput.resolve();
		if (notebookEditorModel && !this.notebookInput.notebookFindModel.notebookModel) {
			this._notebookModel = notebookEditorModel.getNotebookModel();
			this.notebookInput.notebookFindModel.notebookModel = this._notebookModel;
		}
		if (!this.notebookInput.notebookFindModel.findDecorations) {
			this.notebookInput.notebookFindModel.setNotebookFindDecorations(this);
		}
	}

	public async getNotebookModel(): Promise<INotebookModel> {
		if (!this._notebookModel) {
			await this.setNotebookModel();
		}
		return this._notebookModel;

	}

	public get notebookFindModel(): INotebookFindModel {
		return this.notebookInput.notebookFindModel;
	}

	/**
	 * @param parent Called to create the editor in the parent element.
	 */
	public createEditor(parent: HTMLElement): void {
		this._overlay = document.createElement('div');
		this._overlay.className = 'overlayWidgets monaco-editor';
		this._overlay.style.width = '100%';
		this._overlay.style.zIndex = '4';

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
		this._finder.getDomNode().style.visibility = 'hidden';
	}

	/**
	 * Sets focus on this editor. Specifically, it sets the focus on the hosted text editor.
	 * An implementation provided here for IFindNotebookController interface.
	 */
	public focus(): void {
		//no-op
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

	public async setInput(input: NotebookInput, options: EditorOptions): Promise<void> {
		if (this.input && this.input.matches(input)) {
			return Promise.resolve(undefined);
		}

		const parentElement = this.getContainer();

		await super.setInput(input, options, CancellationToken.None);
		DOM.clearNode(parentElement);
		await this.setFindInput(parentElement);
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

	private async setFindInput(parentElement: HTMLElement): Promise<void> {
		parentElement.appendChild(this._overlay);
		await this.setNotebookModel();
		if (this._findState.isRevealed) {
			this._triggerInputChange();
		} else {
			this._findDecorations.clearDecorations();
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
		this._instantiationService.invokeFunction(bootstrapAngular,
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
				width: this._currentDimensions ? this._currentDimensions.width : 0,
				height: this._currentDimensions ? this._currentDimensions.height : 0
			}
		};
	}

	public layoutOverlayWidget(widget: IOverlayWidget): void {
		// no op
	}

	public addOverlayWidget(widget: IOverlayWidget): void {
		let domNode = widget.getDomNode();
		domNode.style.right = '28px';
		domNode.style.top = '34px';
		this._overlay.appendChild(domNode);
		this._findState.change({ isRevealed: false }, false);
	}

	public getAction(id: string): IEditorAction {
		return this._actionMap[id];
	}

	private async _onFindStateChange(e: FindReplaceStateChangedEvent): Promise<void> {
		if (!this._notebookModel) {
			await this.setNotebookModel();
		}
		if (this._findCountChangeListener === undefined && this._notebookModel) {
			this._findCountChangeListener = this.notebookInput.notebookFindModel.onFindCountChange(() => this._updateFinderMatchState());
			this._toDispose.add(this._findCountChangeListener);
			this.registerModelChanges();
		}
		if (e.isRevealed) {
			if (this._findState.isRevealed) {
				this._finder.getDomNode().style.visibility = 'visible';
				this._finder.focusFindInput();
				this._updateFinderMatchState();
				// if find is closed and opened again, highlight the last position.
				this._findDecorations.setStartPosition(this.getPosition());
			} else {
				this._finder.getDomNode().style.visibility = 'hidden';
				this._findDecorations.clearDecorations();
				return;
			}
		} else {
			if (!this._findState.isRevealed) {
				this._finder.getDomNode().style.visibility = 'hidden';
				this._findDecorations.clearDecorations();
				return;
			}
		}

		if (e.searchString || e.matchCase || e.wholeWord) {
			this._findDecorations.clearDecorations();
			// if the search scope changes remove the prev
			if (this._notebookModel && this._findState.searchString) {
				let findScope = this._findDecorations.getFindScope();
				if (this._findState.searchString === this.notebookFindModel.findExpression && findScope && !e.matchCase && !e.wholeWord && !e.searchScope) {
					this._updateFinderMatchState();
					this._findState.changeMatchInfo(
						this.notebookFindModel.getFindIndex(),
						this._findDecorations.getCount(),
						this._currentMatch
					);
					this._setCurrentFindMatch(findScope);
				} else {
					this.notebookInput.notebookFindModel.clearDecorations();
					this.notebookFindModel.findExpression = this._findState.searchString;
					const findRange = await this.notebookInput.notebookFindModel.find(this._findState.searchString, this._findState.matchCase, this._findState.wholeWord, NOTEBOOK_MAX_MATCHES);
					if (findRange) {
						this.setSelection(findRange);
					} else if (this.notebookFindModel.findMatches.length > 0) {
						this.setSelection(this.notebookFindModel.findMatches[0].range);
					} else {
						this.notebookInput.notebookFindModel.clearFind();
						this._updateFinderMatchState();
						this._finder.focusFindInput();
						return;
					}
					this._updateFinderMatchState();
					this._finder.focusFindInput();
					this._findDecorations.set(this.notebookFindModel.findMatches, this._currentMatch);
					this._findState.changeMatchInfo(
						this.notebookFindModel.getFindIndex(),
						this._findDecorations.getCount(),
						this._currentMatch
					);
					this._setCurrentFindMatch(this._currentMatch);
				}
			} else {
				this.notebookFindModel.clearFind();
			}
		}
		if (e.searchScope) {
			await this.notebookInput.notebookFindModel.find(this._findState.searchString, this._findState.matchCase, this._findState.wholeWord, NOTEBOOK_MAX_MATCHES);
			this._findDecorations.set(this.notebookFindModel.findMatches, this._currentMatch);
			this._findState.changeMatchInfo(
				this.notebookFindModel.getIndexByRange(this._currentMatch),
				this._findDecorations.getCount(),
				this._currentMatch
			);
			if (this._finder.getDomNode().style.visibility === 'visible' && this._previousMatch !== this._currentMatch) {
				this._setCurrentFindMatch(this._currentMatch);
			}
		}
	}

	private registerModelChanges(): void {
		let changeEvent: FindReplaceStateChangedEvent = {
			moveCursor: true,
			updateHistory: true,
			searchString: false,
			replaceString: false,
			isRevealed: false,
			isReplaceRevealed: false,
			isRegex: false,
			wholeWord: false,
			matchCase: false,
			preserveCase: false,
			searchScope: true,
			matchesPosition: false,
			matchesCount: false,
			currentMatch: false,
			loop: true
		};
		this._notebookModel.cells.forEach(cell => {
			this._register(cell.onCellModeChanged((state) => {
				this._onFindStateChange(changeEvent).catch(onUnexpectedError);
			}));
		});
		this._register(this._notebookModel.contentChanged(e => {
			this._onFindStateChange(changeEvent).catch(onUnexpectedError);
		}));
		this._register(this._notebookService.onNotebookEditorAdd(async (e) => {
			// wait for the model to be ready and trigger input change
			await e.modelReady;
			this._triggerInputChange();
		}));
	}

	public setSelection(range: NotebookRange): void {
		this._previousMatch = this._currentMatch;
		this._currentMatch = range;
	}

	public toggleSearch(): void {
		// reveal only when the model is loaded
		let isRevealed: boolean = !this._findState.isRevealed && this._notebookModel ? !this._findState.isRevealed : false;
		this._findState.change({
			isRevealed: isRevealed
		}, false);
		if (this._findState.isRevealed) {
			this._finder.focusFindInput();
		}
	}

	public async findNext(): Promise<void> {
		try {
			const p = await this.notebookFindModel.findNext();
			this.setSelection(p);
			this._updateFinderMatchState();
			this._setCurrentFindMatch(p);
		} catch (er) {
			onUnexpectedError(er);
		}
	}

	public async findPrevious(): Promise<void> {
		try {
			const p = await this.notebookFindModel.findPrevious();
			this.setSelection(p);
			this._updateFinderMatchState();
			this._setCurrentFindMatch(p);
		} catch (er) {
			onUnexpectedError(er);
		}
	}

	private _updateFinderMatchState(): void {
		if (this.notebookInput && this.notebookInput.notebookFindModel) {
			this._findState.changeMatchInfo(this.notebookFindModel.getFindIndex(), this.notebookFindModel.getFindCount(), this._currentMatch);
		} else {
			this._findState.changeMatchInfo(0, 0, undefined);
		}
	}

	private _setCurrentFindMatch(match: NotebookRange): void {
		if (match) {
			this._notebookModel.updateActiveCell(match.cell);
			this._findDecorations.setCurrentFindMatch(match);
			this.setSelection(match);
		}
	}

	private _triggerInputChange(): void {
		let changeEvent: FindReplaceStateChangedEvent = {
			moveCursor: true,
			updateHistory: true,
			searchString: true,
			replaceString: false,
			isRevealed: false,
			isReplaceRevealed: false,
			isRegex: false,
			wholeWord: false,
			matchCase: false,
			preserveCase: false,
			searchScope: false,
			matchesPosition: false,
			matchesCount: false,
			currentMatch: false,
			loop: true
		};
		this._onFindStateChange(changeEvent).catch(e => { onUnexpectedError(e); });
	}
}
