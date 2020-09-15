/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorDescriptor, Extensions as EditorExtensions, IEditorRegistry } from 'vs/workbench/browser/editor';
import { Registry } from 'vs/platform/registry/common/platform';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { ResourceViewerEditor } from 'sql/workbench/contrib/resourceViewer/browser/resourceViewerEditor';
import { ResourceViewerInput } from 'sql/workbench/browser/editor/resourceViewer/resourceViewerInput';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService, ACTIVE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { isString } from 'vs/base/common/types';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { ResourceViewResourcesExtensionHandler } from 'sql/workbench/contrib/resourceViewer/common/resourceViewerViewExtensionPoint';

CommandsRegistry.registerCommand({
	id: 'resourceViewer.openResourceViewer',
	handler: async (accessor: ServicesAccessor, ...args: any[]): Promise<void> => {
		const instantiationService: IInstantiationService = accessor.get(IInstantiationService);
		const editorService: IEditorService = accessor.get(IEditorService);
		if (!isString(args[0])) {
			throw new Error('First argument must be the ProviderId');
		}

		const resourceViewerInput = instantiationService.createInstance(ResourceViewerInput, args[0]);
		editorService.openEditor(resourceViewerInput, { pinned: true }, ACTIVE_GROUP);
	}
});

const resourceViewerDescriptor = EditorDescriptor.create(
	ResourceViewerEditor,
	ResourceViewerEditor.ID,
	'ResourceViewerEditor'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(resourceViewerDescriptor, [new SyncDescriptor(ResourceViewerInput)]);

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ResourceViewResourcesExtensionHandler, LifecyclePhase.Ready);

// TODO: chgagnon disabling until the resource viewer is feature complete
// class ResourceViewerContributor implements IWorkbenchContribution {
// 	constructor(
// 		@IExtensionService private readonly extensionService: IExtensionService
// 	) {
// 		this.checkForArc();
// 	}

// 	private async checkForArc(): Promise<void> {
// 		if (await this.extensionService.getExtension('Microsoft.arc')) {
// 			registerResourceViewerContainer();
// 		} else {
// 			const disposable = this.extensionService.onDidChangeExtensions(async () => {
// 				if (await this.extensionService.getExtension('Microsoft.arc')) {
// 					registerResourceViewerContainer();
// 					disposable.dispose();
// 				}
// 			});
// 		}
// 	}
// }

// Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ResourceViewerContributor, LifecyclePhase.Ready);

// function registerResourceViewerContainer() {
// 	const viewContainer = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).registerViewContainer({
// 		id: RESOURCE_VIEWER_VIEW_CONTAINER_ID,
// 		name: localize('resourceViewer', "Resource Viewer"),
// 		ctorDescriptor: new SyncDescriptor(ResourceViewerViewlet),
// 		icon: Codicon.database.classNames,
// 		alwaysUseContainerInfo: true
// 	}, ViewContainerLocation.Sidebar);

// 	const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
// 	viewsRegistry.registerViews([{ id: RESOURCE_VIEWER_VIEW_ID, name: localize('resourceViewer', "Resource Viewer"), containerIcon: Codicon.database.classNames, ctorDescriptor: new SyncDescriptor(ResourceViewerView), canToggleVisibility: false, canMoveView: false }], viewContainer);
// }
