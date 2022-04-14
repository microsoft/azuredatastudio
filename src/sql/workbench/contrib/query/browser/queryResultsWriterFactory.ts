/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileQueryResultsWriter } from 'sql/workbench/contrib/query/browser/fileQueryResultsWriter';
import { Model, IResultMessageIntern } from 'sql/workbench/contrib/query/browser/messagePanel';
import { MessagesPanelQueryResultsWriter } from 'sql/workbench/contrib/query/browser/messagesPanelQueryResultsWriter';
import { QueryEditor } from 'sql/workbench/contrib/query/browser/queryEditor';
import { QueryResultsWriterMode } from 'sql/workbench/contrib/query/common/queryResultsWriterStatus';
import { IQueryResultsWriter } from 'sql/workbench/services/query/common/query';
import { IDataTreeViewState } from 'vs/base/browser/ui/tree/dataTree';
import { FuzzyScore } from 'vs/base/common/filters';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { WorkbenchDataTree } from 'vs/platform/list/browser/listService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';

export class QueryResultsWriterFactory {
	constructor(
		private readonly model: Model,
		private readonly tree: WorkbenchDataTree<Model, IResultMessageIntern, FuzzyScore>,
		private readonly treeStates: Map<string, IDataTreeViewState>,
		@IEditorService private readonly editorService: IEditorService,
		@IInstantiationService private instantiationService: IInstantiationService,

	) { }

	getQueryResultsWriter(): IQueryResultsWriter {
		let editor = this.editorService.activeEditorPane as QueryEditor;
		if (editor.queryResultsWriterStatus.mode === QueryResultsWriterMode.ToGrid) {
			return this.instantiationService.createInstance(MessagesPanelQueryResultsWriter, this.model, this.tree, this.treeStates);
		}
		else {
			return this.instantiationService.createInstance(FileQueryResultsWriter);
		}
	}
}
