/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IResultMessageIntern, Model } from 'sql/workbench/contrib/query/browser/messagePanel';
import { IQueryRunnerCallbackHandler } from 'sql/workbench/contrib/query/browser/IQueryRunnerCallbackHandler';
import { IQueryMessage } from 'sql/workbench/services/query/common/query';
import { IDataTreeViewState } from 'vs/base/browser/ui/tree/dataTree';
import { FuzzyScore } from 'vs/base/common/filters';
import { isArray } from 'vs/base/common/types';
import { WorkbenchDataTree } from 'vs/platform/list/browser/listService';

export class MessagesPanelQueryRunnerCallbackHandler implements IQueryRunnerCallbackHandler {
	private model: Model;
	private tree: WorkbenchDataTree<Model, IResultMessageIntern, FuzzyScore>;
	private treeStates: Map<string, IDataTreeViewState>;
	private currenturi: string;

	constructor(model: Model,
		tree: WorkbenchDataTree<Model, IResultMessageIntern, FuzzyScore>,
		treeStates: Map<string, IDataTreeViewState>,
		currenturi: string
	) {
		this.model = model;
		this.tree = tree;
		this.treeStates = treeStates;
		this.currenturi = currenturi;
	}

	public onQueryStart() {
		this.reset();
	}

	public onResultSet() {
		// intentionally made no-op
	}

	public updateResultSet() {
		// intentionally made no-op
	}

	public onMessage(incomingMessage: IQueryMessage | IQueryMessage[], setInput: boolean = false) {
		if (isArray(incomingMessage)) {
			this.model.messages.push(...incomingMessage);
		} else {
			this.model.messages.push(incomingMessage);
		}
		if (setInput) {
			this.tree.setInput(this.model, this.treeStates.get(this.currenturi));
		} else {
			this.tree.updateChildren();
		}
	}

	public reset() {
		this.model.messages = [];
		this.model.totalExecuteMessage = undefined;
		this.tree.updateChildren();
	}
}
