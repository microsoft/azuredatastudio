/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';
import { localize } from 'vs/nls';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { URI } from 'vs/base/common/uri';

export class ExecutionPlanComparisonInput extends EditorInput {

	public static ID: string = 'workbench.editorinputs.compareExecutionPlanInput';
	public static SCHEME: string = 'compareExecutionPlanInput';

	public plans: azdata.executionPlan.ExecutionPlanGraphInfo[] = [];
	public graphs: azdata.executionPlan.ExecutionPlanGraph[][] = [];

	public _comparisonEditorUUID: string;

	constructor(
		private _data?: CompareExecutionPlanData | undefined,
	) {
		super();
	}

	get typeId(): string {
		return ExecutionPlanComparisonInput.ID;
	}

	get resource(): URI {
		return URI.from({
			scheme: ExecutionPlanComparisonInput.SCHEME,
			path: 'compareExecutionPlan'
		});
	}

	public override getName(): string {
		return localize('compareExecutionPlanInput.compareExecutionPlans', "Compare Execution Plans");
	}

	public get data(): CompareExecutionPlanData {
		return this._data;
	}
}


export interface CompareExecutionPlanData {
	executionPlan1: azdata.executionPlan.ExecutionPlanGraphInfo;
	executionPlan2: azdata.executionPlan.ExecutionPlanGraphInfo;
}
