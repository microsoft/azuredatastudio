/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { forEach } from 'vs/base/common/collections';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { Registry } from 'vs/platform/registry/common/platform';
import { IViewContainersRegistry, ViewContainer, Extensions as ViewContainerExtensions, ICustomViewDescriptor, ViewsRegistry } from 'vs/workbench/common/views';
import { IExtensionPoint, ExtensionsRegistry, ExtensionMessageCollector } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { CustomTreeViewPanel } from 'vs/workbench/browser/parts/views/customView';
import { coalesce } from 'vs/base/common/arrays';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { viewsContainersExtensionPoint } from 'vs/workbench/api/browser/viewsContainersExtensionPoint';

import { CustomTreeView } from 'sql/workbench/browser/parts/views/customView';

export const DataExplorerViewlet = {
	DataExplorer: 'dataExplorer'
};
export const VIEWLET_ID = 'workbench.view.dataExplorer';
export const VIEW_CONTAINER: ViewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer(VIEWLET_ID);



interface IUserFriendlyViewDescriptor {
	id: string;
	name: string;
	when?: string;
}

const viewDescriptor: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			description: localize('vscode.extension.contributes.view.id', 'Identifier of the view. Use this to register a data provider through `vscode.window.registerTreeDataProviderForView` API. Also to trigger activating your extension by registering `onView:${id}` event to `activationEvents`.'),
			type: 'string'
		},
		name: {
			description: localize('vscode.extension.contributes.view.name', 'The human-readable name of the view. Will be shown'),
			type: 'string'
		},
		when: {
			description: localize('vscode.extension.contributes.view.when', 'Condition which must be true to show this view'),
			type: 'string'
		},
	}
};

const dataExplorerContribution: IJSONSchema = {
	description: localize('extension.contributes.dataExplorer', "Contributes views to the editor"),
	type: 'object',
	properties: {
		'dataExplorer': {
			description: localize('extension.dataExplorer', "Contributes views to Data Explorer container in the Activity bar"),
			type: 'array',
			items: viewDescriptor,
			default: []
		}
	},
	additionalProperties: {
		description: localize('dataExplorer.contributed', "Contributes views to contributed views container"),
		type: 'array',
		items: viewDescriptor,
		default: []
	}
};


const dataExplorerExtensionPoint: IExtensionPoint<{ [loc: string]: IUserFriendlyViewDescriptor[] }> = ExtensionsRegistry.registerExtensionPoint<{ [loc: string]: IUserFriendlyViewDescriptor[] }>('dataExplorer', [viewsContainersExtensionPoint], dataExplorerContribution);

class DataExplorerContainerExtensionHandler implements IWorkbenchContribution {

	private viewContainersRegistry: IViewContainersRegistry;

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		this.viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
		this.handleAndRegisterCustomViews();
	}

	private handleAndRegisterCustomViews() {
		if (process.env.NODE_ENV !== 'development') {
			return;
		}
		dataExplorerExtensionPoint.setHandler(extensions => {
			for (let extension of extensions) {
				const { value, collector } = extension;

				forEach(value, entry => {
					if (!this.isValidViewDescriptors(entry.value, collector)) {
						return;
					}

					let container = this.viewContainersRegistry.get(VIEWLET_ID);
					if (!container) {
						collector.warn(localize('ViewsContainerDoesnotExist', "View container '{0}' does not exist and all views registered to it will be added to 'Data Explorer'.", entry.key));
						container = this.viewContainersRegistry.get(VIEWLET_ID);
					}
					const registeredViews = ViewsRegistry.getViews(container);
					const viewIds = [];
					const viewDescriptors = coalesce(entry.value.map(item => {
						// validate
						if (viewIds.indexOf(item.id) !== -1) {
							collector.error(localize('duplicateView1', "Cannot register multiple views with same id `{0}` in the view container `{1}`", item.id, container.id));
							return null;
						}
						if (registeredViews.some(v => v.id === item.id)) {
							collector.error(localize('duplicateView2', "A view with id `{0}` is already registered in the view container `{1}`", item.id, container.id));
							return null;
						}

						const viewDescriptor = <ICustomViewDescriptor>{
							id: item.id,
							name: item.name,
							ctor: CustomTreeViewPanel,
							container,
							when: ContextKeyExpr.deserialize(item.when),
							canToggleVisibility: true,
							collapsed: this.showCollapsed(container),
							treeView: this.instantiationService.createInstance(CustomTreeView, item.id, container)
						};

						viewIds.push(viewDescriptor.id);
						return viewDescriptor;
					}));
					ViewsRegistry.registerViews(viewDescriptors);
				});
			}
		});
	}

	private isValidViewDescriptors(viewDescriptors: IUserFriendlyViewDescriptor[], collector: ExtensionMessageCollector): boolean {
		if (!Array.isArray(viewDescriptors)) {
			collector.error(localize('requirearray', "views must be an array"));
			return false;
		}

		for (let descriptor of viewDescriptors) {
			if (typeof descriptor.id !== 'string') {
				collector.error(localize('requirestring', "property `{0}` is mandatory and must be of type `string`", 'id'));
				return false;
			}
			if (typeof descriptor.name !== 'string') {
				collector.error(localize('requirestring', "property `{0}` is mandatory and must be of type `string`", 'name'));
				return false;
			}
			if (descriptor.when && typeof descriptor.when !== 'string') {
				collector.error(localize('optstring', "property `{0}` can be omitted or must be of type `string`", 'when'));
				return false;
			}
		}

		return true;
	}

	private showCollapsed(container: ViewContainer): boolean {
		return false;
	}
}

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(DataExplorerContainerExtensionHandler, LifecyclePhase.Starting);
