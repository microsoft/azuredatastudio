/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	ToggleConnectDatabaseAction, ListDatabasesAction, RunQueryAction,
	ListDatabasesActionItem
} from 'sql/parts/query/execution/queryActions';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { QueryInput } from 'sql/parts/query/common/queryInput';

import { TPromise } from 'vs/base/common/winjs.base';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class QueryEditorActionBar extends Taskbar {

	private runQuery: RunQueryAction;
	private toggleConnect: ToggleConnectDatabaseAction;
	private listDatabases: ListDatabasesAction;
	private listDatabaseActionItem: ListDatabasesActionItem;

	constructor(container: HTMLElement,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super(container, {
			actionItemProvider: action => {
				if (action.id === ListDatabasesAction.ID) {
					return this.listDatabaseActionItem;
				}
				return undefined;
			}
		});
		this.runQuery = instantiationService.createInstance(RunQueryAction);
		this.toggleConnect = instantiationService.createInstance(ToggleConnectDatabaseAction);
		this.listDatabases = instantiationService.createInstance(ListDatabasesAction);
		this.listDatabaseActionItem = instantiationService.createInstance(ListDatabasesActionItem);
		this.setContent([
			{ action: this.runQuery },
			{ action: this.toggleConnect },
			{ action: this.listDatabases }
		]);
	}

	public setInput(input: QueryInput): TPromise<void> {
		this.context = { input };
		return TPromise.as(undefined);
	}
}
