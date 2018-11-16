/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';

import { QueryEditorContextKeys } from 'sql/parts/query/editor/queryEditorContextKeys';
import { QueryEditorState } from 'sql/parts/query/common/queryInput';

export class QueryEditorContext extends Disposable {
	private _isConnected: IContextKey<boolean>;
	private _isExecuting: IContextKey<boolean>;

	private state: QueryEditorState;

	private stateDisposable: IDisposable;

	constructor(contextKeyService: IContextKeyService) {
		super();

		this._isConnected = QueryEditorContextKeys.isConnected.bindTo(contextKeyService);
		this._isExecuting = QueryEditorContextKeys.isExecuting.bindTo(contextKeyService);
	}

	public setState(state: QueryEditorState) {
		if (this.stateDisposable) {
			this.stateDisposable.dispose();
		}

		this.state = state;
		this.state.onChange(this._update, this);
		this._update();
	}

	reset() {
		this._isConnected.reset();
		this._isExecuting.reset();
	}

	private _update() {
		this._isConnected.set(this.state.connected);
		this._isExecuting.set(this.state.executing);
	}
}
