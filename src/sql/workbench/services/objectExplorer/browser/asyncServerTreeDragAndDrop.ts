/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { IDragAndDropData } from 'vs/base/browser/dnd';
import { ITreeDragAndDrop, ITreeDragOverReaction, TreeDragOverReactions } from 'vs/base/browser/ui/tree/tree';
import { ServerTreeDragAndDrop } from 'sql/workbench/services/objectExplorer/browser/dragAndDropController';
import { ServerTreeElement, AsyncServerTree } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';

/**
 * Implements drag and drop for the server tree
 */
export class AsyncServerTreeDragAndDrop implements ITreeDragAndDrop<ServerTreeElement> {

	private _dragAndDrop: ServerTreeDragAndDrop;
	private _tree: AsyncServerTree | undefined;

	constructor(
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
	) {
		this._dragAndDrop = new ServerTreeDragAndDrop(connectionManagementService);
	}

	/**
	 * Sets the tree context for this drag and drop controller
	 */
	public set tree(value: AsyncServerTree) {
		this._tree = value;
	}

	/**
	 * Returns a uri if the given element should be allowed to drag.
	 * Returns null, otherwise.
	 */
	public getDragURI(element: ServerTreeElement): string | null {
		return this._dragAndDrop.getDragURI(this._tree!, element);
	}

	/**
	 * Returns a label(name) to display when dragging the element.
	 */
	public getDragLabel(elements: ServerTreeElement[]): string {
		return this._dragAndDrop.getDragLabel(this._tree!, elements);
	}

	/**
	 * Called when the drag operation starts.
	 */
	public onDragStart(dragAndDropData: IDragAndDropData, originalEvent: DragEvent): void {
		// Force the event cast while in preview - we don't use any of the mouse properties on the
		// implementation so this is fine for now
		return this._dragAndDrop.onDragStart(this._tree!, dragAndDropData, <any>originalEvent);
	}

	public onDragOver(data: IDragAndDropData, targetElement: ServerTreeElement | undefined, targetIndex: number, originalEvent: DragEvent): boolean | ITreeDragOverReaction {
		// Dropping onto an empty space (undefined targetElement) we treat as wanting to move into the root connection group
		if (!targetElement) {
			targetElement = this._tree?.getInput();
		}
		// Force the event cast while in preview - we don't use any of the mouse properties on the
		// implementation so this is fine for now
		const canDragOver = this._dragAndDrop.onDragOver(this._tree!, data, targetElement, <any>originalEvent);

		if (canDragOver.accept) {
			return TreeDragOverReactions.acceptBubbleDown(canDragOver.autoExpand);
		} else {
			return { accept: false };
		}
	}

	/**
	 * Handle a drop in the server tree.
	 */
	public drop(data: IDragAndDropData, targetElement: ServerTreeElement | undefined, targetIndex: number, originalEvent: DragEvent): void {
		// Dropping onto an empty space (undefined targetElement) we treat as wanting to move into the root connection group
		if (!targetElement) {
			targetElement = this._tree?.getInput();
		}
		// Force the event cast while in preview - we don't use any of the mouse properties on the
		// implementation so this is fine for now
		this._dragAndDrop.drop(this._tree!, data, targetElement, <any>originalEvent);
	}

	public onDragEnd(originalEvent: DragEvent): void {
		TreeUpdateUtils.isInDragAndDrop = false;
	}
}

export class AsyncRecentConnectionsDragAndDrop implements ITreeDragAndDrop<ServerTreeElement> {

	/**
	 * Returns a uri if the given element should be allowed to drag.
	 * Returns null, otherwise.
	 */
	public getDragURI(element: ServerTreeElement): string | null {
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
	public getDragLabel(elements: ServerTreeElement[]): string {
		if (elements[0] instanceof ConnectionProfile) {
			return elements[0].serverName;
		}
		else if (elements[0] instanceof ConnectionProfileGroup) {
			return elements[0].name;
		}
		return '';
	}

	/**
	 * Returns a DragOverReaction indicating whether sources can be
	 * dropped into target or some parent of the target.
	 */
	public onDragOver(data: IDragAndDropData, targetElement: ServerTreeElement, targetIndex: number, originalEvent: DragEvent): boolean | ITreeDragOverReaction {
		return { accept: false };
	}

	/**
	 * Handle drop in the server tree.
	 */
	public drop(data: IDragAndDropData, targetElement: ServerTreeElement, targetIndex: number, originalEvent: DragEvent): void {
		// No op
	}
}
