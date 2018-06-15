/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ServiceIdentifier, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { Position, IEditorInput } from 'vs/platform/editor/common/editor';
import { IEditorStacksModel, IEditorGroup, EditorInput, IEditorOpeningEvent } from 'vs/workbench/common/editor';
import { Event } from 'vs/base/common/event';
import { IEditorTabOptions, GroupArrangement, GroupOrientation, IEditorGroupService, IMoveOptions } from 'vs/workbench/services/group/common/groupService';
import { EditorGroup } from 'vs/workbench/common/editor/editorStacksModel';

export class EditorGroupTestService implements IEditorGroupService {
	_serviceBrand: ServiceIdentifier<any>;

	/**
	 * Emitted when editors or inputs change. Examples: opening, closing of editors. Active editor change.
	 */
	onEditorsChanged: Event<void>;

	onEditorOpening: Event<IEditorOpeningEvent>;

	onEditorGroupMoved: Event<void>;

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
	 * Emitted when tab options changed.
	 */
	onTabOptionsChanged: Event<IEditorTabOptions>;

	/**
	 * Keyboard focus the editor group at the provided position.
	 */
    public focusGroup(group: EditorGroup): void;
	public focusGroup(position: Position): void;
	public focusGroup(arg1: any) {
		return;
	}

	/**
	 * Activate the editor group at the provided position without moving focus.
	 */
	public activateGroup(group: EditorGroup): void;
	public activateGroup(position: Position): void;
	public activateGroup(arg1: any): void {
	}
	/**
	 * Allows to move the editor group from one position to another.
	 */


	public moveGroup(from: EditorGroup, to: EditorGroup): void;
	public moveGroup(from: Position, to: Position): void;
	public moveGroup(arg1: any, arg2: any): void {
	}

	/**
	 * Allows to arrange editor groups according to the GroupArrangement enumeration.
	 */
	arrangeGroups(arrangement: GroupArrangement): void {

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
	 * Moves an editor from one group to another. The index in the group is optional.
	 */
	moveEditor(input: IEditorInput, from: IEditorGroup, to: IEditorGroup, moveOptions?: IMoveOptions): void;
	moveEditor(input: IEditorInput, from: Position, to: Position, moveOptions?: IMoveOptions): void;
	moveEditor(input: EditorInput, arg2: any, arg3: any, index?: IMoveOptions): void {

	}

	/**
	 * Provides access to the editor stacks model
	 */
	getStacksModel(): IEditorStacksModel {
		return undefined;
	}

	/**
	 * Returns true if tabs are shown, false otherwise.
	 */
	getTabOptions(): IEditorTabOptions {
		return undefined;
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

}