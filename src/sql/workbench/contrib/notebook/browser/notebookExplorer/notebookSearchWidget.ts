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
import { IMessage } from 'vs/base/browser/ui/inputbox/inputBox';
import { appendKeyBindingLabel } from 'vs/workbench/contrib/search/browser/searchActions';
import { ContextScopedFindInput } from 'vs/platform/browser/contextScopedHistoryWidget';
import { attachFindReplaceInputBoxStyler } from 'vs/platform/theme/common/styler';
import { isMacintosh } from 'vs/base/common/platform';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';

export interface INotebookExplorerSearchOptions {
	value?: string;
	isRegex?: boolean;
	isCaseSensitive?: boolean;
	isWholeWords?: boolean;
	searchHistory?: string[];
	replaceHistory?: string[];
	preserveCase?: boolean;
	showContextToggle?: boolean;
}

const ctrlKeyMod = (isMacintosh ? KeyMod.WinCtrl : KeyMod.CtrlCmd);
export const SingleLineInputHeight = 24;
function stopPropagationForMultiLineUpwards(event: IKeyboardEvent, value: string, textarea: HTMLTextAreaElement | undefined) {
	const isMultiline = !!value.match(/\n/);
	if (textarea && (isMultiline || textarea.clientHeight > SingleLineInputHeight) && textarea.selectionStart > 0) {
		event.stopPropagation();
		return;
	}
}

function stopPropagationForMultiLineDownwards(event: IKeyboardEvent, value: string, textarea: HTMLTextAreaElement | undefined) {
	const isMultiline = !!value.match(/\n/);
	if (textarea && (isMultiline || textarea.clientHeight > SingleLineInputHeight) && textarea.selectionEnd < textarea.value.length) {
		event.stopPropagation();
		return;
	}
}

export class NotebookSearchWidget extends Widget {

	domNode!: HTMLElement;

	searchInput!: FindInput;
	searchInputFocusTracker!: IFocusTracker;
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
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IThemeService private readonly themeService: IThemeService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IKeybindingService private readonly keyBindingService: IKeybindingService,
		@IClipboardService private readonly clipboardServce: IClipboardService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IAccessibilityService private readonly accessibilityService: IAccessibilityService
	) {
		super();
		this.searchInputBoxFocused = Constants.SearchInputBoxFocusedKey.bindTo(this.contextKeyService);

		this.render(container, options);

		this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('editor.accessibilitySupport')) {
				this.updateAccessibilitySupport();
			}
		});
		this.accessibilityService.onDidChangeScreenReaderOptimized(() => this.updateAccessibilitySupport());
		this.updateAccessibilitySupport();
	}

	searchInputHasFocus(): boolean {
		return !!this.searchInputBoxFocused.get();
	}

	private render(container: HTMLElement, options: INotebookExplorerSearchOptions): void {
		this.domNode = append(container, $('.search-widget'));
		this.domNode.style.position = 'relative';

		this.renderSearchInput(this.domNode, options);
	}

	focus(select: boolean = true, suppressGlobalSearchBuffer = false): void {
		this.ignoreGlobalFindBufferOnNextFocus = suppressGlobalSearchBuffer;

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
}
