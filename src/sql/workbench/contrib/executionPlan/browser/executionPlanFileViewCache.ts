/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExecutionPlanComparisonEditorView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanComparisonEditorView';
import { ExecutionPlanFileView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanFileView';

export class ExecutionPlanFileViewCache {
	private static instance: ExecutionPlanFileViewCache;

	public executionPlanFileViewMap: Map<string, ExecutionPlanFileView> = new Map();

	public executionPlanComparisonViewMap: Map<string, ExecutionPlanComparisonEditorView> = new Map();

	private constructor() { }

	public static getInstance(): ExecutionPlanFileViewCache {
		if (!ExecutionPlanFileViewCache.instance) {
			ExecutionPlanFileViewCache.instance = new ExecutionPlanFileViewCache();
		}

		return ExecutionPlanFileViewCache.instance;
	}
}
