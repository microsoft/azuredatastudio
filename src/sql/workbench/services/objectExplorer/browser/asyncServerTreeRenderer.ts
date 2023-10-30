/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/objectTypes/objecttypes';

import * as dom from 'vs/base/browser/dom';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile, IconPath } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { iconRenderer } from 'sql/workbench/services/objectExplorer/browser/iconRenderer';
import { URI } from 'vs/base/common/uri';
import { ITreeRenderer, ITreeNode } from 'vs/base/browser/ui/tree/tree';
import { FuzzyScore, createMatches } from 'vs/base/common/filters';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IKeyboardNavigationLabelProvider } from 'vs/base/browser/ui/list/list';
import { IListAccessibilityProvider } from 'vs/base/browser/ui/list/listWidget';
import { ServerTreeRenderer, getLabelWithFilteredSuffix } from 'sql/workbench/services/objectExplorer/browser/serverTreeRenderer';
import { ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';
import { DefaultServerGroupColor } from 'sql/workbench/services/serverGroup/common/serverGroupViewModel';
import { instanceOfSqlThemeIcon } from 'sql/workbench/services/objectExplorer/common/nodeType';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { ResourceLabel } from 'vs/workbench/browser/labels';
import { ActionBar } from 'sql/base/browser/ui/taskbar/actionbar';

const DefaultConnectionIconClass = 'server-page';
export interface ConnectionProfileGroupDisplayOptions {
	showColor: boolean;
}

class ConnectionProfileGroupTemplate extends Disposable {
	private _root: HTMLElement;
	private _icon: HTMLElement;
	private _labelContainer: HTMLElement;
	private _label: ResourceLabel;
	private _actionBar: ActionBar;

	constructor(
		container: HTMLElement,
		private _option: ConnectionProfileGroupDisplayOptions,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService
	) {
		super();
		container.parentElement!.classList.add('async-server-group');
		container.classList.add('async-server-group');
		this._root = dom.append(container, dom.$('.async-server-group-container'));
		this._icon = dom.append(this._root, dom.$('div.icon'));
		this._labelContainer = dom.append(this._root, dom.$('span.name'));
		this._label = this._instantiationService.createInstance(ResourceLabel, this._labelContainer, { supportHighlights: true });
		const actionsContainer = dom.append(this._label.element.element, dom.$('.actions'));
		this._actionBar = new ActionBar(actionsContainer, {
		});
	}

	set(element: ConnectionProfileGroup, filterData: FuzzyScore) {
		if (this._option.showColor) {
			// If the color is not defined, use the default color
			const backgroundColor = element.color ?? DefaultServerGroupColor;
			this._icon.style.background = backgroundColor;
		}
		if (element.description && (element.description !== '')) {
			this._root.title = element.description;
		}
		this._labelContainer.hidden = false;
		this._label.element.setLabel(element.name, '', {
			matches: createMatches(filterData)
		});

		let serverTreeView = this._objectExplorerService.getServerTreeView();
		if (serverTreeView) {
			const actionProvider = serverTreeView.treeActionProvider;
			const tree = serverTreeView.tree;
			const actions = actionProvider.getActions(tree, element, true);
			this._actionBar.context = serverTreeView.getActionContext(element);
			this._actionBar.clear();
			this._actionBar.pushAction(actions, { icon: true, label: false });
		} else {
			console.log('Server Tree view not loaded, action bar will not be populated.');
		}
	}
}

export class ConnectionProfileGroupRenderer implements ITreeRenderer<ConnectionProfileGroup, FuzzyScore, ConnectionProfileGroupTemplate> {

	readonly templateId: string = ServerTreeRenderer.CONNECTION_GROUP_TEMPLATE_ID;

	constructor(private _options: ConnectionProfileGroupDisplayOptions,
		@IInstantiationService private readonly _instantiationService: IInstantiationService) { }

	renderTemplate(container: HTMLElement): ConnectionProfileGroupTemplate {
		return this._instantiationService.createInstance(ConnectionProfileGroupTemplate, container, this._options);
	}
	renderElement(node: ITreeNode<ConnectionProfileGroup, FuzzyScore>, index: number, template: ConnectionProfileGroupTemplate): void {
		template.set(node.element, node.filterData);
	}
	disposeTemplate(templateData: ConnectionProfileGroupTemplate): void {
		templateData.dispose();
	}
}

class ConnectionProfileTemplate extends Disposable {

	private _root: HTMLElement;
	private _icon: HTMLElement;
	private _connectionStatusBadge: HTMLElement;
	private _labelContainer: HTMLElement;
	private _label: ResourceLabel;
	private _actionBar: ActionBar;

	/**
	 * _isCompact is used to render connections tiles with and without the action buttons.
	 * When set to true, like in the connection dialog recent connections tree, the connection
	 * tile is rendered without the action buttons( such as connect, new query).
	 */
	constructor(
		container: HTMLElement,
		private _isCompact: boolean,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService
	) {
		super();
		container.parentElement!.classList.add('connection-profile');
		this._root = dom.append(container, dom.$('.connection-profile-container'));
		this._icon = dom.append(this._root, dom.$('div.icon'));
		this._connectionStatusBadge = dom.append(this._icon, dom.$('div.connection-status-badge'));
		this._labelContainer = dom.append(this._root, dom.$('div.label'));
		this._label = this._instantiationService.createInstance(ResourceLabel, this._labelContainer, { supportHighlights: true });
		const actionsContainer = dom.append(this._label.element.element, dom.$('.actions'));
		this._actionBar = new ActionBar(actionsContainer, {
		});
	}

	set(element: ConnectionProfile, filterData: FuzzyScore) {
		if (!this._isCompact) {
			if (this._connectionManagementService.isConnected(undefined, element)) {
				this._connectionStatusBadge.classList.remove('disconnected');
				this._connectionStatusBadge.classList.add('connected');
			} else {
				this._connectionStatusBadge.classList.remove('connected');
				this._connectionStatusBadge.classList.add('disconnected');
			}
		}

		const iconPath: IconPath | undefined = getIconPath(element, this._connectionManagementService);
		renderServerIcon(this._icon, iconPath);

		const treeNode = this._objectExplorerService.getObjectExplorerNode(element);
		let labelText = treeNode?.filters?.length > 0 ? getLabelWithFilteredSuffix(element.title) : element.title;
		this._label.element.setLabel(labelText, '', {
			matches: createMatches(filterData)
		});
		this._root.title = treeNode?.filters?.length > 0 ? getLabelWithFilteredSuffix(element.serverInfo) : element.serverInfo;
		let serverTreeView = this._objectExplorerService.getServerTreeView();
		if (serverTreeView) {
			const actionProvider = serverTreeView.treeActionProvider;
			if (!this._isCompact) {
				const tree = serverTreeView.tree;
				const actions = actionProvider.getActions(tree, element, true);
				this._actionBar.context = serverTreeView.getActionContext(element);
				this._actionBar.clear();
				this._actionBar.pushAction(actions, { icon: true, label: false });
			} else {
				const actions = actionProvider.getRecentConnectionActions(element);
				this._actionBar.context = undefined;
				this._actionBar.clear();
				this._actionBar.pushAction(actions, { icon: true, label: false });
			}
		} else {
			console.log('Server Tree view not loaded, action bar will not be populated.');
		}
	}
}

export class ConnectionProfileRenderer implements ITreeRenderer<ConnectionProfile, FuzzyScore, ConnectionProfileTemplate> {

	readonly templateId: string = ServerTreeRenderer.CONNECTION_TEMPLATE_ID;

	constructor(
		private _isCompact: boolean,
		@IInstantiationService private readonly _instantiationService: IInstantiationService) { }

	renderTemplate(container: HTMLElement): ConnectionProfileTemplate {
		return this._instantiationService.createInstance(ConnectionProfileTemplate, container, this._isCompact);
	}
	renderElement(node: ITreeNode<ConnectionProfile, FuzzyScore>, index: number, template: ConnectionProfileTemplate): void {
		template.set(node.element, node.filterData);
	}
	disposeTemplate(templateData: ConnectionProfileTemplate): void {
		templateData.dispose();
	}
}

class TreeNodeTemplate extends Disposable {
	private _root: HTMLElement;
	private _icon: HTMLElement;
	private _labelContainer: HTMLElement;
	private _label: ResourceLabel;
	private _actionBar: ActionBar;

	constructor(
		container: HTMLElement,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService
	) {
		super();
		this._root = dom.append(container, dom.$('.object-element-container'));
		this._icon = dom.append(this._root, dom.$('div.object-icon'));
		this._labelContainer = dom.append(this._root, dom.$('div.label'));
		this._label = this._instantiationService.createInstance(ResourceLabel, this._labelContainer, { supportHighlights: true });
		const actionsContainer = dom.append(this._label.element.element, dom.$('.actions'));
		this._actionBar = new ActionBar(actionsContainer, {
		});
	}

	set(element: TreeNode, filterData: FuzzyScore) {
		// Use an explicitly defined iconType first. If not defined, fall back to using nodeType and
		// other compount indicators instead.
		let iconName: string | undefined = undefined;
		if (element.iconType) {
			iconName = (typeof element.iconType === 'string') ? element.iconType : element.iconType.id;
		} else if (instanceOfSqlThemeIcon(element.icon)) {
			iconName = element.icon.id;
		} else {
			iconName = element.nodeTypeId;
			if (element.nodeStatus) {
				iconName = element.nodeTypeId + '_' + element.nodeStatus;
			}
			if (element.nodeSubType) {
				iconName = element.nodeTypeId + '_' + element.nodeSubType;
			}
		}

		let tokens: string[] = [];
		for (let index = 1; index < this._icon.classList.length; index++) {
			tokens.push(this._icon.classList.item(index)!);
		}
		this._icon.classList.remove(...tokens);
		this._icon.classList.add('icon');
		let iconLowerCaseName = iconName.toLocaleLowerCase();
		if (iconLowerCaseName) {
			this._icon.classList.add(iconLowerCaseName);
		}

		iconRenderer.removeIcon(this._icon);
		if (element.icon && !instanceOfSqlThemeIcon(element.icon)) {
			iconRenderer.putIcon(this._icon, element.icon);
		}

		const labelText = element.filters.length > 0 ? getLabelWithFilteredSuffix(element.label) :
			element.label;
		this._label.element.setLabel(labelText, '', {
			matches: createMatches(filterData)
		});
		this._root.title = labelText;
		let serverTreeView = this._objectExplorerService.getServerTreeView();
		if (serverTreeView) {
			const tree = serverTreeView.tree;
			const actionProvider = serverTreeView.treeActionProvider;
			const actions = actionProvider.getActions(tree, element, true);
			this._actionBar.context = serverTreeView.getActionContext(element);
			this._actionBar.clear();
			this._actionBar.pushAction(actions, { icon: true, label: false });
		} else {
			console.log('Server Tree view not loaded, action bar will not be populated.');
		}
	}
}

export class TreeNodeRenderer implements ITreeRenderer<TreeNode, FuzzyScore, TreeNodeTemplate> {

	readonly templateId: string = ServerTreeRenderer.OBJECTEXPLORER_TEMPLATE_ID;

	constructor(@IInstantiationService private readonly _instantiationService: IInstantiationService) { }

	renderTemplate(container: HTMLElement): TreeNodeTemplate {
		return this._instantiationService.createInstance(TreeNodeTemplate, container);
	}

	renderElement(node: ITreeNode<TreeNode, FuzzyScore>, index: number, template: TreeNodeTemplate): void {
		template.set(node.element, node.filterData);
	}

	disposeTemplate(templateData: TreeNodeTemplate): void {
		templateData.dispose();
	}
}

export class ServerTreeKeyboardNavigationLabelProvider implements IKeyboardNavigationLabelProvider<ServerTreeElement> {

	constructor() { }

	getKeyboardNavigationLabel(element: ServerTreeElement): { toString(): string; } {
		if (element instanceof ConnectionProfileGroup) {
			return element.groupName;
		} else if (element instanceof ConnectionProfile) {
			return element.title;
		} else {
			return element.label;
		}
	}
}

export class ServerTreeAccessibilityProvider implements IListAccessibilityProvider<ServerTreeElement> {

	constructor(private _widgetAriaLabel: string) { }

	getWidgetAriaLabel(): string {
		return this._widgetAriaLabel;
	}

	getAriaLabel(element: ServerTreeElement): string | null {
		if (element instanceof ConnectionProfileGroup) {
			return element.fullName ?? null;
		} else if (element instanceof ConnectionProfile) {
			return element.title;
		}
		return element.label;
	}
}

function getIconPath(connection: ConnectionProfile, connectionManagementService: IConnectionManagementService): IconPath | undefined {
	if (!connection) { return undefined; }

	if (connection.iconPath) {
		return connection.iconPath;
	}

	let iconId = connectionManagementService.getConnectionIconId(connection.id);
	let providerProperties = connectionManagementService.getProviderProperties(connection.providerName);
	if (!providerProperties) { return undefined; }

	let iconPath: IconPath | undefined = undefined;
	let pathConfig: URI | IconPath | { id: string, path: IconPath, default?: boolean }[] | undefined = providerProperties['iconPath'];
	if (Array.isArray(pathConfig)) {
		for (const e of pathConfig) {
			if (!e.id || e.id === iconId || (!iconId && e.default)) {
				iconPath = e.path;
				connection['iconPath'] = iconPath;
				break;
			}
		}
	} else if (URI.isUri(pathConfig)) {
		iconPath = { light: pathConfig, dark: pathConfig };
		connection.iconPath = iconPath;
	} else {
		connection.iconPath = pathConfig;
	}
	return iconPath;
}

function renderServerIcon(element: HTMLElement, iconPath?: IconPath): void {
	if (!element) { return; }
	if (iconPath) {
		element.classList.remove(DefaultConnectionIconClass);
		iconRenderer.putIcon(element, iconPath);
	} else {
		// use default connection icon if iconPath is not available
		element.classList.add(DefaultConnectionIconClass);
		// the icon css class is applied to the node by ID selector
		// clear the id to avoid icon mismatch when drag&drop in OE tree because of element reusing by the tree component.
		element.id = '';
	}
}
