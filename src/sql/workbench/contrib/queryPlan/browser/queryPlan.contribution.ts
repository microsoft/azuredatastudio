/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryPlanInput } from 'sql/workbench/contrib/queryPlan/common/queryPlanInput';
import { EditorPaneDescriptor, IEditorPaneRegistry } from 'vs/workbench/browser/editor';
import { EditorExtensions } from 'vs/workbench/common/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Registry } from 'vs/platform/registry/common/platform';
import { QueryPlanEditor } from 'sql/workbench/contrib/queryPlan/browser/queryPlanEditor';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IEditorResolverService, RegisteredEditorPriority } from 'vs/workbench/services/editor/common/editorResolverService';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

// Query Plan editor registration

const queryPlanEditorDescriptor = EditorPaneDescriptor.create(
	QueryPlanEditor,
	QueryPlanEditor.ID,
	QueryPlanEditor.LABEL
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(queryPlanEditorDescriptor, [new SyncDescriptor(QueryPlanInput)]);

export class QueryPlanEditorOverrideContribution extends Disposable implements IWorkbenchContribution {
	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IEditorResolverService private _editorResolverService: IEditorResolverService
	) {
		super();
		this.registerEditorOverride();
	}

	private registerEditorOverride(): void {
		this._editorResolverService.registerEditor(
			'*.sqlplan',
			{
				id: QueryPlanEditor.ID,
				label: QueryPlanEditor.LABEL,
				priority: RegisteredEditorPriority.builtin
			},
			{},
			(editorInput, group) => {
				const queryPlanInput = this._instantiationService.createInstance(QueryPlanInput, editorInput.resource);
				return { editor: queryPlanInput, options: editorInput.options, group: group };
			}
		);
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(QueryPlanEditorOverrideContribution, LifecyclePhase.Restored);
