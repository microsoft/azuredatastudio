/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ServiceIdentifier, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';
import { IEditorGroupsService, GroupOrientation, IEditorGroup, GroupDirection, GroupsArrangement, IMoveEditorOptions, GroupsOrder, EditorGroupLayout, IFindGroupScope, IAddGroupOptions, IMergeGroupOptions } from 'vs/workbench/services/group/common/editorGroupsService';
import { IEditorOpeningEvent } from 'vs/workbench/browser/parts/editor/editor';
import { IEditorInput, EditorInput, GroupIdentifier } from 'vs/workbench/common/editor';
import { EditorGroup } from 'vs/workbench/common/editor/editorGroup';

export class EditorGroupTestService implements IEditorGroupsService {
	_serviceBrand: ServiceIdentifier<any>;

	findGroup(scope: IFindGroupScope, source?: IEditorGroup | GroupIdentifier, wrap?: boolean): IEditorGroup {
		return undefined;
	}

	addGroup(location: IEditorGroup | GroupIdentifier, direction: GroupDirection, options?: IAddGroupOptions): IEditorGroup {
		return undefined;
	}

	removeGroup(group: IEditorGroup | GroupIdentifier): void {
	}

	mergeGroup(group: IEditorGroup | GroupIdentifier, target: IEditorGroup | GroupIdentifier, options?: IMergeGroupOptions): IEditorGroup {
		return undefined;
	}

	copyGroup(group: IEditorGroup | GroupIdentifier, location: IEditorGroup | GroupIdentifier, direction: GroupDirection): IEditorGroup {
		return undefined;
	}

	/**
	 * Emitted when editors or inputs change. Examples: opening, closing of editors. Active editor change.
	 */
	onEditorsChanged: Event<void>;

	onEditorOpening: Event<IEditorOpeningEvent>;

	onEditorGroupMoved: Event<void>;

	/**
	 * An event for when the active editor group changes. The active editor
	 * group is the default location for new editors to open.
	 */
	readonly onDidActiveGroupChange: Event<IEditorGroup>;

	/**
	 * An event for when a new group was added.
	 */
	readonly onDidAddGroup: Event<IEditorGroup>;

	/**
	 * An event for when a group was removed.
	 */
	readonly onDidRemoveGroup: Event<IEditorGroup>;

	/**
	 * An event for when a group was moved.
	 */
	readonly onDidMoveGroup: Event<IEditorGroup>;

	/**
	 * An active group is the default location for new editors to open.
	 */
	readonly activeGroup: IEditorGroup;

	/**
	 * All groups that are currently visible in the editor area in the
	 * order of their creation (oldest first).
	 */
	readonly groups: ReadonlyArray<IEditorGroup>;

	/**
	 * The number of editor groups that are currently opened.
	 */
	readonly count: number;

	/**
	 * The current layout orientation of the root group.
	 */
	readonly orientation: GroupOrientation;

	/**
	 * Get all groups that are currently visible in the editor area optionally
	 * sorted by being most recent active or grid order. Will sort by creation
	 * time by default (oldest group first).
	 */
	getGroups(order?: GroupsOrder): ReadonlyArray<IEditorGroup> {
		return undefined;
	}

	/**
	 * Allows to convert a group identifier to a group.
	 */
	getGroup(identifier: GroupIdentifier): IEditorGroup {
		return undefined;
	}

	invokeWithinEditorContext<T>(fn: (accessor: ServicesAccessor) => T): T {
		return undefined;
	}

	/**
	 * Emitted when opening an editor fails.
	 */
	onEditorOpenFail: Event<IEditorInput>;

	/**
	 * Emitted when a editors are moved to another position.
	 */
	onEditorsMoved: Event<void>;

	/**
	 * Emitted when the editor group orientation was changed.
	 */
	onGroupOrientationChanged: Event<void>;

	/**
	 * Keyboard focus the editor group at the provided position.
	 */
    public focusGroup(group: EditorGroup): void;
	public focusGroup(position: Position): void;
	public focusGroup(arg1: any) {
		return;
	}

	/**
	 * Set a group as active. An active group is the default location for new editors to open.
	 */
	activateGroup(group: IEditorGroup | GroupIdentifier): IEditorGroup {
		return undefined;
	}

	/**
	 * Move a group to a new group in the editor area.
	 *
	 * @param group the group to move
	 * @param location the group from which to split to add the moved group
	 * @param direction the direction of where to split to
	 */
	moveGroup(group: IEditorGroup | GroupIdentifier, location: IEditorGroup | GroupIdentifier, direction: GroupDirection): IEditorGroup {
		return undefined;
	}

	/**
	 * Arrange all groups according to the provided arrangement.
	 */
	arrangeGroups(arrangement: GroupsArrangement): void {

	}

	/**
	 * Changes the editor group layout between vertical and horizontal orientation. Only applies
	 * if more than one editor is opened.
	 */
	setGroupOrientation(orientation: GroupOrientation): void {

	}

	/**
	 * Returns the current editor group layout.
	 */
	getGroupOrientation(): GroupOrientation {
		return undefined;
	}

	/**
	 * Move an editor from this group either within this group or to another group.
	 */
	moveEditor(editor: IEditorInput, target: IEditorGroup, options?: IMoveEditorOptions): void {

	}

	public pinEditor(group: EditorGroup, input: EditorInput): void;
	public pinEditor(position: Position, input: EditorInput): void;
	public pinEditor(arg1: any, input: EditorInput): void {

	}

	public unpinEditor(group: EditorGroup, input: EditorInput): void;
	public unpinEditor(position: Position, input: EditorInput): void;
	public unpinEditor(arg1: any, input: EditorInput): void {

	}

	/**
	 * Resize visible editor groups
	 */
	public resizeGroup(position: Position, groupSizeChange: number): void {

	}

	/**
	 * Returns the size of a group.
	 */
	getSize(group: IEditorGroup | GroupIdentifier): number {
		return 0;
	}

	/**
	 * Sets the size of a group.
	 */
	setSize(group: IEditorGroup | GroupIdentifier, size: number): void {
	}

	/**
	 * Applies the provided layout by either moving existing groups or creating new groups.
	 */
	applyLayout(layout: EditorGroupLayout): void {
	}

}