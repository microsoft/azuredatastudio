/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as resources from 'vs/base/common/resources';
import { isFalsyOrWhitespace } from 'vs/base/common/strings';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { ExtensionIdentifier, ExtensionIdentifierSet, IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { Registry } from 'vs/platform/registry/common/platform';
import { ThemeIcon } from 'vs/base/common/themables';
import { Extensions as ViewletExtensions, PaneCompositeRegistry } from 'vs/workbench/browser/panecomposite';
import { CustomTreeView, RawCustomTreeViewContextKey, TreeViewPane } from 'vs/workbench/browser/parts/views/treeView';
import { ViewPaneContainer } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { Extensions as WorkbenchExtensions, IWorkbenchContribution, IWorkbenchContributionsRegistry } from 'vs/workbench/common/contributions';
import { Extensions as ViewContainerExtensions, ICustomViewDescriptor, IViewContainersRegistry, IViewDescriptor, IViewsRegistry, ResolvableTreeItem, ViewContainer, ViewContainerLocation } from 'vs/workbench/common/views';
import { VIEWLET_ID as DEBUG } from 'vs/workbench/contrib/debug/common/debug';
import { VIEWLET_ID as EXPLORER } from 'vs/workbench/contrib/files/common/files';
import { VIEWLET_ID as REMOTE } from 'vs/workbench/contrib/remote/browser/remoteExplorer';
import { VIEWLET_ID as NOTEBOOK } from 'sql/workbench/contrib/notebook/browser/notebookExplorer/notebookExplorerViewlet'; // {{SQL CARBON EDIT}}
import { VIEWLET_ID as SCM } from 'vs/workbench/contrib/scm/common/scm';
import { WebviewViewPane } from 'vs/workbench/contrib/webviewView/browser/webviewViewPane';
import { isProposedApiEnabled } from 'vs/workbench/services/extensions/common/extensions';
import { ExtensionMessageCollector, ExtensionsRegistry, IExtensionPoint, IExtensionPointUser } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { KeyChord, KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { IListService, WorkbenchListFocusContextKey } from 'vs/platform/list/browser/listService';
import { IHoverService } from 'vs/workbench/services/hover/browser/hover';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { AsyncDataTree } from 'vs/base/browser/ui/tree/asyncDataTree';
import { ITreeViewsService } from 'vs/workbench/services/views/browser/treeViewsService';
import { HoverPosition } from 'vs/base/browser/ui/hover/hoverWidget';
import { ILogService } from 'vs/platform/log/common/log';

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

	initialSize?: number;

	// From 'remoteViewDescriptor' type
	group?: string;
	remoteName?: string | string[];
	virtualWorkspace?: string;
}

enum InitialVisibility {
	Visible = 'visible',
	Hidden = 'hidden',
	Collapsed = 'collapsed'
}

const viewDescriptor: IJSONSchema = {
	type: 'object',
	required: ['id', 'name'],
	defaultSnippets: [{ body: { id: '${1:id}', name: '${2:name}' } }],
	properties: {
		type: {
			markdownDescription: localize('vscode.extension.contributes.view.type', "Type of the view. This can either be `tree` for a tree view based view or `webview` for a webview based view. The default is `tree`."),
			type: 'string',
			enum: [
				'tree',
				'webview',
			],
			markdownEnumDescriptions: [
				localize('vscode.extension.contributes.view.tree', "The view is backed by a `TreeView` created by `createTreeView`."),
				localize('vscode.extension.contributes.view.webview', "The view is backed by a `WebviewView` registered by `registerWebviewViewProvider`."),
			]
		},
		id: {
			markdownDescription: localize('vscode.extension.contributes.view.id', 'Identifier of the view. This should be unique across all views. It is recommended to include your extension id as part of the view id. Use this to register a data provider through `vscode.window.registerTreeDataProviderForView` API. Also to trigger activating your extension by registering `onView:${id}` event to `activationEvents`.'),
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
			description: localize('vscode.extension.contributes.view.contextualTitle', "Human-readable context for when the view is moved out of its original location. By default, the view's container name will be used."),
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
		},
		initialSize: {
			type: 'number',
			description: localize('vscode.extension.contributs.view.size', "The initial size of the view. The size will behave like the css 'flex' property, and will set the initial size when the view is first shown. In the side bar, this is the height of the view. This value is only respected when the same extension owns both the view and the view container."),
		}
	}
};

const remoteViewDescriptor: IJSONSchema = {
	type: 'object',
	required: ['id', 'name'],
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

type ViewContainerExtensionPointType = { [loc: string]: IUserFriendlyViewsContainerDescriptor[] };
const viewsContainersExtensionPoint: IExtensionPoint<ViewContainerExtensionPointType> = ExtensionsRegistry.registerExtensionPoint<ViewContainerExtensionPointType>({
	extensionPoint: 'viewsContainers',
	jsonSchema: viewsContainersContribution
});

type ViewExtensionPointType = { [loc: string]: IUserFriendlyViewDescriptor[] };
const viewsExtensionPoint: IExtensionPoint<ViewExtensionPointType> = ExtensionsRegistry.registerExtensionPoint<ViewExtensionPointType>({
	extensionPoint: 'views',
	deps: [viewsContainersExtensionPoint],
	jsonSchema: viewsContribution,
	activationEventsGenerator: (viewExtensionPointTypeArray, result) => {
		for (const viewExtensionPointType of viewExtensionPointTypeArray) {
			for (const viewDescriptors of Object.values(viewExtensionPointType)) {
				for (const viewDescriptor of viewDescriptors) {
					if (viewDescriptor.id) {
						result.push(`onView:${viewDescriptor.id}`);
					}
				}
			}
		}
	}
});

const CUSTOM_VIEWS_START_ORDER = 7;

class ViewsExtensionHandler implements IWorkbenchContribution {

	private viewContainersRegistry: IViewContainersRegistry;
	private viewsRegistry: IViewsRegistry;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService
	) {
		this.viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
		this.viewsRegistry = Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry);
		this.handleAndRegisterCustomViewContainers();
		this.handleAndRegisterCustomViews();

		let showTreeHoverCancellation = new CancellationTokenSource();
		KeybindingsRegistry.registerCommandAndKeybindingRule({
			id: 'workbench.action.showTreeHover',
			handler: async (accessor: ServicesAccessor, ...args: any[]) => {
				showTreeHoverCancellation.cancel();
				showTreeHoverCancellation = new CancellationTokenSource();
				const listService = accessor.get(IListService);
				const treeViewsService = accessor.get(ITreeViewsService);
				const hoverService = accessor.get(IHoverService);
				const lastFocusedList = listService.lastFocusedList;
				if (!(lastFocusedList instanceof AsyncDataTree)) {
					return;
				}
				const focus = lastFocusedList.getFocus();
				if (!focus || (focus.length === 0)) {
					return;
				}
				const treeItem = focus[0];

				if (treeItem instanceof ResolvableTreeItem) {
					await treeItem.resolve(showTreeHoverCancellation.token);
				}
				if (!treeItem.tooltip) {
					return;
				}
				const element = treeViewsService.getRenderedTreeElement(treeItem);
				if (!element) {
					return;
				}
				hoverService.showHover({
					content: treeItem.tooltip,
					target: element,
					hoverPosition: HoverPosition.BELOW,
					hideOnHover: false
				}, true);
			},
			weight: KeybindingWeight.WorkbenchContrib,
			primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyI),
			when: ContextKeyExpr.and(RawCustomTreeViewContextKey, WorkbenchListFocusContextKey)
		});
	}

	private handleAndRegisterCustomViewContainers() {
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
		let activityBarOrder = CUSTOM_VIEWS_START_ORDER + viewContainersRegistry.all.filter(v => !!v.extensionId && viewContainersRegistry.getViewContainerLocation(v) === ViewContainerLocation.Sidebar).length;
		let panelOrder = 5 + viewContainersRegistry.all.filter(v => !!v.extensionId && viewContainersRegistry.getViewContainerLocation(v) === ViewContainerLocation.Panel).length + 1;
		for (const { value, collector, description } of extensionPoints) {
			Object.entries(value).forEach(([key, value]) => {
				if (!this.isValidViewsContainer(value, collector)) {
					return;
				}
				switch (key) {
					case 'activitybar':
						activityBarOrder = this.registerCustomViewContainers(value, description, activityBarOrder, existingViewContainers, ViewContainerLocation.Sidebar);
						break;
					case 'panel':
						panelOrder = this.registerCustomViewContainers(value, description, panelOrder, existingViewContainers, ViewContainerLocation.Panel);
						break;
				}
			});
		}
	}

	private removeCustomViewContainers(extensionPoints: readonly IExtensionPointUser<ViewContainerExtensionPointType>[]): void {
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
		const removedExtensions: ExtensionIdentifierSet = extensionPoints.reduce((result, e) => { result.add(e.description.identifier); return result; }, new ExtensionIdentifierSet());
		for (const viewContainer of viewContainersRegistry.all) {
			if (viewContainer.extensionId && removedExtensions.has(viewContainer.extensionId)) {
				// move all views in this container into default view container
				const views = this.viewsRegistry.getViews(viewContainer);
				if (views.length) {
					this.viewsRegistry.moveViews(views, this.getDefaultViewContainer());
				}
				this.deregisterCustomViewContainer(viewContainer);
			}
		}
	}

	private isValidViewsContainer(viewsContainersDescriptors: IUserFriendlyViewsContainerDescriptor[], collector: ExtensionMessageCollector): boolean {
		if (!Array.isArray(viewsContainersDescriptors)) {
			collector.error(localize('viewcontainer requirearray', "views containers must be an array"));
			return false;
		}

		for (const descriptor of viewsContainersDescriptors) {
			if (typeof descriptor.id !== 'string' && isFalsyOrWhitespace(descriptor.id)) {
				collector.error(localize('requireidstring', "property `{0}` is mandatory and must be of type `string` with non-empty value. Only alphanumeric characters, '_', and '-' are allowed.", 'id'));
				return false;
			}
			if (!(/^[a-z0-9_-]+$/i.test(descriptor.id))) {
				collector.error(localize('requireidstring', "property `{0}` is mandatory and must be of type `string` with non-empty value. Only alphanumeric characters, '_', and '-' are allowed.", 'id'));
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
			if (isFalsyOrWhitespace(descriptor.title)) {
				collector.warn(localize('requirenonemptystring', "property `{0}` is mandatory and must be of type `string` with non-empty value", 'title'));
				return true;
			}
		}

		return true;
	}

	private registerCustomViewContainers(containers: IUserFriendlyViewsContainerDescriptor[], extension: IExtensionDescription, order: number, existingViewContainers: ViewContainer[], location: ViewContainerLocation): number {
		containers.forEach(descriptor => {
			const themeIcon = ThemeIcon.fromString(descriptor.icon);

			const icon = themeIcon || resources.joinPath(extension.extensionLocation, descriptor.icon);
			const id = `workbench.view.extension.${descriptor.id}`;
			const title = descriptor.title || id;
			const viewContainer = this.registerCustomViewContainer(id, title, icon, order++, extension.identifier, location);

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

	private registerCustomViewContainer(id: string, title: string, icon: URI | ThemeIcon, order: number, extensionId: ExtensionIdentifier | undefined, location: ViewContainerLocation): ViewContainer {
		let viewContainer = this.viewContainersRegistry.get(id);

		if (!viewContainer) {

			viewContainer = this.viewContainersRegistry.registerViewContainer({
				id,
				title, extensionId,
				ctorDescriptor: new SyncDescriptor(
					ViewPaneContainer,
					[id, { mergeViewWithContainerWhenSingleView: true }]
				),
				hideIfEmpty: true,
				order,
				icon,
			}, location);

		}

		return viewContainer;
	}

	private deregisterCustomViewContainer(viewContainer: ViewContainer): void {
		this.viewContainersRegistry.deregisterViewContainer(viewContainer);
		Registry.as<PaneCompositeRegistry>(ViewletExtensions.Viewlets).deregisterPaneComposite(viewContainer.id);
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
		const allViewDescriptors: { views: IViewDescriptor[]; viewContainer: ViewContainer }[] = [];

		for (const extension of extensions) {
			const { value, collector } = extension;

			Object.entries(value).forEach(([key, value]) => {
				if (!this.isValidViewDescriptors(value, collector)) {
					return;
				}

				if (key === 'remote' && !isProposedApiEnabled(extension.description, 'contribViewsRemote')) {
					collector.warn(localize('ViewContainerRequiresProposedAPI', "View container '{0}' requires 'enabledApiProposals: [\"contribViewsRemote\"]' to be added to 'Remote'.", key));
					return;
				}

				const viewContainer = this.getViewContainer(key);
				if (!viewContainer) {
					collector.warn(localize('ViewContainerDoesnotExist', "View container '{0}' does not exist and all views registered to it will be added to 'Explorer'.", key));
				}
				const container = viewContainer || this.getDefaultViewContainer();
				const viewDescriptors: ICustomViewDescriptor[] = [];

				for (let index = 0; index < value.length; index++) {
					const item = value[index];
					// validate
					if (viewIds.has(item.id)) {
						collector.error(localize('duplicateView1', "Cannot register multiple views with same id `{0}`", item.id));
						continue;
					}
					if (this.viewsRegistry.getView(item.id) !== null) {
						collector.error(localize('duplicateView2', "A view with id `{0}` is already registered.", item.id));
						continue;
					}

					const order = ExtensionIdentifier.equals(extension.description.identifier, container.extensionId)
						? index + 1
						: container.viewOrderDelegate
							? container.viewOrderDelegate.getOrder(item.group)
							: undefined;

					let icon: ThemeIcon | URI | undefined;
					if (typeof item.icon === 'string') {
						icon = ThemeIcon.fromString(item.icon) || resources.joinPath(extension.description.extensionLocation, item.icon);
					}

					const initialVisibility = this.convertInitialVisibility(item.visibility);

					const type = this.getViewType(item.type);
					if (!type) {
						collector.error(localize('unknownViewType', "Unknown view type `{0}`.", item.type));
						continue;
					}

					let weight: number | undefined = undefined;
					if (typeof item.initialSize === 'number') {
						if (container.extensionId?.value === extension.description.identifier.value) {
							weight = item.initialSize;
						} else {
							this.logService.warn(`${extension.description.identifier.value} tried to set the view size of ${item.id} but it was ignored because the view container does not belong to it.`);
						}
					}

					const viewDescriptor: ICustomViewDescriptor = {
						type: type,
						ctorDescriptor: type === ViewType.Tree ? new SyncDescriptor(TreeViewPane) : new SyncDescriptor(WebviewViewPane),
						id: item.id,
						name: item.name,
						when: ContextKeyExpr.deserialize(item.when),
						containerIcon: icon || viewContainer?.icon,
						containerTitle: item.contextualTitle || (viewContainer && (typeof viewContainer.title === 'string' ? viewContainer.title : viewContainer.title.value)),
						canToggleVisibility: true,
						canMoveView: viewContainer?.id !== REMOTE,
						treeView: type === ViewType.Tree ? this.instantiationService.createInstance(CustomTreeView, item.id, item.name, extension.description.identifier.value) : undefined,
						collapsed: this.showCollapsed(container) || initialVisibility === InitialVisibility.Collapsed,
						order: order,
						extensionId: extension.description.identifier,
						originalContainerId: key,
						group: item.group,
						remoteAuthority: item.remoteName || (<any>item).remoteAuthority, // TODO@roblou - delete after remote extensions are updated
						virtualWorkspace: item.virtualWorkspace,
						hideByDefault: initialVisibility === InitialVisibility.Hidden,
						workspace: viewContainer?.id === REMOTE ? true : undefined,
						weight
					};


					viewIds.add(viewDescriptor.id);
					viewDescriptors.push(viewDescriptor);
				}

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
		const removedExtensions: ExtensionIdentifierSet = extensions.reduce((result, e) => { result.add(e.description.identifier); return result; }, new ExtensionIdentifierSet());
		for (const viewContainer of this.viewContainersRegistry.all) {
			const removedViews = this.viewsRegistry.getViews(viewContainer).filter(v => (v as ICustomViewDescriptor).extensionId && removedExtensions.has((v as ICustomViewDescriptor).extensionId));
			if (removedViews.length) {
				this.viewsRegistry.deregisterViews(removedViews, viewContainer);
				for (const view of removedViews) {
					const anyView = view as ICustomViewDescriptor;
					if (anyView.treeView) {
						anyView.treeView.dispose();
					}
				}
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

		for (const descriptor of viewDescriptors) {
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
