/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { Widget } from 'vs/base/browser/ui/widget';
import { FindInput, IFindInputOptions } from 'vs/base/browser/ui/findinput/findInput';
import { IFocusTracker, append, $, trackFocus } from 'vs/base/browser/dom';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { Emitter, Event } from 'vs/base/common/event';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import * as Constants from 'sql/workbench/contrib/notebook/common/constants';
import { IMessage, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { appendKeyBindingLabel } from 'vs/workbench/contrib/search/browser/searchActions';
import { ContextScopedFindInput } from 'vs/platform/browser/contextScopedHistoryWidget';
import { attachFindReplaceInputBoxStyler } from 'vs/platform/theme/common/styler';
import { KeyCode } from 'vs/base/common/keyCodes';
import { Extensions as ViewContainerExtensions, IViewDescriptor, IViewsRegistry, IViewDescriptorService } from 'vs/workbench/common/views';
import { Registry } from 'vs/platform/registry/common/platform';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { NotebookSearchView } from 'sql/workbench/contrib/notebook/browser/notebookExplorer/notebookSearch';
import { ViewPaneContainer } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { IChangeEvent } from 'vs/workbench/contrib/search/common/searchModel';
import { ISearchWidgetOptions, stopPropagationForMultiLineUpwards, stopPropagationForMultiLineDownwards, ctrlKeyMod } from 'vs/workbench/contrib/search/browser/searchWidget';
import { Delayer } from 'vs/base/common/async';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { QueryBuilder, ITextQueryBuilderOptions } from 'vs/workbench/contrib/search/common/queryBuilder';
import { ITextQuery, IFolderQuery, IPatternInfo } from 'vs/workbench/services/search/common/search';
import { getOutOfWorkspaceEditorResources } from 'vs/workbench/contrib/search/common/search';
import { URI } from 'vs/base/common/uri';
import { TreeViewPane } from 'sql/workbench/browser/parts/views/treeView';
import { isString } from 'vs/base/common/types';
import * as path from 'vs/base/common/path';
import { IFileService } from 'vs/platform/files/common/files';

export interface INotebookExplorerSearchOptions extends ISearchWidgetOptions {
	showSearchResultsPane?: boolean;
	/**
	 * Custom search function
	*/
	doSearch(query: any): Promise<void>;
}
export class NotebookSearchWidget extends Widget {

	domNode!: HTMLElement;

	searchInput!: FindInput;
	searchInputFocusTracker!: IFocusTracker;
	private inputBoxFocused: IContextKey<boolean>;
	public triggerQueryDelayer: Delayer<void>;
	private pauseSearching = false;
	private queryBuilder: QueryBuilder;
	private static readonly MAX_TEXT_RESULTS = 10000;

	private searchInputBoxFocused: IContextKey<boolean>;
	private ignoreGlobalFindBufferOnNextFocus = false;
	private previousGlobalFindBufferValue: string | undefined = undefined;

	private _onSearchSubmit = this._register(new Emitter<{ triggeredOnType: boolean, delay: number }>());
	readonly onSearchSubmit: Event<{ triggeredOnType: boolean, delay: number }> = this._onSearchSubmit.event;

	private _onSearchCancel = this._register(new Emitter<{ focus: boolean }>());
	readonly onSearchCancel: Event<{ focus: boolean }> = this._onSearchCancel.event;

	private _onBlur = this._register(new Emitter<void>());
	readonly onBlur: Event<void> = this._onBlur.event;

	private _onDidHeightChange = this._register(new Emitter<void>());
	readonly onDidHeightChange: Event<void> = this._onDidHeightChange.event;

	private _onPreserveCaseChange = this._register(new Emitter<boolean>());
	readonly onPreserveCaseChange: Event<boolean> = this._onPreserveCaseChange.event;

	constructor(
		container: HTMLElement,
		options: INotebookExplorerSearchOptions,
		private parentContainer: ViewPaneContainer,
		viewletId: string,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IThemeService private readonly themeService: IThemeService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IKeybindingService private readonly keyBindingService: IKeybindingService,
		@IClipboardService private readonly clipboardServce: IClipboardService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IAccessibilityService private readonly accessibilityService: IAccessibilityService,
		@IViewDescriptorService protected viewDescriptorService: IViewDescriptorService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IFileService private readonly fileService: IFileService,
	) {
		super();
		this.searchInputBoxFocused = Constants.SearchInputBoxFocusedKey.bindTo(this.contextKeyService);
		this.inputBoxFocused = Constants.InputBoxFocusedKey.bindTo(this.contextKeyService);
		this.triggerQueryDelayer = this._register(new Delayer<void>(0));
		this.queryBuilder = this.instantiationService.createInstance(QueryBuilder);

		this.render(container, options);

		this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('editor.accessibilitySupport')) {
				this.updateAccessibilitySupport();
			}
		});
		this.accessibilityService.onDidChangeScreenReaderOptimized(() => this.updateAccessibilitySupport());
		this.updateAccessibilitySupport();

		if (options.showSearchResultsPane) {
			let viewDescriptors = [];
			viewDescriptors.push(this.createSearchResultsViewDescriptor());
			const container = this.viewDescriptorService.getViewContainerById(viewletId);
			Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews(viewDescriptors, container);
		}

		this._register(this.onSearchSubmit(ops => this.triggerQueryChange(ops)));
		this._register(this.onSearchCancel(({ focus }) => this.cancelSearch(focus)));
		this._register(this.searchInput.onDidOptionChange(() => this.triggerQueryChange()));

		this._register(this.onDidHeightChange(() => this.searchView?.reLayout()));

		this._register(this.onPreserveCaseChange(async (state) => {
			if (this.searchView?.searchViewModel) {
				this.searchView.searchViewModel.preserveCase = state;
				await this.refreshTree();
			}
		}));

		this._register(this.searchInput.onInput(() => this.searchView?.updateActions()));

		this.trackInputBox(this.searchInputFocusTracker);
	}

	createSearchResultsViewDescriptor(): IViewDescriptor {
		return {
			id: NotebookSearchView.ID,
			name: localize('notebookExplorer.searchResults', "Search Results"),
			ctorDescriptor: new SyncDescriptor(NotebookSearchView),
			weight: 100,
			canToggleVisibility: true,
			hideByDefault: false,
			order: 0,
			collapsed: true
		};
	}

	public get searchView(): NotebookSearchView | undefined {
		return <NotebookSearchView>this.parentContainer.getView(NotebookSearchView.ID) ?? undefined;
	}

	searchInputHasFocus(): boolean {
		return !!this.searchInputBoxFocused.get();
	}

	private render(container: HTMLElement, options: INotebookExplorerSearchOptions): void {
		this.domNode = append(container, $('.search-widget'));
		this.domNode.style.position = 'relative';

		this.renderSearchInput(this.domNode, options);
	}

	focus(select: boolean = true): void {
		this.ignoreGlobalFindBufferOnNextFocus = this.searchConfig.seedOnFocus;

		this.searchInput.focus();
		if (select) {
			this.searchInput.select();
		}
	}

	clear() {
		this.searchInput.clear();
	}

	private renderSearchInput(parent: HTMLElement, options: INotebookExplorerSearchOptions): void {
		const inputOptions: IFindInputOptions = {
			label: localize('label.Search', 'Search: Type Search Term and press Enter to search or Escape to cancel'),
			validation: (value: string) => this.validateSearchInput(value),
			placeholder: localize('search.placeHolder', "Search"),
			appendCaseSensitiveLabel: appendKeyBindingLabel('', this.keyBindingService.lookupKeybinding(Constants.ToggleCaseSensitiveCommandId), this.keyBindingService),
			appendWholeWordsLabel: appendKeyBindingLabel('', this.keyBindingService.lookupKeybinding(Constants.ToggleWholeWordCommandId), this.keyBindingService),
			appendRegexLabel: appendKeyBindingLabel('', this.keyBindingService.lookupKeybinding(Constants.ToggleRegexCommandId), this.keyBindingService),
			history: options.searchHistory,
			flexibleHeight: true
		};

		const searchInputContainer = append(parent, $('.search-container.input-box'));
		this.searchInput = this._register(new ContextScopedFindInput(searchInputContainer, this.contextViewService, inputOptions, this.contextKeyService, true));
		this._register(attachFindReplaceInputBoxStyler(this.searchInput, this.themeService));
		this.searchInput.onKeyDown((keyboardEvent: IKeyboardEvent) => this.onSearchInputKeyDown(keyboardEvent));
		this.searchInput.setValue(options.value || '');
		this.searchInput.setRegex(!!options.isRegex);
		this.searchInput.setCaseSensitive(!!options.isCaseSensitive);
		this.searchInput.setWholeWords(!!options.isWholeWords);
		this._register(this.searchInput.inputBox.onDidChange(() => this.onSearchInputChanged()));
		this._register(this.searchInput.inputBox.onDidHeightChange(() => this._onDidHeightChange.fire()));

		this.searchInputFocusTracker = this._register(trackFocus(this.searchInput.inputBox.inputElement));
		this._register(this.searchInputFocusTracker.onDidFocus(async () => {
			this.searchInputBoxFocused.set(true);

			const useGlobalFindBuffer = this.searchConfiguration.globalFindClipboard;
			if (!this.ignoreGlobalFindBufferOnNextFocus && useGlobalFindBuffer) {
				const globalBufferText = await this.clipboardServce.readFindText();
				if (this.previousGlobalFindBufferValue !== globalBufferText) {
					this.searchInput.inputBox.addToHistory();
					this.searchInput.setValue(globalBufferText);
					this.searchInput.select();
				}

				this.previousGlobalFindBufferValue = globalBufferText;
			}

			this.ignoreGlobalFindBufferOnNextFocus = false;
		}));
		this._register(this.searchInputFocusTracker.onDidBlur(() => this.searchInputBoxFocused.set(false)));
	}

	private onSearchInputChanged(): void {
		this.searchInput.clearMessage();

		if (this.searchConfiguration.searchOnType) {
			if (this.searchInput.getRegex()) {
				try {
					const regex = new RegExp(this.searchInput.getValue(), 'ug');
					const matchienessHeuristic = `
								~!@#$%^&*()_+
								\`1234567890-=
								qwertyuiop[]\\
								QWERTYUIOP{}|
								asdfghjkl;'
								ASDFGHJKL:"
								zxcvbnm,./
								ZXCVBNM<>? `.match(regex)?.length ?? 0;

					const delayMultiplier =
						matchienessHeuristic < 50 ? 1 :
							matchienessHeuristic < 100 ? 5 : // expressions like `.` or `\w`
								10; // only things matching empty string

					this.submitSearch(true, this.searchConfiguration.searchOnTypeDebouncePeriod * delayMultiplier);
				} catch {
					// pass
				}
			} else {
				this.submitSearch(true, this.searchConfiguration.searchOnTypeDebouncePeriod);
			}
		}
	}

	private submitSearch(triggeredOnType = false, delay: number = 0): void {
		this.searchInput.validate();
		if (!this.searchInput.inputBox.isInputValid()) {
			return;
		}

		const value = this.searchInput.getValue();
		const useGlobalFindBuffer = this.searchConfiguration.globalFindClipboard;
		if (value && useGlobalFindBuffer) {
			this.clipboardServce.writeFindText(value);
		}
		this._onSearchSubmit.fire({ triggeredOnType, delay });
	}

	public triggerQueryChange(_options?: { preserveFocus?: boolean, triggeredOnType?: boolean, delay?: number }) {
		const options = { preserveFocus: true, triggeredOnType: false, delay: 0, ..._options };

		if (!this.pauseSearching) {
			this.triggerQueryDelayer.trigger(() => {
				this._onQueryChanged(options.preserveFocus, options.triggeredOnType);
			}, options.delay);
		}
	}

	private _onQueryChanged(preserveFocus: boolean, triggeredOnType = false): void {
		if (!this.searchInput.inputBox.isInputValid()) {
			return;
		}

		const isRegex = this.searchInput.getRegex();
		const isWholeWords = this.searchInput.getWholeWords();
		const isCaseSensitive = this.searchInput.getCaseSensitive();
		const contentPattern = this.searchInput.getValue();

		if (contentPattern.length === 0) {
			this.clearSearchResults(false);
			this.updateViewletsState();
			return;
		}

		const content: IPatternInfo = {
			pattern: contentPattern,
			isRegExp: isRegex,
			isCaseSensitive: isCaseSensitive,
			isWordMatch: isWholeWords
		};

		const excludePattern = undefined;
		const includePattern = undefined;

		// Need the full match line to correctly calculate replace text, if this is a search/replace with regex group references ($1, $2, ...).
		// 10000 chars is enough to avoid sending huge amounts of text around, if you do a replace with a longer match, it may or may not resolve the group refs correctly.
		// https://github.com/Microsoft/vscode/issues/58374
		const charsPerLine = content.isRegExp ? 10000 : 1000;

		const options: ITextQueryBuilderOptions = {
			_reason: 'searchView',
			extraFileResources: this.instantiationService.invokeFunction(getOutOfWorkspaceEditorResources),
			maxResults: NotebookSearchWidget.MAX_TEXT_RESULTS,
			disregardIgnoreFiles: undefined,
			disregardExcludeSettings: undefined,
			excludePattern,
			includePattern,
			previewOptions: {
				matchLines: 1,
				charsPerLine
			},
			isSmartCase: this.searchConfig.smartCase,
			expandPatterns: true
		};

		const onQueryValidationError = (err: Error) => {
			this.searchInput.showMessage({ content: err.message, type: MessageType.ERROR });
			this.searchView?.clearSearchResults();
		};

		let query: ITextQuery;
		try {
			query = this.queryBuilder.text(content, [], options);
		} catch (err) {
			onQueryValidationError(err);
			return;
		}

		this.validateQuery(query).then(() => {
			if (this.parentContainer.views.length > 1) {
				let filesToIncludeFiltered: string = '';
				this.parentContainer.views.forEach(async (v) => {
					let booksViewPane = (<TreeViewPane>this.parentContainer.getView(v.id));
					if (booksViewPane?.treeView?.root) {
						let root = booksViewPane.treeView.root;
						if (root.children) {
							let items = root.children;
							items?.forEach(root => {
								this.updateViewletsState();
								let folderToSearch: IFolderQuery = { folder: URI.file(path.join(isString(root.tooltip) ? root.tooltip : root.tooltip.value, 'content')) };
								query.folderQueries.push(folderToSearch);
								filesToIncludeFiltered = filesToIncludeFiltered + path.join(folderToSearch.folder.fsPath, '**', '*.md') + ',' + path.join(folderToSearch.folder.fsPath, '**', '*.ipynb') + ',';
								this.searchView?.startSearch(query, null, filesToIncludeFiltered, false, this);
							});
						}
					}
				});
			}

			if (!preserveFocus) {
				this.focus(false); // focus back to input field
			}
		}, onQueryValidationError);
	}


	updateViewletsState(): void {
		let containerModel = this.viewDescriptorService.getViewContainerModel(this.parentContainer.viewContainer);
		let visibleViewDescriptors = containerModel.visibleViewDescriptors;

		if (this.searchInput.getValue().length > 0) {
			if (visibleViewDescriptors.length > 1) {
				let allViews = containerModel.allViewDescriptors;
				allViews.forEach(v => {
					let view = this.parentContainer.getView(v.id);
					if (view !== this.searchView) {
						view.setExpanded(false);
					}
				});
				this.searchView?.setExpanded(true);
			}
		} else {
			let allViews = containerModel.allViewDescriptors;
			allViews.forEach(view => {
				this.parentContainer.getView(view.id).setExpanded(true);
			});
			this.searchView?.setExpanded(false);
		}
	}

	clearSearchResults(clearInput = true): void {
		this.searchView?.clearSearchResults(clearInput);

		if (clearInput) {
			this.clear();
		}
	}

	private async validateQuery(query: ITextQuery): Promise<void> {
		// Validate folderQueries
		const folderQueriesExistP =
			query.folderQueries.map(fq => {
				return this.fileService.exists(fq.folder);
			});

		return Promise.all(folderQueriesExistP).then(existResults => {
			// If no folders exist, show an error message about the first one
			const existingFolderQueries = query.folderQueries.filter((folderQuery, i) => existResults[i]);
			if (!query.folderQueries.length || existingFolderQueries.length) {
				query.folderQueries = existingFolderQueries;
			} else {
				const nonExistantPath = query.folderQueries[0].folder.fsPath;
				const searchPathNotFoundError = localize('searchPathNotFoundError', "Search path not found: {0}", nonExistantPath);
				return Promise.reject(new Error(searchPathNotFoundError));
			}

			return undefined;
		});
	}



	private validateSearchInput(value: string): IMessage | undefined {
		if (value.length === 0) {
			return undefined;
		}
		if (!this.searchInput.getRegex()) {
			return undefined;
		}
		try {
			new RegExp(value, 'u');
		} catch (e) {
			return { content: e.message };
		}

		return undefined;
	}

	private onSearchInputKeyDown(keyboardEvent: IKeyboardEvent) {
		if (keyboardEvent.equals(ctrlKeyMod | KeyCode.Enter)) {
			this.searchInput.inputBox.insertAtCursor('\n');
			keyboardEvent.preventDefault();
		}

		if (keyboardEvent.equals(KeyCode.Enter)) {
			this.searchInput.onSearchSubmit();
			this.submitSearch();
			keyboardEvent.preventDefault();
		}

		else if (keyboardEvent.equals(KeyCode.Escape)) {
			this._onSearchCancel.fire({ focus: true });
			keyboardEvent.preventDefault();
		}

		else if (keyboardEvent.equals(KeyCode.Tab)) {
			this.searchInput.focusOnCaseSensitive();
			keyboardEvent.preventDefault();
		}

		else if (keyboardEvent.equals(KeyCode.UpArrow)) {
			stopPropagationForMultiLineUpwards(keyboardEvent, this.searchInput.getValue(), this.searchInput.domNode.querySelector('textarea'));
		}

		else if (keyboardEvent.equals(KeyCode.DownArrow)) {
			stopPropagationForMultiLineDownwards(keyboardEvent, this.searchInput.getValue(), this.searchInput.domNode.querySelector('textarea'));
		}
	}


	private updateAccessibilitySupport(): void {
		this.searchInput.setFocusInputOnOptionClick(!this.accessibilityService.isScreenReaderOptimized());
	}

	private get searchConfiguration(): Constants.INotebookSearchConfigurationProperties {
		return this.configurationService.getValue<Constants.INotebookSearchConfigurationProperties>('notebookExplorerSearch');
	}

	cancelSearch(focus: boolean = true): boolean {
		if (focus) {
			this.searchView?.cancelSearch(focus);
			this.focus();
			return true;
		}
		return false;
	}

	async refreshTree(event?: IChangeEvent): Promise<void> {
		await this.searchView?.refreshTree(event);
	}

	public get searchConfig(): Constants.INotebookSearchConfigurationProperties {
		return this.configurationService.getValue<Constants.INotebookSearchConfigurationProperties>('notebookExplorerSearch');
	}

	private trackInputBox(inputFocusTracker: IFocusTracker, contextKey?: IContextKey<boolean>): void {
		this._register(inputFocusTracker.onDidFocus(() => {
			this.inputBoxFocused.set(true);
			contextKey?.set(true);
		}));
		this._register(inputFocusTracker.onDidBlur(() => {
			this.inputBoxFocused.set(this.searchInputHasFocus());
			contextKey?.set(false);
		}));
	}
}
