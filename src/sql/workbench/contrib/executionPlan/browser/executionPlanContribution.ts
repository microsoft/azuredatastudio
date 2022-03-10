/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorPaneDescriptor, IEditorPaneRegistry } from 'vs/workbench/browser/editor';
import { EditorExtensions } from 'vs/workbench/common/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Registry } from 'vs/platform/registry/common/platform';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IEditorResolverService, RegisteredEditorPriority } from 'vs/workbench/services/editor/common/editorResolverService';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IExecutionPlanService } from 'sql/workbench/services/executionPlan/common/interfaces';
import { ExecutionPlanInput } from 'sql/workbench/contrib/executionPlan/common/executionPlanInput';
import { ExecutionPlanEditor } from 'sql/workbench/contrib/executionPlan/browser/executionPlanEditor';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';

// Execution Plan editor registration

const executionPlanEditorDescriptor = EditorPaneDescriptor.create(
	ExecutionPlanEditor,
	ExecutionPlanEditor.ID,
	ExecutionPlanEditor.LABEL
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(executionPlanEditorDescriptor, [new SyncDescriptor(ExecutionPlanInput)]);

export class ExecutionPlanEditorOverrideContribution extends Disposable implements IWorkbenchContribution {
	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IEditorResolverService private _editorResolverService: IEditorResolverService,
		@IExecutionPlanService private _executionPlanService: IExecutionPlanService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
	) {
		super();
		this.registerEditorOverride();

		this._capabilitiesService.onCapabilitiesRegistered(e => {
			const newFileFormats = this._executionPlanService.getSupportedExecutionPlanExtensionsForProvider(e.id);
			if (newFileFormats && newFileFormats.length > 0) {
				this._editorResolverService.updateUserAssociations(`*.{${newFileFormats.join()}}`, ExecutionPlanEditor.ID); // Registering new file formats when new providers are registered.
			}
		});
	}

	public registerEditorOverride(): void {
		this._editorResolverService.registerEditor(
			'',
			{
				id: ExecutionPlanEditor.ID,
				label: ExecutionPlanEditor.LABEL,
				priority: RegisteredEditorPriority.builtin
			},
			{},
			(editorInput, group) => {
				const executionPlanInput = this._instantiationService.createInstance(ExecutionPlanInput, editorInput.resource);
				return { editor: executionPlanInput, options: editorInput.options, group: group };
			}
		);
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(ExecutionPlanEditorOverrideContribution, LifecyclePhase.Restored);
