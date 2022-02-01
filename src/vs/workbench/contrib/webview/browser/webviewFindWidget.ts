/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { SimpleFindWidget } from 'vs/workbench/contrib/codeEditor/browser/find/simpleFindWidget';
import { KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED } from 'vs/workbench/contrib/webview/browser/webview';

export interface WebviewFindDelegate {
	readonly hasFindResult: Event<boolean>;
	readonly onDidStopFind: Event<void>;
	readonly checkImeCompletionState: boolean;
	find(value: string, previous: boolean): void;
	startFind(value: string): void;
	stopFind(keepSelection?: boolean): void;
	focus(): void;
}

export class WebviewFindWidget extends SimpleFindWidget {
	protected _findWidgetFocused: IContextKey<boolean>;

	constructor(
		private readonly _delegate: WebviewFindDelegate,
		@IContextViewService contextViewService: IContextViewService,
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		super(contextViewService, contextKeyService, undefined, false, _delegate.checkImeCompletionState);
		this._findWidgetFocused = KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED.bindTo(contextKeyService);

		this._register(_delegate.hasFindResult(hasResult => {
			this.updateButtons(hasResult);
			this.focusFindBox();
		}));

		this._register(_delegate.onDidStopFind(() => {
			this.updateButtons(false);
		}));
	}

	public find(previous: boolean) {
		const val = this.inputValue;
		if (val) {
			this._delegate.find(val, previous);
		}
	}

	public override hide() {
		super.hide();
		this._delegate.stopFind(true);
		this._delegate.focus();
	}

	public _onInputChanged(): boolean {
		const val = this.inputValue;
		if (val) {
			this._delegate.startFind(val);
		} else {
			this._delegate.stopFind(false);
		}
		return false;
	}

	protected _onFocusTrackerFocus() {
		this._findWidgetFocused.set(true);
	}

	protected _onFocusTrackerBlur() {
		this._findWidgetFocused.reset();
	}

	protected _onFindInputFocusTrackerFocus() { }

	protected _onFindInputFocusTrackerBlur() { }

	protected findFirst() { }
}
