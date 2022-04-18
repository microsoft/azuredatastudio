/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IResultMessageIntern, Model } from 'sql/workbench/contrib/query/browser/messagePanel';
import { IQueryMessage, IQueryResultsWriter } from 'sql/workbench/services/query/common/query';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { IDataTreeViewState } from 'vs/base/browser/ui/tree/dataTree';
import { FuzzyScore } from 'vs/base/common/filters';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { isArray } from 'vs/base/common/types';
import { WorkbenchDataTree } from 'vs/platform/list/browser/listService';

export class MessagesPanelQueryResultsWriter extends Disposable implements IQueryResultsWriter {
	private runner: QueryRunner;
	private currentUri: string;

	protected queryRunnerDisposables = this._register(new DisposableStore());

	constructor(
		private readonly model: Model,
		private readonly tree: WorkbenchDataTree<Model, IResultMessageIntern, FuzzyScore>,
		private readonly treeStates: Map<string, IDataTreeViewState>,
	) {
		super();
	}

	public subscribeToQueryRunner(): void {
		this.queryRunnerDisposables.add(this.runner.onQueryStart(() => {
			this.clear();
		}));

		this.queryRunnerDisposables.add(this.runner.onMessage((resultMessage) => {
			this.onMessage(resultMessage);
		}));

		this.onMessage(this.runner.messages, true);
	}

	public override dispose() {
		this.clear();
		this.queryRunnerDisposables.dispose();

		super.dispose();
	}

	public set queryRunner(runner: QueryRunner) {
		this.runner = runner;
		this.currentUri = runner.uri;
	}

	public clear(): void {
		this.model.messages = [];
		this.model.totalExecuteMessage = undefined;
		this.tree.updateChildren();
	}

	private onMessage(resultMessage: IQueryMessage | IQueryMessage[], setInput: boolean = false): void {
		if (isArray(resultMessage)) {
			this.model.messages.push(...resultMessage);
		} else {
			this.model.messages.push(resultMessage);
		}
		if (setInput) {
			this.tree.setInput(this.model, this.treeStates.get(this.currentUri));
		} else {
			this.tree.updateChildren();
		}
	}
}
