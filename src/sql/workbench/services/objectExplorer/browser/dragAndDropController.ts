/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ITree, IDragAndDrop, IDragOverReaction, DRAG_OVER_ACCEPT_BUBBLE_DOWN, DRAG_OVER_REJECT } from 'sql/base/parts/tree/browser/tree';
import { DragMouseEvent } from 'vs/base/browser/mouseEvent';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { UNSAVED_GROUP_ID, mssqlProviderName, pgsqlProviderName } from 'sql/platform/connection/common/constants';
import { DataTransfers, IDragAndDropData } from 'vs/base/browser/dnd';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { AsyncServerTree } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';

export function supportsNodeNameDrop(nodeId: string): boolean {
	if (nodeId === 'Table' || nodeId === 'Column' || nodeId === 'View' || nodeId === 'Function') {
		return true;
	}
	return false;
}

/**
 * Whether the specified node supports having a schema
 * @param node The node being dragged
 * @returns True if the node supports having the schema appended to its name, false if not
 */
function supportsSchema(node: TreeNode): boolean {
	// Currently the tree node created by SQL Tools Service will set the schema for a node to the schema
	// of its parent node if it doesn't have one itself. While it's not clear why this is being done
	// changing it at this point would be risky so instead just doing a check here so that we don't
	// accidently put a schema on an element that doesn't support it
	return node.nodeTypeId === 'Column' ? false : true;
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

	private rejectDueToDupe: boolean;

	constructor(
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@INotificationService private _notificationService: INotificationService
	) {
		this.rejectDueToDupe = false;
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
		const element = data[0] as TreeNode;
		if (supportsNodeNameDrop(element.nodeTypeId)) {
			escapedSchema = supportsSchema(element) ? escapeString(element.metadata.schema) : undefined;
			escapedName = escapeString(element.metadata.name);
			let providerName = this.getProviderNameFromElement(element);
			if (providerName === 'KUSTO') {
				finalString = element.nodeTypeId !== 'Function' && escapedName.indexOf(' ') > 0 ? `[@"${escapedName}"]` : escapedName;
			} else if (providerName === mssqlProviderName) {
				finalString = escapedSchema ? `[${escapedSchema}].[${escapedName}]` : `[${escapedName}]`;
			} else if (providerName === pgsqlProviderName) {
				finalString = element.metadata.schema ? `"${element.metadata.schema}"."${element.metadata.name}"` : `"${element.metadata.name}"`;
			} else {
				finalString = element.metadata.schema ? `${element.metadata.schema}.${element.metadata.name}` : `${element.metadata.name}`;
			}
			originalEvent.dataTransfer.setData(DataTransfers.RESOURCES, JSON.stringify([`${element.nodeTypeId}:${element.id}?${finalString}`]));
		}
		if (supportsFolderNodeNameDrop(element.nodeTypeId, element.label)) {
			// get children
			let returnString = '';
			let providerName = this.getProviderNameFromElement(element);
			for (let child of element.children) {
				escapedSchema = supportsSchema(child) ? escapeString(child.metadata.schema) : undefined;
				escapedName = escapeString(child.metadata.name);
				if (providerName === mssqlProviderName) {
					finalString = escapedSchema ? `[${escapedSchema}].[${escapedName}]` : `[${escapedName}]`;
				} else if (providerName === pgsqlProviderName) {
					finalString = child.metadata.schema ? `"${child.metadata.schema}"."${child.metadata.name}"` : `"${child.metadata.name}"`;
				} else {
					finalString = child.metadata.schema ? `${child.metadata.schema}.${child.metadata.name}` : `${child.metadata.name}`;
				}
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

		const source = data.getData()[0];
		if (source instanceof ConnectionProfileGroup) {
			if (targetElement instanceof ConnectionProfileGroup) {
				// If target group is parent of the source connection, then don't allow drag over
				canDragOver = this.canDragToConnectionProfileGroup(source, targetElement);
			} else if (targetElement instanceof ConnectionProfile) {
				canDragOver = source.parentId !== targetElement.groupId;
			} else if (targetElement instanceof TreeNode) {
				const treeNodeParentGroupId = this.getTreeNodeParentGroup(targetElement).id;
				canDragOver = source.parentId !== treeNodeParentGroupId && source.id !== treeNodeParentGroupId;
			}
		} else if (source instanceof ConnectionProfile) {
			if (targetElement instanceof ConnectionProfileGroup) {
				canDragOver = this.canDragToConnectionProfileGroup(source, targetElement);
			} else if (targetElement instanceof ConnectionProfile) {
				canDragOver = source.groupId !== targetElement.groupId &&
					this._connectionManagementService.canChangeConnectionConfig(source, targetElement.groupId);
				this.rejectDueToDupe = !canDragOver;
			} else if (targetElement instanceof TreeNode) {
				canDragOver = source.groupId !== this.getTreeNodeParentGroup(targetElement).id;
			}
		} else if (source instanceof TreeNode) {
			canDragOver = false;
		}
		if (canDragOver) {
			if (targetElement instanceof ConnectionProfile) {
				const isConnected = this._connectionManagementService.isProfileConnected(targetElement);
				// Don't auto-expand disconnected connections - doing so will try to connect the connection
				// when expanded which is not something we want to support currently
				return DRAG_OVER_ACCEPT_BUBBLE_DOWN(isConnected);
			} else if (targetElement instanceof ConnectionProfileGroup) {
				return DRAG_OVER_ACCEPT_BUBBLE_DOWN(true);
			} else {
				// Don't auto-expand treeNodes as we don't support drag and drop on them
				return DRAG_OVER_ACCEPT_BUBBLE_DOWN(false);
			}
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
				if (tree instanceof AsyncServerTree) {
					if (oldParent && source && targetConnectionProfileGroup) {
						if (source instanceof ConnectionProfileGroup) {
							this._connectionManagementService.changeGroupIdForConnectionGroup(source, targetConnectionProfileGroup);
						} else if (source instanceof ConnectionProfile) {
							this._connectionManagementService.changeGroupIdForConnection(source, targetConnectionProfileGroup.id!);
						}
					}

				} else {
					if (source instanceof ConnectionProfile) {
						// Change group id of profile
						this._connectionManagementService.changeGroupIdForConnection(source, targetConnectionProfileGroup.id!).then(async () => {
							if (tree) {
								TreeUpdateUtils.registeredServerUpdate(tree, self._connectionManagementService, targetConnectionProfileGroup);
							}

						});
					} else if (source instanceof ConnectionProfileGroup) {
						// Change parent id of group
						this._connectionManagementService.changeGroupIdForConnectionGroup(source, targetConnectionProfileGroup).then(async () => {
							if (tree) {
								TreeUpdateUtils.registeredServerUpdate(tree, self._connectionManagementService);
							}
						});
					}
				}
			}
		}
	}

	public dropAbort(tree: ITree, data: IDragAndDropData): void {
		if (this.rejectDueToDupe) {
			this.rejectDueToDupe = false;
			this._notificationService.info(localize('objectExplorer.dragAndDropController.existingIdenticalProfile', 'Cannot drag profile into group: A profile with identical options already exists in the group.'));
		}
		TreeUpdateUtils.isInDragAndDrop = false;
	}

	private getTargetGroup(targetElement: ConnectionProfileGroup | ConnectionProfile | TreeNode): ConnectionProfileGroup {
		let targetConnectionProfileGroup: ConnectionProfileGroup;
		if (targetElement instanceof ConnectionProfile) {
			targetConnectionProfileGroup = targetElement.getParent()!;
		} else if (targetElement instanceof ConnectionProfileGroup) {
			targetConnectionProfileGroup = targetElement;
		} else if (targetElement instanceof TreeNode) {
			targetConnectionProfileGroup = this.getTreeNodeParentGroup(targetElement);
			if (!targetConnectionProfileGroup) {
				throw new Error('Cannot find parent for the node');
			}
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

	private getTreeNodeParentGroup(element: TreeNode): ConnectionProfileGroup | undefined {
		let treeNode = element;
		while (!treeNode?.connection) {
			treeNode = treeNode.parent;
		}
		if (treeNode) {
			const groupId = treeNode.connection.groupId;
			if (groupId) {
				return this._connectionManagementService.getConnectionGroupById(groupId);
			}
		}
		return undefined;
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
