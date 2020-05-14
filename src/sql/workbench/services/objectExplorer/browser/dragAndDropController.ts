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
import { IDragAndDropData } from 'vs/base/browser/dnd';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';

/**
 * Implements drag and drop for the server tree
 */
export class TreeDragAndDrop implements IDragAndDrop {

	constructor(
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
	) {
	}

	/**
	 * Returns a uri if the given element should be allowed to drag.
	 * Returns null, otherwise.
	 */
	public getDragURI(tree: ITree, element: any): string {
		if (element instanceof ConnectionProfile) {
			return (<ConnectionProfile>element).id;
		} else if (element instanceof ConnectionProfileGroup) {
			return (<ConnectionProfileGroup>element).id;

		} else if (element.nodeTypeId === 'Table' || element.nodeTypeId === 'Column') {
			return (<TreeNode>element).id;
		}
		return null;
	}

	/**
	 * Returns a label(name) to display when dragging the element.
	 */
	public getDragLabel(tree: ITree, elements: any[]): string {
		if (elements[0] instanceof ConnectionProfile) {
			return (<ConnectionProfile>elements[0]).serverName;
		} else if (elements[0] instanceof ConnectionProfileGroup) {
			return (<ConnectionProfileGroup>elements[0]).name;
		} else if (elements[0].label) {
			return elements[0].label;
		}
		else {
			return undefined;
		}
	}

	/**
	 * Called when the drag operation starts.
	 */
	public onDragStart(tree: ITree, data: IDragAndDropData, originalEvent: DragMouseEvent): void {
		TreeUpdateUtils.isInDragAndDrop = true;
		return;
	}

	/**
	 * Returns a DragOverReaction indicating whether sources can be
	 * dropped into target or some parent of the target.
	 * Returns DRAG_OVER_ACCEPT_BUBBLE_DOWN when element is a connection group or connection
	 */
	public onDragOver(tree: ITree, data: IDragAndDropData, targetElement: any, originalEvent: DragMouseEvent): IDragOverReaction {

		let canDragOver: boolean = true;
		if (targetElement instanceof ConnectionProfile || targetElement instanceof ConnectionProfileGroup) {
			let targetConnectionProfileGroup = this.getTargetGroup(targetElement);
			// Verify if the connection can be moved to the target group
			const source = data.getData()[0];
			if (source instanceof ConnectionProfile) {
				if (!this._connectionManagementService.canChangeConnectionConfig(source, targetConnectionProfileGroup.id)) {
					canDragOver = false;
				}
			} else if (source instanceof ConnectionProfileGroup) {
				// Dropping a group to itself or its descendants nodes is not allowed
				// to avoid creating a circular structure.
				canDragOver = source.id !== targetElement.id && !source.isAncestorOf(targetElement);
			}
			//TODO: Change the filter used here?
		} else if (targetElement.nodeTypeId === 'Table' || targetElement.nodeTypeId === 'Column') {
			// Try to edit the text in the text window here, if possible

		} else {
			canDragOver = true;
		}

		if (canDragOver) {
			return DRAG_OVER_ACCEPT_BUBBLE_DOWN(true);
		} else {
			return DRAG_OVER_REJECT;
		}
	}

	/**
	 * Handle a drop in the server tree.
	 */
	public drop(tree: ITree, data: IDragAndDropData, targetElement: any, originalEvent: DragMouseEvent): void {
		TreeUpdateUtils.isInDragAndDrop = false;

		let targetConnectionProfileGroup: ConnectionProfileGroup = this.getTargetGroup(targetElement);

		const source = data.getData()[0];
		if (source && source.getParent) {
			let oldParent: ConnectionProfileGroup = source.getParent();
			const self = this;
			if (this.isDropAllowed(targetConnectionProfileGroup, oldParent, source)) {

				if (source instanceof ConnectionProfile) {
					// Change group id of profile
					this._connectionManagementService.changeGroupIdForConnection(source, targetConnectionProfileGroup.id).then(() => {
						TreeUpdateUtils.registeredServerUpdate(tree, self._connectionManagementService, targetConnectionProfileGroup);
					});
				} else if (source instanceof ConnectionProfileGroup) {
					// Change parent id of group
					this._connectionManagementService.changeGroupIdForConnectionGroup(source, targetConnectionProfileGroup).then(() => {
						TreeUpdateUtils.registeredServerUpdate(tree, self._connectionManagementService);
					});
				}
			}
		}
	}

	public dropAbort(tree: ITree, data: IDragAndDropData): void {
		TreeUpdateUtils.isInDragAndDrop = false;
	}

	private getTargetGroup(targetElement: any): ConnectionProfileGroup {
		let targetConnectionProfileGroup: ConnectionProfileGroup;
		if (targetElement instanceof ConnectionProfile) {
			targetConnectionProfileGroup = (<ConnectionProfile>targetElement).getParent();
		}
		else {
			targetConnectionProfileGroup = <ConnectionProfileGroup>targetElement;
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
	public getDragURI(tree: ITree, element: any): string {
		if (element instanceof ConnectionProfile) {
			return (<ConnectionProfile>element).id;
		}
		else if (element instanceof ConnectionProfileGroup) {
			return (<ConnectionProfileGroup>element).id;
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
		return undefined;
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
