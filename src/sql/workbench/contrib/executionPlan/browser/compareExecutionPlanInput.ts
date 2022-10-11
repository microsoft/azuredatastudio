/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { localize } from 'vs/nls';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { URI } from 'vs/base/common/uri';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ExecutionPlanComparisonEditorView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanComparisonEditorView';

export class ExecutionPlanComparisonInput extends EditorInput {
	public static ID: string = 'workbench.editorinputs.compareExecutionPlanInput';
	public static SCHEME: string = 'compareExecutionPlanInput';
	private readonly editorNamePrefix = localize('epCompare.editorName', "CompareExecutionPlans");
	private _editorName: string;

	// Caching the views for faster tab switching
	public _executionPlanComparisonView: ExecutionPlanComparisonEditorView;

	constructor(
		public preloadModel: ExecutionPlanComparisonEditorModel | undefined,
		@IEditorService private readonly _editorService: IEditorService
	) {
		super();

		// Getting name for the editor
		const existingNames = this._editorService.editors.map(editor => editor.getName());
		let i = 1;
		this._editorName = `${this.editorNamePrefix}_${i}`;
		while (existingNames.includes(this._editorName)) {
			i++;
			this._editorName = `${this.editorNamePrefix}_${i}`;
		}
	}

	get typeId(): string {
		return ExecutionPlanComparisonInput.ID;
	}

	get resource(): URI {
		return URI.from({
			scheme: ExecutionPlanComparisonInput.SCHEME,
			path: 'execution-plan-compare'
		});
	}

	public override getName(): string {
		return this._editorName;
	}
}

export interface ExecutionPlanComparisonEditorModel {
	topExecutionPlan?: azdata.executionPlan.ExecutionPlanGraph[];
	topPlanIndex?: number;
	bottomExecutionPlan?: azdata.executionPlan.ExecutionPlanGraph[];
	bottomPlanIndex?: number;
}
