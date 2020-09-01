/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { forEach } from 'vs/base/common/collections';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as resources from 'vs/base/common/resources';
import { ExtensionMessageCollector, ExtensionsRegistry, IExtensionPoint, IExtensionPointUser } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { ViewContainer, IViewsRegistry, ITreeViewDescriptor, IViewContainersRegistry, Extensions as ViewContainerExtensions, TEST_VIEW_CONTAINER_ID, IViewDescriptor, ViewContainerLocation } from 'vs/workbench/common/views';
import { TreeViewPane } from 'vs/workbench/browser/parts/views/treeView';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { coalesce, } from 'vs/base/common/arrays';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { Registry } from 'vs/platform/registry/common/platform';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { VIEWLET_ID as EXPLORER } from 'vs/workbench/contrib/files/common/files';
import { VIEWLET_ID as SCM } from 'vs/workbench/contrib/scm/common/scm';
import { VIEWLET_ID as DEBUG } from 'vs/workbench/contrib/debug/common/debug';
import { VIEWLET_ID as REMOTE } from 'vs/workbench/contrib/remote/common/remote.contribution';
import { VIEWLET_ID as NOTEBOOK } from 'sql/workbench/contrib/notebook/browser/notebookExplorer/notebookExplorerViewlet'; // {{SQL CARBON EDIT}}
import { ExtensionIdentifier, IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { URI } from 'vs/base/common/uri';
import { ViewletRegistry, Extensions as ViewletExtensions, ShowViewletAction } from 'vs/workbench/browser/viewlet';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { ViewPaneContainer } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Codicon } from 'vs/base/common/codicons';
import { CustomTreeView } from 'vs/workbench/contrib/views/browser/treeView';
import { WebviewViewPane } from 'vs/workbench/contrib/webviewView/browser/webviewViewPane';

export interface IUserFriendlyViewsContainerDescriptor {
	id: string;
	title: string;
	icon: string;
}

const viewsContainerSchema: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			description: localize({ key: 'vscode.extension.contributes.views.containers.id', comment: ['Contribution refers to those that an extension contributes to VS Code through an extension/contribution point. '] }, "Unique id used to identify the container in which views can be contributed using 'views' contribution point"),
			type: 'string',
			pattern: '^[a-zA-Z0-9_-]+$'
		},
		title: {
			description: localize('vscode.extension.contributes.views.containers.title', 'Human readable string used to render the container'),
			type: 'string'
		},
		icon: {
			description: localize('vscode.extension.contributes.views.containers.icon', "Path to the container icon. Icons are 24x24 centered on a 50x40 block and have a fill color of 'rgb(215, 218, 224)' or '#d7dae0'. It is recommended that icons be in SVG, though any image file type is accepted."),
			type: 'string'
		}
	},
	required: ['id', 'title', 'icon']
};

export const viewsContainersContribution: IJSONSchema = {
	description: localize('vscode.extension.contributes.viewsContainers', 'Contributes views containers to the editor'),
	type: 'object',
	properties: {
		'activitybar': {
			description: localize('views.container.activitybar', "Contribute views containers to Activity Bar"),
			type: 'array',
			items: viewsContainerSchema
		},
		'panel': {
			description: localize('views.container.panel', "Contribute views containers to Panel"),
			type: 'array',
			items: viewsContainerSchema
		}
	}
};

enum ViewType {
	Tree = 'tree',
	Webview = 'webview'
}


interface IUserFriendlyViewDescriptor {
	type?: ViewType;

	id: string;
	name: string;
	when?: string;

	icon?: string;
	contextualTitle?: string;
	visibility?: string;

	// From 'remoteViewDescriptor' type
	group?: string;
	remoteName?: string | string[];
}

enum InitialVisibility {
	Visible = 'visible',
	Hidden = 'hidden',
	Collapsed = 'collapsed'
}

const viewDescriptor: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			description: localize('vscode.extension.contributes.view.id', 'Identifier of the view. This should be unique across all views. It is recommended to include your extension id as part of the view id. Use this to register a data provider through `vscode.window.registerTreeDataProviderForView` API. Also to trigger activating your extension by registering `onView:${id}` event to `activationEvents`.'),
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
		icon: {
			description: localize('vscode.extension.contributes.view.icon', "Path to the view icon. View icons are displayed when the name of the view cannot be shown. It is recommended that icons be in SVG, though any image file type is accepted."),
			type: 'string'
		},
		contextualTitle: {
			description: localize('vscode.extension.contributes.view.contextualTitle', "Human-readable context for when the view is moved out of its original location. By default, the view's container name will be used. Will be shown"),
			type: 'string'
		},
		visibility: {
			description: localize('vscode.extension.contributes.view.initialState', "Initial state of the view when the extension is first installed. Once the user has changed the view state by collapsing, moving, or hiding the view, the initial state will not be used again."),
			type: 'string',
			enum: [
				'visible',
				'hidden',
				'collapsed'
			],
			default: 'visible',
			enumDescriptions: [
				localize('vscode.extension.contributes.view.initialState.visible', "The default initial state for the view. In most containers the view will be expanded, however; some built-in containers (explorer, scm, and debug) show all contributed views collapsed regardless of the `visibility`."),
				localize('vscode.extension.contributes.view.initialState.hidden', "The view will not be shown in the view container, but will be discoverable through the views menu and other view entry points and can be un-hidden by the user."),
				localize('vscode.extension.contributes.view.initialState.collapsed', "The view will show in the view container, but will be collapsed.")
			]
		}
	}
};

const remoteViewDescriptor: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			description: localize('vscode.extension.contributes.view.id', 'Identifier of the view. This should be unique across all views. It is recommended to include your extension id as part of the view id. Use this to register a data provider through `vscode.window.registerTreeDataProviderForView` API. Also to trigger activating your extension by registering `onView:${id}` event to `activationEvents`.'),
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
		group: {
			description: localize('vscode.extension.contributes.view.group', 'Nested group in the viewlet'),
			type: 'string'
		},
		remoteName: {
			description: localize('vscode.extension.contributes.view.remoteName', 'The name of the remote type associated with this view'),
			type: ['string', 'array'],
			items: {
				type: 'string'
			}
		}
	}
};
const viewsContribution: IJSONSchema = {
	description: localize('vscode.extension.contributes.views', "Contributes views to the editor"),
	type: 'object',
	properties: {
		'explorer': {
			description: localize('views.explorer', "Contributes views to Explorer container in the Activity bar"),
			type: 'array',
			items: viewDescriptor,
			default: []
		},
		'debug': {
			description: localize('views.debug', "Contributes views to Debug container in the Activity bar"),
			type: 'array',
			items: viewDescriptor,
			default: []
		},
		'scm': {
			description: localize('views.scm', "Contributes views to SCM container in the Activity bar"),
			type: 'array',
			items: viewDescriptor,
			default: []
		},
		'test': {
			description: localize('views.test', "Contributes views to Test container in the Activity bar"),
			type: 'array',
			items: viewDescriptor,
			default: []
		},
		'remote': {
			description: localize('views.remote', "Contributes views to Remote container in the Activity bar. To contribute to this container, enableProposedApi needs to be turned on"),
			type: 'array',
			items: remoteViewDescriptor,
			default: []
		},
		// {{SQL CARBON EDIT}}
		'notebooks': {
			description: localize('views.notebooks', "Contributes views to Notebooks container in the Activity bar."),
			type: 'array',
			items: viewDescriptor,
			default: []
		}
	},
	additionalProperties: {
		description: localize('views.contributed', "Contributes views to contributed views container"),
		type: 'array',
		items: viewDescriptor,
		default: []
	}
};

export interface ICustomTreeViewDescriptor extends ITreeViewDescriptor {
	readonly extensionId: ExtensionIdentifier;
	readonly originalContainerId: string;
}

export interface ICustomWebviewViewDescriptor extends IViewDescriptor {
	readonly extensionId: ExtensionIdentifier;
	readonly originalContainerId: string;
}

export type ICustomViewDescriptor = ICustomTreeViewDescriptor | ICustomWebviewViewDescriptor;

type ViewContainerExtensionPointType = { [loc: string]: IUserFriendlyViewsContainerDescriptor[] };
const viewsContainersExtensionPoint: IExtensionPoint<ViewContainerExtensionPointType> = ExtensionsRegistry.registerExtensionPoint<ViewContainerExtensionPointType>({
	extensionPoint: 'viewsContainers',
	jsonSchema: viewsContainersContribution
});

type ViewExtensionPointType = { [loc: string]: IUserFriendlyViewDescriptor[] };
const viewsExtensionPoint: IExtensionPoint<ViewExtensionPointType> = ExtensionsRegistry.registerExtensionPoint<ViewExtensionPointType>({
	extensionPoint: 'views',
	deps: [viewsContainersExtensionPoint],
	jsonSchema: viewsContribution
});

const TEST_VIEW_CONTAINER_ORDER = 6;
class ViewsExtensionHandler implements IWorkbenchContribution {

	private viewContainersRegistry: IViewContainersRegistry;
	private viewsRegistry: IViewsRegistry;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		this.viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
		this.viewsRegistry = Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry);
		this.handleAndRegisterCustomViewContainers();
		this.handleAndRegisterCustomViews();
	}

	private handleAndRegisterCustomViewContainers() {
		this.registerTestViewContainer();
		viewsContainersExtensionPoint.setHandler((extensions, { added, removed }) => {
			if (removed.length) {
				this.removeCustomViewContainers(removed);
			}
			if (added.length) {
				this.addCustomViewContainers(added, this.viewContainersRegistry.all);
			}
		});
	}

	private addCustomViewContainers(extensionPoints: readonly IExtensionPointUser<ViewContainerExtensionPointType>[], existingViewContainers: ViewContainer[]): void {
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
		let activityBarOrder = TEST_VIEW_CONTAINER_ORDER + viewContainersRegistry.all.filter(v => !!v.extensionId && viewContainersRegistry.getViewContainerLocation(v) === ViewContainerLocation.Sidebar).length + 1;
		let panelOrder = 5 + viewContainersRegistry.all.filter(v => !!v.extensionId && viewContainersRegistry.getViewContainerLocation(v) === ViewContainerLocation.Panel).length + 1;
		for (let { value, collector, description } of extensionPoints) {
			forEach(value, entry => {
				if (!this.isValidViewsContainer(entry.value, collector)) {
					return;
				}
				switch (entry.key) {
					case 'activitybar':
						activityBarOrder = this.registerCustomViewContainers(entry.value, description, activityBarOrder, existingViewContainers, ViewContainerLocation.Sidebar);
						break;
					case 'panel':
						panelOrder = this.registerCustomViewContainers(entry.value, description, panelOrder, existingViewContainers, ViewContainerLocation.Panel);
						break;
				}
			});
		}
	}

	private removeCustomViewContainers(extensionPoints: readonly IExtensionPointUser<ViewContainerExtensionPointType>[]): void {
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
		const removedExtensions: Set<string> = extensionPoints.reduce((result, e) => { result.add(ExtensionIdentifier.toKey(e.description.identifier)); return result; }, new Set<string>());
		for (const viewContainer of viewContainersRegistry.all) {
			if (viewContainer.extensionId && removedExtensions.has(ExtensionIdentifier.toKey(viewContainer.extensionId))) {
				// move only those views that do not belong to the removed extension
				const views = this.viewsRegistry.getViews(viewContainer).filter(view => !removedExtensions.has(ExtensionIdentifier.toKey((view as ICustomViewDescriptor).extensionId)));
				if (views.length) {
					this.viewsRegistry.moveViews(views, this.getDefaultViewContainer());
				}
				this.deregisterCustomViewContainer(viewContainer);
			}
		}
	}

	private registerTestViewContainer(): void {
		const title = localize('test', "Test");
		const icon = Codicon.beaker.classNames;

		this.registerCustomViewContainer(TEST_VIEW_CONTAINER_ID, title, icon, TEST_VIEW_CONTAINER_ORDER, undefined, ViewContainerLocation.Sidebar);
	}

	private isValidViewsContainer(viewsContainersDescriptors: IUserFriendlyViewsContainerDescriptor[], collector: ExtensionMessageCollector): boolean {
		if (!Array.isArray(viewsContainersDescriptors)) {
			collector.error(localize('viewcontainer requirearray', "views containers must be an array"));
			return false;
		}

		for (let descriptor of viewsContainersDescriptors) {
			if (typeof descriptor.id !== 'string') {
				collector.error(localize('requireidstring', "property `{0}` is mandatory and must be of type `string`. Only alphanumeric characters, '_', and '-' are allowed.", 'id'));
				return false;
			}
			if (!(/^[a-z0-9_-]+$/i.test(descriptor.id))) {
				collector.error(localize('requireidstring', "property `{0}` is mandatory and must be of type `string`. Only alphanumeric characters, '_', and '-' are allowed.", 'id'));
				return false;
			}
			if (typeof descriptor.title !== 'string') {
				collector.error(localize('requirestring', "property `{0}` is mandatory and must be of type `string`", 'title'));
				return false;
			}
			if (typeof descriptor.icon !== 'string') {
				collector.error(localize('requirestring', "property `{0}` is mandatory and must be of type `string`", 'icon'));
				return false;
			}
		}

		return true;
	}

	private registerCustomViewContainers(containers: IUserFriendlyViewsContainerDescriptor[], extension: IExtensionDescription, order: number, existingViewContainers: ViewContainer[], location: ViewContainerLocation): number {
		containers.forEach(descriptor => {
			const icon = resources.joinPath(extension.extensionLocation, descriptor.icon);
			const id = `workbench.view.extension.${descriptor.id}`;
			const viewContainer = this.registerCustomViewContainer(id, descriptor.title, icon, order++, extension.identifier, location);

			// Move those views that belongs to this container
			if (existingViewContainers.length) {
				const viewsToMove: IViewDescriptor[] = [];
				for (const existingViewContainer of existingViewContainers) {
					if (viewContainer !== existingViewContainer) {
						viewsToMove.push(...this.viewsRegistry.getViews(existingViewContainer).filter(view => (view as ICustomViewDescriptor).originalContainerId === descriptor.id));
					}
				}
				if (viewsToMove.length) {
					this.viewsRegistry.moveViews(viewsToMove, viewContainer);
				}
			}
		});
		return order;
	}

	private registerCustomViewContainer(id: string, title: string, icon: URI | string, order: number, extensionId: ExtensionIdentifier | undefined, location: ViewContainerLocation): ViewContainer {
		let viewContainer = this.viewContainersRegistry.get(id);

		if (!viewContainer) {

			viewContainer = this.viewContainersRegistry.registerViewContainer({
				id,
				name: title, extensionId,
				ctorDescriptor: new SyncDescriptor(
					ViewPaneContainer,
					[id, { mergeViewWithContainerWhenSingleView: true }]
				),
				hideIfEmpty: true,
				order,
				icon,
			}, location);

			// Register Action to Open Viewlet
			class OpenCustomViewletAction extends ShowViewletAction {
				constructor(
					id: string, label: string,
					@IViewletService viewletService: IViewletService,
					@IEditorGroupsService editorGroupService: IEditorGroupsService,
					@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService
				) {
					super(id, label, id, viewletService, editorGroupService, layoutService);
				}
			}
			const registry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
			registry.registerWorkbenchAction(
				SyncActionDescriptor.create(OpenCustomViewletAction, id, localize('showViewlet', "Show {0}", title)),
				`View: Show ${title}`,
				localize('view', "View")
			);
		}

		return viewContainer;
	}

	private deregisterCustomViewContainer(viewContainer: ViewContainer): void {
		this.viewContainersRegistry.deregisterViewContainer(viewContainer);
		Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets).deregisterViewlet(viewContainer.id);
	}

	private handleAndRegisterCustomViews() {
		viewsExtensionPoint.setHandler((extensions, { added, removed }) => {
			if (removed.length) {
				this.removeViews(removed);
			}
			if (added.length) {
				this.addViews(added);
			}
		});
	}

	private addViews(extensions: readonly IExtensionPointUser<ViewExtensionPointType>[]): void {
		const viewIds: Set<string> = new Set<string>();
		const allViewDescriptors: { views: IViewDescriptor[], viewContainer: ViewContainer }[] = [];

		for (const extension of extensions) {
			const { value, collector } = extension;

			forEach(value, entry => {
				if (!this.isValidViewDescriptors(entry.value, collector)) {
					return;
				}

				if (entry.key === 'remote' && !extension.description.enableProposedApi) {
					collector.warn(localize('ViewContainerRequiresProposedAPI', "View container '{0}' requires 'enableProposedApi' turned on to be added to 'Remote'.", entry.key));
					return;
				}

				const viewContainer = this.getViewContainer(entry.key);
				if (!viewContainer) {
					collector.warn(localize('ViewContainerDoesnotExist', "View container '{0}' does not exist and all views registered to it will be added to 'Explorer'.", entry.key));
				}
				const container = viewContainer || this.getDefaultViewContainer();
				const viewDescriptors = coalesce(entry.value.map((item, index) => {
					// validate
					if (viewIds.has(item.id)) {
						collector.error(localize('duplicateView1', "Cannot register multiple views with same id `{0}`", item.id));
						return null;
					}
					if (this.viewsRegistry.getView(item.id) !== null) {
						collector.error(localize('duplicateView2', "A view with id `{0}` is already registered.", item.id));
						return null;
					}

					const order = ExtensionIdentifier.equals(extension.description.identifier, container.extensionId)
						? index + 1
						: container.viewOrderDelegate
							? container.viewOrderDelegate.getOrder(item.group)
							: undefined;

					const icon = item.icon ? resources.joinPath(extension.description.extensionLocation, item.icon) : undefined;
					const initialVisibility = this.convertInitialVisibility(item.visibility);

					const type = this.getViewType(item.type);
					if (!type) {
						collector.error(localize('unknownViewType', "Unknown view type `{0}`.", item.type));
						return null;
					}

					if (type === ViewType.Webview && !extension.description.enableProposedApi) {
						collector.error(localize('webviewViewsRequireProposed', "Webview views are proposed api and are only supported when running out of dev or with the following command line switch: --enable-proposed-api"));
						return null;
					}

					const viewDescriptor = <ICustomTreeViewDescriptor>{
						type: type,
						ctorDescriptor: type === ViewType.Tree ? new SyncDescriptor(TreeViewPane) : new SyncDescriptor(WebviewViewPane),
						id: item.id,
						name: item.name,
						when: ContextKeyExpr.deserialize(item.when),
						containerIcon: icon || viewContainer?.icon,
						containerTitle: item.contextualTitle || viewContainer?.name,
						canToggleVisibility: true,
						canMoveView: true,
						treeView: type === ViewType.Tree ? this.instantiationService.createInstance(CustomTreeView, item.id, item.name) : undefined,
						collapsed: this.showCollapsed(container) || initialVisibility === InitialVisibility.Collapsed,
						order: order,
						extensionId: extension.description.identifier,
						originalContainerId: entry.key,
						group: item.group,
						remoteAuthority: item.remoteName || (<any>item).remoteAuthority, // TODO@roblou - delete after remote extensions are updated
						hideByDefault: initialVisibility === InitialVisibility.Hidden
					};


					viewIds.add(viewDescriptor.id);
					return viewDescriptor;
				}));

				allViewDescriptors.push({ viewContainer: container, views: viewDescriptors });

			});
		}

		this.viewsRegistry.registerViews2(allViewDescriptors);
	}

	private getViewType(type: string | undefined): ViewType | undefined {
		if (type === ViewType.Webview) {
			return ViewType.Webview;
		}
		if (!type || type === ViewType.Tree) {
			return ViewType.Tree;
		}
		return undefined;
	}

	private getDefaultViewContainer(): ViewContainer {
		return this.viewContainersRegistry.get(EXPLORER)!;
	}

	private removeViews(extensions: readonly IExtensionPointUser<ViewExtensionPointType>[]): void {
		const removedExtensions: Set<string> = extensions.reduce((result, e) => { result.add(ExtensionIdentifier.toKey(e.description.identifier)); return result; }, new Set<string>());
		for (const viewContainer of this.viewContainersRegistry.all) {
			const removedViews = this.viewsRegistry.getViews(viewContainer).filter(v => (v as ICustomViewDescriptor).extensionId && removedExtensions.has(ExtensionIdentifier.toKey((v as ICustomViewDescriptor).extensionId)));
			if (removedViews.length) {
				this.viewsRegistry.deregisterViews(removedViews, viewContainer);
			}
		}
	}

	private convertInitialVisibility(value: any): InitialVisibility | undefined {
		if (Object.values(InitialVisibility).includes(value)) {
			return value;
		}
		return undefined;
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
			if (descriptor.icon && typeof descriptor.icon !== 'string') {
				collector.error(localize('optstring', "property `{0}` can be omitted or must be of type `string`", 'icon'));
				return false;
			}
			if (descriptor.contextualTitle && typeof descriptor.contextualTitle !== 'string') {
				collector.error(localize('optstring', "property `{0}` can be omitted or must be of type `string`", 'contextualTitle'));
				return false;
			}
			if (descriptor.visibility && !this.convertInitialVisibility(descriptor.visibility)) {
				collector.error(localize('optenum', "property `{0}` can be omitted or must be one of {1}", 'visibility', Object.values(InitialVisibility).join(', ')));
				return false;
			}
		}

		return true;
	}

	private getViewContainer(value: string): ViewContainer | undefined {
		switch (value) {
			case 'explorer': return this.viewContainersRegistry.get(EXPLORER);
			case 'debug': return this.viewContainersRegistry.get(DEBUG);
			case 'scm': return this.viewContainersRegistry.get(SCM);
			case 'remote': return this.viewContainersRegistry.get(REMOTE);
			case 'notebooks': return this.viewContainersRegistry.get(NOTEBOOK); // {{SQL CARBON EDIT}}
			default: return this.viewContainersRegistry.get(`workbench.view.extension.${value}`);
		}
	}

	private showCollapsed(container: ViewContainer): boolean {
		switch (container.id) {
			case EXPLORER:
			case SCM:
			case DEBUG:
				return true;
		}
		return false;
	}
}

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(ViewsExtensionHandler, LifecyclePhase.Starting);
