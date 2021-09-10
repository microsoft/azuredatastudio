/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorPaneDescriptor, IEditorPaneRegistry } from 'vs/workbench/browser/editor';
import { EditorExtensions } from 'vs/workbench/common/editor';
import { Registry } from 'vs/platform/registry/common/platform';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { ResourceViewerEditor } from 'sql/workbench/contrib/resourceViewer/browser/resourceViewerEditor';
import { ResourceViewerInput } from 'sql/workbench/browser/editor/resourceViewer/resourceViewerInput';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService, ACTIVE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { isString } from 'vs/base/common/types';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { ResourceViewResourcesExtensionHandler } from 'sql/workbench/contrib/resourceViewer/common/resourceViewerViewExtensionPoint';
import { ResourceViewerView } from 'sql/workbench/contrib/resourceViewer/browser/resourceViewerView';
import { ResourceViewerViewlet } from 'sql/workbench/contrib/resourceViewer/browser/resourceViewerViewlet';
import { RESOURCE_VIEWER_VIEW_CONTAINER_ID, RESOURCE_VIEWER_VIEW_ID } from 'sql/workbench/contrib/resourceViewer/common/resourceViewer';
import { Codicon, registerCodicon } from 'vs/base/common/codicons';
import { localize } from 'vs/nls';
import { Extensions as ViewContainerExtensions, IViewsRegistry, IViewContainersRegistry, ViewContainerLocation } from 'vs/workbench/common/views';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IProductService } from 'vs/platform/product/common/productService';

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

const resourceViewerDescriptor = EditorPaneDescriptor.create(
	ResourceViewerEditor,
	ResourceViewerEditor.ID,
	'ResourceViewerEditor'
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.Editors)
	.registerEditorPane(resourceViewerDescriptor, [new SyncDescriptor(ResourceViewerInput)]);

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ResourceViewResourcesExtensionHandler, LifecyclePhase.Ready);

class ResourceViewerContributor implements IWorkbenchContribution {
	constructor(
		@IConfigurationService readonly configurationService: IConfigurationService,
		@IProductService readonly productService: IProductService
	) {
		// Only show for insiders and dev
		if (['insider', ''].includes(productService.quality ?? '') && configurationService.getValue('workbench.enablePreviewFeatures')) {
			registerResourceViewerContainer();
		}
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ResourceViewerContributor, LifecyclePhase.Ready);

function registerResourceViewerContainer() {

	const resourceViewerIcon = registerCodicon('reosurce-view', Codicon.database);
	const viewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
		id: RESOURCE_VIEWER_VIEW_CONTAINER_ID,
		title: localize('resourceViewer', "Resource Viewer"),
		ctorDescriptor: new SyncDescriptor(ResourceViewerViewlet),
		icon: resourceViewerIcon,
		alwaysUseContainerInfo: true
	}, ViewContainerLocation.Sidebar);

	const viewsRegistry = Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry);
	viewsRegistry.registerViews([{ id: RESOURCE_VIEWER_VIEW_ID, name: localize('resourceViewer', "Resource Viewer"), containerIcon: resourceViewerIcon, ctorDescriptor: new SyncDescriptor(ResourceViewerView), canToggleVisibility: false, canMoveView: false }], viewContainer);
}
