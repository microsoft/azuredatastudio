/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GroupIdentifier } from 'vs/workbench/common/editor';
import { IEditorGroupsService, GroupsOrder, IEditorGroup } from 'vs/workbench/services/editor/common/editorGroupsService';
import { ACTIVE_GROUP, SIDE_GROUP } from 'vs/workbench/services/editor/common/editorService';

/**
 * A way to address editor groups through a column based system
 * where `0` is the first column. Will fallback to `SIDE_GROUP`
 * in case the column does not exist yet.
 */
export type EditorGroupColumn = number;

export function columnToEditorGroup(editorGroupService: IEditorGroupsService, column?: EditorGroupColumn): GroupIdentifier {
	if (typeof column !== 'number' || column === ACTIVE_GROUP) {
		return ACTIVE_GROUP; // prefer active group when position is undefined or passed in as such
	}

	const groups = editorGroupService.getGroups(GroupsOrder.GRID_APPEARANCE);

	let candidateGroup = groups[column];
	if (candidateGroup) {
		return candidateGroup.id; // found direct match
	}

	let firstGroup = groups[0];
	if (groups.length === 1 && firstGroup.count === 0) {
		return firstGroup.id; // first editor should always open in first group independent from position provided
	}

	return SIDE_GROUP; // open to the side if group not found or we are instructed to
}

export function editorGroupToColumn(editorGroupService: IEditorGroupsService, editorGroup: IEditorGroup | GroupIdentifier): EditorGroupColumn {
	let group = (typeof editorGroup === 'number') ? editorGroupService.getGroup(editorGroup) : editorGroup;
	group = group ?? editorGroupService.activeGroup;

	return editorGroupService.getGroups(GroupsOrder.GRID_APPEARANCE).indexOf(group);
}
