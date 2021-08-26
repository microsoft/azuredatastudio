/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/objectTypes/objecttypes';

import * as dom from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile, IconPath } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { iconRenderer } from 'sql/workbench/services/objectExplorer/browser/iconRenderer';
import { URI } from 'vs/base/common/uri';
import { ITreeRenderer, ITreeNode } from 'vs/base/browser/ui/tree/tree';
import { FuzzyScore } from 'vs/base/common/filters';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IKeyboardNavigationLabelProvider } from 'vs/base/browser/ui/list/list';
import { IListAccessibilityProvider } from 'vs/base/browser/ui/list/listWidget';
import { ServerTreeRenderer } from 'sql/workbench/services/objectExplorer/browser/serverTreeRenderer';
import { ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';
import { DefaultServerGroupColor } from 'sql/workbench/services/serverGroup/common/serverGroupViewModel';
import { withNullAsUndefined } from 'vs/base/common/types';
import { instanceOfSqlThemeIcon } from 'sql/workbench/services/objectExplorer/common/nodeType';

const DefaultConnectionIconClass = 'server-page';

export interface ConnectionProfileGroupDisplayOptions {
	showColor: boolean;
}

class ConnectionProfileGroupTemplate extends Disposable {
	private _root: HTMLElement;
	private _nameContainer: HTMLElement;

	constructor(
		container: HTMLElement,
		private _option: ConnectionProfileGroupDisplayOptions
	) {
		super();
		container.parentElement!.classList.add('server-group');
		container.classList.add('server-group');
		this._root = dom.append(container, dom.$('.server-group'));
		this._nameContainer = dom.append(this._root, dom.$('span.name'));
	}

	set(element: ConnectionProfileGroup) {
		let rowElement = findParentElement(this._root, 'monaco-list-row');
		if (this._option.showColor && rowElement) {
			rowElement.style.color = element.textColor;
			if (element.color) {
				rowElement.style.background = element.color;
			} else {
				// If the group doesn't contain specific color, assign the default color
				rowElement.style.background = DefaultServerGroupColor;
			}
		}
		if (element.description && (element.description !== '')) {
			this._root.title = element.description;
		}
		this._nameContainer.hidden = false;
		this._nameContainer.textContent = element.name;
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
		template.set(node.element);
	}
	disposeTemplate(templateData: ConnectionProfileGroupTemplate): void {
		templateData.dispose();
	}
}

class ConnectionProfileTemplate extends Disposable {

	private _root: HTMLElement;
	private _icon: HTMLElement;
	private _connectionStatusBadge: HTMLElement;
	private _label: HTMLElement;
	/**
	 * _isCompact is used to render connections tiles with and without the action buttons.
	 * When set to true, like in the connection dialog recent connections tree, the connection
	 * tile is rendered without the action buttons( such as connect, new query).
	 */
	constructor(
		container: HTMLElement,
		private _isCompact: boolean,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super();
		container.parentElement!.classList.add('connection-profile');
		this._root = dom.append(container, dom.$('.connection-tile'));
		this._icon = dom.append(this._root, dom.$('div.icon'));
		this._connectionStatusBadge = dom.append(this._icon, dom.$('div.connection-status-badge'));
		this._label = dom.append(this._root, dom.$('div.label'));
	}

	set(element: ConnectionProfile) {
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
		let label = element.title;
		if (!element.isConnectionOptionsValid) {
			label = localize('loading', "Loading...");
		}

		this._label.textContent = label;
		this._root.title = element.serverInfo;
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
		template.set(node.element);
	}
	disposeTemplate(templateData: ConnectionProfileTemplate): void {
		templateData.dispose();
	}
}

class TreeNodeTemplate extends Disposable {
	private _root: HTMLElement;
	private _icon: HTMLElement;
	private _label: HTMLElement;

	constructor(
		container: HTMLElement
	) {
		super();
		this._root = dom.append(container, dom.$('.object-element-group'));
		this._icon = dom.append(this._root, dom.$('div.object-icon'));
		this._label = dom.append(this._root, dom.$('div.label'));
	}

	set(element: TreeNode) {
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

		this._label.textContent = element.label;
		this._root.title = element.label;
	}
}

export class TreeNodeRenderer implements ITreeRenderer<TreeNode, FuzzyScore, TreeNodeTemplate> {

	readonly templateId: string = ServerTreeRenderer.OBJECTEXPLORER_TEMPLATE_ID;

	constructor(@IInstantiationService private readonly _instantiationService: IInstantiationService) { }

	renderTemplate(container: HTMLElement): TreeNodeTemplate {
		return this._instantiationService.createInstance(TreeNodeTemplate, container);
	}

	renderElement(node: ITreeNode<TreeNode, FuzzyScore>, index: number, template: TreeNodeTemplate): void {
		template.set(node.element);
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

/**
 * Returns the first parent which contains the className
 */
function findParentElement(container: HTMLElement, className: string): HTMLElement | undefined {
	let currentElement: HTMLElement | null = container;
	while (currentElement) {
		if (currentElement.className.indexOf(className) > -1) {
			break;
		}
		currentElement = currentElement.parentElement;
	}
	return withNullAsUndefined(currentElement);
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
