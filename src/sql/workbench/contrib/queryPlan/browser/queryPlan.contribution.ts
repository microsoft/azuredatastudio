/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryPlanInput } from 'sql/workbench/contrib/queryPlan/common/queryPlanInput';
import { EditorDescriptor, IEditorRegistry } from 'vs/workbench/browser/editor';
import { EditorExtensions } from 'vs/workbench/common/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Registry } from 'vs/platform/registry/common/platform';
import { QueryPlanEditor } from 'sql/workbench/contrib/queryPlan/browser/queryPlanEditor';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { ContributedEditorPriority, IEditorOverrideService } from 'vs/workbench/services/editor/common/editorOverrideService';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

// Query Plan editor registration

const queryPlanEditorDescriptor = EditorDescriptor.create(
	QueryPlanEditor,
	QueryPlanEditor.ID,
	QueryPlanEditor.LABEL
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(queryPlanEditorDescriptor, [new SyncDescriptor(QueryPlanInput)]);

export class QueryPlanEditorOverrideContribution extends Disposable implements IWorkbenchContribution {
	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IEditorOverrideService private _editorOverrideService: IEditorOverrideService
	) {
		super();
		this.registerEditorOverride();
	}

	private registerEditorOverride(): void {
		this._editorOverrideService.registerContributionPoint(
			'*.sqlplan',
			{
				id: QueryPlanEditor.ID,
				label: QueryPlanEditor.LABEL,
				describes: (currentEditor) => currentEditor instanceof QueryPlanInput,
				priority: ContributedEditorPriority.builtin
			},
			{},
			(resource, options, group) => {
				const queryPlanInput = this._instantiationService.createInstance(QueryPlanInput, resource);
				return { editor: queryPlanInput };
			}
		);
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(QueryPlanEditorOverrideContribution, LifecyclePhase.Restored);
