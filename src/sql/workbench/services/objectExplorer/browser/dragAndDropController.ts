/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ITree, IDragAndDrop, IDragOverReaction, DRAG_OVER_ACCEPT_BUBBLE_DOWN, DRAG_OVER_REJECT } from 'vs/base/parts/tree/browser/tree';
import { DragMouseEvent } from 'vs/base/browser/mouseEvent';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { UNSAVED_GROUP_ID } from 'sql/platform/connection/common/constants';
import { DataTransfers, IDragAndDropData } from 'vs/base/browser/dnd';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { AsyncServerTree } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';

export function supportsNodeNameDrop(nodeId: string): boolean {
	if (nodeId === 'Table' || nodeId === 'Column' || nodeId === 'View' || nodeId === 'Function') {
		return true;
	}
	return false;
}

export function supportsFolderNodeNameDrop(nodeId: string, label: string): boolean {
	if (nodeId === 'Folder' && label === 'Columns') {
		return true;
	}
	return false;
}

function escapeString(input: string): string;
function escapeString(input: undefined): undefined;
function escapeString(input: string | undefined): string | undefined {
	return input?.replace(/]/g, ']]');
}

/**
 * Implements drag and drop for the server tree
 */
export class ServerTreeDragAndDrop implements IDragAndDrop {

	constructor(
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
	) {
	}

	/**
	 * Returns a uri if the given element should be allowed to drag.
	 * Returns null, otherwise.
	 */
	public getDragURI(tree: AsyncServerTree | ITree, element: any): string | null {
		if (element) {
			if (element instanceof ConnectionProfile) {
				return element.id;
			} else if (element instanceof ConnectionProfileGroup) {
				return element.id ?? null;
			} else if (supportsNodeNameDrop(element.nodeTypeId)) {
				return (<TreeNode>element).id;
			} else if (supportsFolderNodeNameDrop(element.nodeTypeId, element.label) && element.children) {
				return (<TreeNode>element).id;
			} else {
				return null;
			}
		}
		else {
			return null;
		}
	}

	/**
	 * Returns a label(name) to display when dragging the element.
	 */
	public getDragLabel(tree: AsyncServerTree | ITree, elements: any[]): string {
		if (elements) {
			if (elements[0] instanceof ConnectionProfile) {
				return (<ConnectionProfile>elements[0]).serverName;
			} else if (elements[0] instanceof ConnectionProfileGroup) {
				return (<ConnectionProfileGroup>elements[0]).name;
			} else if (elements[0].label) {
				return elements[0].label;
			}
			else {
				return '';
			}
		}
		else {
			return '';
		}
	}

	/**
	 * Called when the drag operation starts.
	 */
	public onDragStart(tree: AsyncServerTree | ITree, dragAndDropData: IDragAndDropData, originalEvent: DragMouseEvent): void {
		let escapedSchema, escapedName, finalString;
		TreeUpdateUtils.isInDragAndDrop = true;
		const data = dragAndDropData.getData();
		const element = data[0];
		if (supportsNodeNameDrop(element.nodeTypeId)) {
			escapedSchema = escapeString(element.metadata.schema);
			escapedName = escapeString(element.metadata.name);
			let providerName = this.getProviderNameFromElement(element);
			if (providerName === 'KUSTO') {
				finalString = element.nodeTypeId !== 'Function' && escapedName.indexOf(' ') > 0 ? `[@"${escapedName}"]` : escapedName;
			} else {
				finalString = escapedSchema ? `[${escapedSchema}].[${escapedName}]` : `[${escapedName}]`;
			}
			originalEvent.dataTransfer.setData(DataTransfers.RESOURCES, JSON.stringify([`${element.nodeTypeId}:${element.id}?${finalString}`]));
		}
		if (supportsFolderNodeNameDrop(element.nodeTypeId, element.label)) {
			// get children
			let returnString = '';
			for (let child of element.children) {
				escapedSchema = escapeString(child.metadata.schema);
				escapedName = escapeString(child.metadata.name);
				finalString = escapedSchema ? `[${escapedSchema}].[${escapedName}]` : `[${escapedName}]`;
				returnString = returnString ? `${returnString},${finalString}` : `${finalString}`;
			}

			originalEvent.dataTransfer.setData(DataTransfers.RESOURCES, JSON.stringify([`${element.nodeTypeId}:${element.id}?${returnString}`]));
		}
		return;
	}

	private getProviderNameFromElement(element: TreeNode): string | undefined {
		if (element.connection) {
			return element.connection.providerName;
		}

		return this.getProviderNameFromElement(element.parent!);
	}


	public canDragToConnectionProfileGroup(source: any, targetConnectionProfileGroup: ConnectionProfileGroup) {
		let canDragOver: boolean = true;

		if (source instanceof ConnectionProfile) {
			if (!this._connectionManagementService.canChangeConnectionConfig(source, targetConnectionProfileGroup.id!)) {
				canDragOver = false;
			}
		} else if (source instanceof ConnectionProfileGroup) {
			// Dropping a group to itself or its descendants nodes is not allowed
			// to avoid creating a circular structure.
			canDragOver = source.id !== targetConnectionProfileGroup.id && !source.isAncestorOf(targetConnectionProfileGroup);
		}

		return canDragOver;
	}

	/**
	 * Returns a DragOverReaction indicating whether sources can be
	 * dropped into target or some parent of the target.
	 * Returns DRAG_OVER_ACCEPT_BUBBLE_DOWN when element is a connection group or connection
	 */
	public onDragOver(tree: AsyncServerTree | ITree, data: IDragAndDropData, targetElement: any, originalEvent: DragMouseEvent): IDragOverReaction {
		let canDragOver: boolean = true;

		if (targetElement instanceof ConnectionProfile || targetElement instanceof ConnectionProfileGroup) {
			let targetConnectionProfileGroup = this.getTargetGroup(targetElement);
			// Verify if the connection can be moved to the target group
			const source = data.getData()[0];
			if (source instanceof ConnectionProfile) {
				if (!this._connectionManagementService.canChangeConnectionConfig(source, targetConnectionProfileGroup.id!)) {
					canDragOver = false;
				}
			} else if (source instanceof ConnectionProfileGroup) {
				// Dropping a group to itself or its descendants nodes is not allowed
				// to avoid creating a circular structure.
				canDragOver = source.id !== targetElement.id && !source.isAncestorOf(targetElement);
			}
		} else {
			canDragOver = true;
		}

		if (canDragOver) {
			if (targetElement instanceof ConnectionProfile) {
				const isConnected = this._connectionManagementService.isProfileConnected(targetElement);
				// Don't auto-expand disconnected connections - doing so will try to connect the connection
				// when expanded which is not something we want to support currently
				return DRAG_OVER_ACCEPT_BUBBLE_DOWN(isConnected);
			}
			// Auto-expand other elements (groups, tree nodes) so their children can be
			// exposed for further dragging
			return DRAG_OVER_ACCEPT_BUBBLE_DOWN(true);
		} else {
			return DRAG_OVER_REJECT;
		}
	}

	/**
	 * Handle a drop in the server tree.
	 */
	public drop(tree: AsyncServerTree | ITree, data: IDragAndDropData, targetElement: any, originalEvent: DragMouseEvent): void {
		TreeUpdateUtils.isInDragAndDrop = false;

		let targetConnectionProfileGroup: ConnectionProfileGroup = this.getTargetGroup(targetElement);

		const source = data.getData()[0];
		if (source && source.getParent) {
			let oldParent: ConnectionProfileGroup = source.getParent();
			const self = this;
			if (this.isDropAllowed(targetConnectionProfileGroup, oldParent, source)) {

				if (source instanceof ConnectionProfile) {
					// Change group id of profile
					this._connectionManagementService.changeGroupIdForConnection(source, targetConnectionProfileGroup.id!).then(() => {
						if (tree) {
							TreeUpdateUtils.registeredServerUpdate(tree, self._connectionManagementService, targetConnectionProfileGroup);
						}

					});
				} else if (source instanceof ConnectionProfileGroup) {
					// Change parent id of group
					this._connectionManagementService.changeGroupIdForConnectionGroup(source, targetConnectionProfileGroup).then(() => {
						if (tree) {
							TreeUpdateUtils.registeredServerUpdate(tree, self._connectionManagementService);
						}

					});
				}
			}
		}
	}

	public dropAbort(tree: ITree, data: IDragAndDropData): void {
		TreeUpdateUtils.isInDragAndDrop = false;
	}

	private getTargetGroup(targetElement: ConnectionProfileGroup | ConnectionProfile): ConnectionProfileGroup {
		let targetConnectionProfileGroup: ConnectionProfileGroup;
		if (targetElement instanceof ConnectionProfile) {
			targetConnectionProfileGroup = targetElement.getParent()!;
		}
		else {
			targetConnectionProfileGroup = targetElement;
		}

		return targetConnectionProfileGroup;
	}

	private isDropAllowed(targetConnectionProfileGroup: ConnectionProfileGroup,
		oldParent: ConnectionProfileGroup,
		source: ConnectionProfile | ConnectionProfileGroup): boolean {

		let isDropToItself = source && targetConnectionProfileGroup && (source instanceof ConnectionProfileGroup) && source.name === targetConnectionProfileGroup.name;
		let isDropToSameLevel = oldParent && oldParent.equals(targetConnectionProfileGroup);
		let isUnsavedDrag = source && (source instanceof ConnectionProfileGroup) && (source.id === UNSAVED_GROUP_ID);
		return (!isDropToSameLevel && !isDropToItself && !isUnsavedDrag);
	}
}

/**
 * Implements drag and drop for the connection tree
 */
export class RecentConnectionsDragAndDrop implements IDragAndDrop {

	/**
	 * Returns a uri if the given element should be allowed to drag.
	 * Returns null, otherwise.
	 */
	public getDragURI(tree: ITree, element: any): string | null {
		if (element instanceof ConnectionProfile) {
			return (<ConnectionProfile>element).id;
		}
		else if (element instanceof ConnectionProfileGroup) {
			return (<ConnectionProfileGroup>element).id ?? null;
		}
		return null;
	}

	/**
	 * Returns a label(name) to display when dragging the element.
	 */
	public getDragLabel(tree: ITree, elements: any[]): string {
		if (elements[0] instanceof ConnectionProfile) {
			return (<ConnectionProfile>elements[0]).serverName;
		}
		else if (elements[0] instanceof ConnectionProfileGroup) {
			return (<ConnectionProfileGroup>elements[0]).name;
		}
		return '';
	}

	/**
	 * Sent when the drag operation is starting.
	 */
	public onDragStart(tree: ITree, data: IDragAndDropData, originalEvent: DragMouseEvent): void {
		return;
	}

	/**
	 * Returns a DragOverReaction indicating whether sources can be
	 * dropped into target or some parent of the target.
	 */
	public onDragOver(tree: ITree, data: IDragAndDropData, targetElement: any, originalEvent: DragMouseEvent): IDragOverReaction {
		return DRAG_OVER_REJECT;
	}

	/**
	 * Handle drop in the server tree.
	 */
	public drop(tree: ITree, data: IDragAndDropData, targetElement: any, originalEvent: DragMouseEvent): void {
		// No op
	}

	public dropAbort(tree: ITree, data: IDragAndDropData): void { }
}
