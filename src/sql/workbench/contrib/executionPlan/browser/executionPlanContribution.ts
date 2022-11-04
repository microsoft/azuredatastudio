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
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IExecutionPlanService } from 'sql/workbench/services/executionPlan/common/interfaces';
import { ExecutionPlanInput } from 'sql/workbench/contrib/executionPlan/common/executionPlanInput';
import { ExecutionPlanEditor } from 'sql/workbench/contrib/executionPlan/browser/executionPlanEditor';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ExecutionPlanComparisonEditor } from 'sql/workbench/contrib/executionPlan/browser/executionPlanComparisonEditor';
import { ExecutionPlanComparisonInput } from 'sql/workbench/contrib/executionPlan/browser/compareExecutionPlanInput';
import { MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import { localize } from 'vs/nls';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { CATEGORIES } from 'sql/workbench/contrib/query/browser/queryActions';
import { IConfigurationRegistry, Extensions as ConfigExtensions, IConfigurationNode } from 'vs/platform/configuration/common/configurationRegistry';

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
			const newFileFormats = this._executionPlanService.getSupportedExecutionPlanExtensions(e.id);
			if (newFileFormats?.length > 0) {
				this._editorResolverService.updateUserAssociations(this.getGlobForFileExtensions(newFileFormats), ExecutionPlanEditor.ID); // Registering new file formats when new providers are registered.
			}
		});
	}

	public registerEditorOverride(): void {
		const supportedFileFormats: string[] = [];
		Object.keys(this._capabilitiesService.providers).forEach(e => {
			if (this._capabilitiesService.providers[e]?.connection?.supportedExecutionPlanFileExtensions) {
				supportedFileFormats.push(... this._capabilitiesService.providers[e].connection.supportedExecutionPlanFileExtensions);
			}
		});

		this._register(this._editorResolverService.registerEditor(
			this.getGlobForFileExtensions(supportedFileFormats),
			{
				id: ExecutionPlanEditor.ID,
				label: ExecutionPlanEditor.LABEL,
				priority: RegisteredEditorPriority.builtin
			},
			{},
			(editorInput, group) => {
				const executionPlanGraphInfo = {
					graphFileContent: undefined,
					graphFileType: undefined
				};
				const executionPlanInput = this._register(this._instantiationService.createInstance(ExecutionPlanInput, editorInput.resource, executionPlanGraphInfo));

				return { editor: executionPlanInput, options: editorInput.options, group: group };
			}
		));
	}

	private getGlobForFileExtensions(extensions: string[]): string {
		return extensions?.length === 0 ? '' : `*.{${extensions.join()}}`;
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(ExecutionPlanEditorOverrideContribution, LifecyclePhase.Restored);

const comparisonExecutionPlanEditor = EditorPaneDescriptor.create(
	ExecutionPlanComparisonEditor,
	ExecutionPlanComparisonEditor.ID,
	ExecutionPlanComparisonEditor.LABEL
);

const COMPARE_EXECUTION_PLAN_COMMAND_ID = 'compareExecutionPlan';

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(comparisonExecutionPlanEditor, [new SyncDescriptor(ExecutionPlanComparisonInput)]);

MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: COMPARE_EXECUTION_PLAN_COMMAND_ID,
		title: {
			value: localize('executionPlanCompareCommandValue', "Compare execution plans"),
			original: localize('executionPlanCompareCommandOriginalValue', "Compare execution plans")
		},
		category: CATEGORIES.ExecutionPlan.value
	}
});

CommandsRegistry.registerCommand(COMPARE_EXECUTION_PLAN_COMMAND_ID, (accessors: ServicesAccessor) => {
	const editorService = accessors.get(IEditorService);
	const instantiationService = accessors.get(IInstantiationService);
	editorService.openEditor(instantiationService.createInstance(ExecutionPlanComparisonInput, undefined), {
		pinned: true
	});
});

const executionPlanContribution: IConfigurationNode = {
	id: 'executionPlan',
	type: 'object',
	title: localize('executionPlanConfigurationTitle', "Execution Plan"),
	properties: {
		'executionPlan.tooltips.enableOnHoverTooltips': {
			'type': 'boolean',
			'description': localize('executionPlan.tooltips.enableOnHoverTooltips', "When true, enables tooltips on hover for execution plan. When false, tooltips are shown on node click or F3 key press."),
			'default': false
		},
	}
};

const configurationRegistry = <IConfigurationRegistry>Registry.as(ConfigExtensions.Configuration);
configurationRegistry.registerConfiguration(executionPlanContribution);
