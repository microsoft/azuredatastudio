/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/objectTypes/objecttypes';

import * as dom from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ITree, IRenderer } from 'vs/base/parts/tree/browser/tree';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { badgeRenderer, iconRenderer } from 'sql/workbench/services/objectExplorer/browser/iconRenderer';
import { URI } from 'vs/base/common/uri';
import { DefaultServerGroupColor } from 'sql/workbench/services/serverGroup/common/serverGroupViewModel';
import { withNullAsUndefined } from 'vs/base/common/types';
import { instanceOfSqlThemeIcon } from 'sql/workbench/services/objectExplorer/common/nodeType';

export interface IConnectionTemplateData {
	root: HTMLElement;
	label: HTMLSpanElement;
	icon: HTMLElement;
	connectionProfile: ConnectionProfile;
}

export interface IConnectionProfileGroupTemplateData {
	root: HTMLElement;
	name: HTMLSpanElement;
	inputBox: InputBox;
}

export interface IObjectExplorerTemplateData {
	root: HTMLElement;
	label: HTMLSpanElement;
	icon: HTMLElement;
	treeNode: TreeNode;
}

/**
 * Renders the tree items.
 * Uses the dom template to render connection groups and connections.
 */
export class ServerTreeRenderer implements IRenderer {

	public static CONNECTION_HEIGHT = 23;
	public static CONNECTION_GROUP_HEIGHT = 33;
	public static CONNECTION_TEMPLATE_ID = 'connectionProfile';
	public static CONNECTION_GROUP_TEMPLATE_ID = 'connectionProfileGroup';
	public static OBJECTEXPLORER_HEIGHT = 23;
	public static OBJECTEXPLORER_TEMPLATE_ID = 'objectExplorer';
	/**
	 * _isCompact is used to render connections tiles with and without the action buttons.
	 * When set to true, like in the connection dialog recent connections tree, the connection
	 * tile is rendered without the action buttons( such as connect, new query).
	 */
	private _isCompact: boolean = false;

	constructor(
		isCompact: boolean,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		// isCompact defaults to false unless explicitly set by instantiation call.
		if (isCompact) {
			this._isCompact = isCompact;
		}
	}

	/**
	 * Returns the element's height in the tree, in pixels.
	 */
	public getHeight(tree: ITree, element: any): number {
		if (element instanceof ConnectionProfileGroup) {
			return ServerTreeRenderer.CONNECTION_GROUP_HEIGHT;
		} else if (element instanceof ConnectionProfile) {
			return ServerTreeRenderer.CONNECTION_HEIGHT;
		}
		return ServerTreeRenderer.OBJECTEXPLORER_HEIGHT;
	}

	/**
	 * Returns a template ID for a given element.
	 */
	public getTemplateId(tree: ITree, element: any): string {
		if (element instanceof ConnectionProfileGroup) {
			return ServerTreeRenderer.CONNECTION_GROUP_TEMPLATE_ID;
		} else if (element instanceof ConnectionProfile) {
			return ServerTreeRenderer.CONNECTION_TEMPLATE_ID;
		}
		return ServerTreeRenderer.OBJECTEXPLORER_TEMPLATE_ID;
	}

	/**
	 * Render template in a dom element based on template id
	 */
	public renderTemplate(tree: ITree, templateId: string, container: HTMLElement): any {

		if (templateId === ServerTreeRenderer.CONNECTION_TEMPLATE_ID) {
			const connectionTemplate: IObjectExplorerTemplateData = Object.create(null);
			connectionTemplate.root = dom.append(container, dom.$('.connection-tile'));
			connectionTemplate.icon = dom.append(connectionTemplate.root, dom.$('div.icon.server-page'));
			connectionTemplate.label = dom.append(connectionTemplate.root, dom.$('div.label'));
			return connectionTemplate;
		} else if (templateId === ServerTreeRenderer.CONNECTION_GROUP_TEMPLATE_ID) {
			container.classList.add('server-group');
			const groupTemplate: IConnectionProfileGroupTemplateData = Object.create(null);
			groupTemplate.root = dom.append(container, dom.$('.server-group'));
			groupTemplate.name = dom.append(groupTemplate.root, dom.$('span.name'));
			return groupTemplate;
		} else {
			const objectExplorerTemplate: IObjectExplorerTemplateData = Object.create(null);
			objectExplorerTemplate.root = dom.append(container, dom.$('.object-element-group'));
			objectExplorerTemplate.icon = dom.append(objectExplorerTemplate.root, dom.$('div.object-icon'));
			objectExplorerTemplate.label = dom.append(objectExplorerTemplate.root, dom.$('div.label'));
			return objectExplorerTemplate;
		}
	}

	/**
	 * Render a element, given an object bag returned by the template
	 */
	public renderElement(tree: ITree, element: any, templateId: string, templateData: any): void {
		if (templateId === ServerTreeRenderer.CONNECTION_TEMPLATE_ID) {
			this.renderConnection(element, templateData);
		} else if (templateId === ServerTreeRenderer.CONNECTION_GROUP_TEMPLATE_ID) {
			this.renderConnectionProfileGroup(element, templateData);
		} else {
			this.renderObjectExplorer(element, templateData);
		}
	}

	private renderObjectExplorer(treeNode: TreeNode, templateData: IObjectExplorerTemplateData): void {
		// Use an explicitly defined iconType first. If not defined, fall back to using nodeType and
		// other compount indicators instead.
		let iconName: string | undefined = undefined;
		if (treeNode.iconType) {
			iconName = (typeof treeNode.iconType === 'string') ? treeNode.iconType : treeNode.iconType.id;
		} else if (instanceOfSqlThemeIcon(treeNode.icon)) {
			iconName = treeNode.icon.id;
		} else {
			iconName = treeNode.nodeTypeId;
			if (treeNode.nodeStatus) {
				iconName = treeNode.nodeTypeId + '_' + treeNode.nodeStatus;
			}
			if (treeNode.nodeSubType) {
				iconName = treeNode.nodeTypeId + '_' + treeNode.nodeSubType;
			}
		}

		let tokens: string[] = [];
		for (let index = 1; index < templateData.icon.classList.length; index++) {
			tokens.push(templateData.icon.classList.item(index)!);
		}
		templateData.icon.classList.remove(...tokens);
		templateData.icon.classList.add('icon');
		let iconLowerCaseName = iconName.toLocaleLowerCase();
		if (iconLowerCaseName) {
			templateData.icon.classList.add(iconLowerCaseName);
		}

		if (treeNode.icon && !instanceOfSqlThemeIcon(treeNode.icon)) {
			iconRenderer.putIcon(templateData.icon, treeNode.icon);
		}

		templateData.label.textContent = treeNode.label;
		templateData.root.title = treeNode.label;
	}

	private getIconPath(connection: ConnectionProfile): IconPath | undefined {
		if (!connection) { return undefined; }

		if (connection.iconPath) {
			return connection.iconPath;
		}

		let iconId = this._connectionManagementService.getConnectionIconId(connection.id);
		let providerProperties = this._connectionManagementService.getProviderProperties(connection.providerName);
		if (!providerProperties) { return undefined; }

		let iconPath: IconPath | undefined = undefined;
		let pathConfig: URI | IconPath | { id: string, path: IconPath, default?: boolean }[] | undefined = providerProperties.iconPath;
		if (Array.isArray(pathConfig)) {
			for (const e of pathConfig) {
				if (!e.id || e.id === iconId || (!iconId && e.default)) {
					iconPath = e.path;
					connection['iconPath'] = iconPath;
					break;
				}
			}
		} else if (URI.isUri(pathConfig)) {
			let singlePath = pathConfig as URI;
			iconPath = { light: singlePath, dark: singlePath };
			connection.iconPath = iconPath;
		} else {
			iconPath = pathConfig as IconPath;
			connection.iconPath = iconPath;
		}
		return iconPath;
	}

	private renderServerIcon(element: HTMLElement, iconPath: IconPath | undefined, isConnected: boolean): void {
		if (!element) { return; }
		iconRenderer.putIcon(element, iconPath);
		let badgeToRemove: string = isConnected ? badgeRenderer.serverDisconnected : badgeRenderer.serverConnected;
		let badgeToAdd: string = isConnected ? badgeRenderer.serverConnected : badgeRenderer.serverDisconnected;
		badgeRenderer.removeBadge(element, badgeToRemove);
		badgeRenderer.addBadge(element, badgeToAdd);
	}

	private renderConnection(connection: ConnectionProfile, templateData: IConnectionTemplateData): void {

		let isConnected = this._connectionManagementService.isConnected(undefined, connection);
		if (!this._isCompact) {
			if (isConnected) {
				templateData.icon.classList.remove('disconnected');
				templateData.icon.classList.add('connected');
			} else {
				templateData.icon.classList.remove('connected');
				templateData.icon.classList.add('disconnected');
			}
		}

		let iconPath = this.getIconPath(connection);
		this.renderServerIcon(templateData.icon, iconPath, isConnected);

		let label = connection.title;
		if (!connection.isConnectionOptionsValid) {
			label = localize('loading', "Loading...");
		}

		templateData.label.textContent = label;
		templateData.root.title = connection.serverInfo;
		templateData.connectionProfile = connection;
	}

	private renderConnectionProfileGroup(connectionProfileGroup: ConnectionProfileGroup, templateData: IConnectionProfileGroupTemplateData): void {
		let groupElement = this.findParentElement(templateData.root, 'server-group');
		if (groupElement) {
			if (connectionProfileGroup.color) {
				groupElement.style.background = connectionProfileGroup.color;
			} else {
				// If the group doesn't contain specific color, assign the default color
				groupElement.style.background = DefaultServerGroupColor;
			}
		}
		if (connectionProfileGroup.description && (connectionProfileGroup.description !== '')) {
			templateData.root.title = connectionProfileGroup.description;
		}
		templateData.name.hidden = false;
		templateData.name.textContent = connectionProfileGroup.name;
	}

	/**
	 * Returns the first parent which contains the className
	 */
	private findParentElement(container: HTMLElement, className: string): HTMLElement | undefined {
		let currentElement: HTMLElement | null = container;
		while (currentElement) {
			if (currentElement.className.indexOf(className) > -1) {
				break;
			}
			currentElement = currentElement.parentElement;
		}
		return withNullAsUndefined(currentElement);
	}

	public disposeTemplate(tree: ITree, templateId: string, templateData: any): void {
		// no op
		// InputBox disposed in wrapUp

	}
}

interface IconPath {
	light: URI;
	dark: URI;
}
