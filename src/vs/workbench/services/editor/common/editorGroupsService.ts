/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IEditorPane, GroupIdentifier, EditorInputWithOptions, CloseDirection, IEditorPartOptions, IEditorPartOptionsChangeEvent, EditorsOrder, IVisibleEditorPane, IEditorCloseEvent, IUntypedEditorInput, isEditorInput, IEditorWillMoveEvent, IEditorWillOpenEvent, IMatchEditorOptions, IActiveEditorChangeEvent, IFindEditorOptions } from 'vs/workbench/common/editor';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IDimension } from 'vs/editor/common/core/dimension';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { URI } from 'vs/base/common/uri';
import { IGroupModelChangeEvent } from 'vs/workbench/common/editor/editorGroupModel';

export const IEditorGroupsService = createDecorator<IEditorGroupsService>('editorGroupsService');

export const enum GroupDirection {
	UP,
	DOWN,
	LEFT,
	RIGHT
}

export const enum GroupOrientation {
	HORIZONTAL,
	VERTICAL
}

export const enum GroupLocation {
	FIRST,
	LAST,
	NEXT,
	PREVIOUS
}

export interface IFindGroupScope {
	direction?: GroupDirection;
	location?: GroupLocation;
}

export const enum GroupsArrangement {

	/**
	 * Make the current active group consume the maximum
	 * amount of space possible.
	 */
	MAXIMIZE,

	/**
	 * Size all groups evenly.
	 */
	EVEN,

	/**
	 * Will behave like MINIMIZE_OTHERS if the active
	 * group is not already maximized and EVEN otherwise
	 */
	TOGGLE
}

export interface GroupLayoutArgument {

	/**
	 * Only applies when there are multiple groups
	 * arranged next to each other in a row or column.
	 * If provided, their sum must be 1 to be applied
	 * per row or column.
	 */
	size?: number;

	/**
	 * Editor groups  will be laid out orthogonal to the
	 * parent orientation.
	 */
	groups?: GroupLayoutArgument[];
}

export interface EditorGroupLayout {

	/**
	 * The initial orientation of the editor groups at the root.
	 */
	orientation: GroupOrientation;

	/**
	 * The editor groups at the root of the layout.
	 */
	groups: GroupLayoutArgument[];
}

export interface IAddGroupOptions {
	activate?: boolean;
}

export const enum MergeGroupMode {
	COPY_EDITORS,
	MOVE_EDITORS
}

export interface IMergeGroupOptions {
	mode?: MergeGroupMode;
	index?: number;
}

export interface ICloseEditorOptions {
	preserveFocus?: boolean;
}

export type ICloseEditorsFilter = {
	except?: EditorInput;
	direction?: CloseDirection;
	savedOnly?: boolean;
	excludeSticky?: boolean;
};

export interface ICloseAllEditorsOptions {
	excludeSticky?: boolean;
}

export interface IEditorReplacement {
	editor: EditorInput;
	replacement: EditorInput;
	options?: IEditorOptions;

	/**
	 * Skips asking the user for confirmation and doesn't
	 * save the document. Only use this if you really need to!
	 */
	forceReplaceDirty?: boolean;
}

export function isEditorReplacement(replacement: unknown): replacement is IEditorReplacement {
	const candidate = replacement as IEditorReplacement | undefined;

	return isEditorInput(candidate?.editor) && isEditorInput(candidate?.replacement);
}

export const enum GroupsOrder {

	/**
	 * Groups sorted by creation order (oldest one first)
	 */
	CREATION_TIME,

	/**
	 * Groups sorted by most recent activity (most recent active first)
	 */
	MOST_RECENTLY_ACTIVE,

	/**
	 * Groups sorted by grid widget order
	 */
	GRID_APPEARANCE
}

export interface IEditorSideGroup {

	/**
	 * Open an editor in this group.
	 *
	 * @returns a promise that resolves around an IEditor instance unless
	 * the call failed, or the editor was not opened as active editor.
	 */
	openEditor(editor: EditorInput, options?: IEditorOptions): Promise<IEditorPane | undefined>;
}

export interface IEditorGroupsService {

	readonly _serviceBrand: undefined;

	/**
	 * An event for when the active editor group changes. The active editor
	 * group is the default location for new editors to open.
	 */
	readonly onDidChangeActiveGroup: Event<IEditorGroup>;

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
	 * An event for when a group gets activated.
	 */
	readonly onDidActivateGroup: Event<IEditorGroup>;

	/**
	 * An event for when the group container is layed out.
	 */
	readonly onDidLayout: Event<IDimension>;

	/**
	 * An event for when the group container is scrolled.
	 */
	readonly onDidScroll: Event<void>;

	/**
	 * An event for when the index of a group changes.
	 */
	readonly onDidChangeGroupIndex: Event<IEditorGroup>;

	/**
	 * An event for when the locked state of a group changes.
	 */
	readonly onDidChangeGroupLocked: Event<IEditorGroup>;

	/**
	 * The size of the editor groups area.
	 */
	readonly contentDimension: IDimension;

	/**
	 * An active group is the default location for new editors to open.
	 */
	readonly activeGroup: IEditorGroup;

	/**
	 * A side group allows a subset of methods on a group that is either
	 * created to the side or picked if already there.
	 */
	readonly sideGroup: IEditorSideGroup;

	/**
	 * All groups that are currently visible in the editor area in the
	 * order of their creation (oldest first).
	 */
	readonly groups: readonly IEditorGroup[];

	/**
	 * The number of editor groups that are currently opened.
	 */
	readonly count: number;

	/**
	 * The current layout orientation of the root group.
	 */
	readonly orientation: GroupOrientation;

	/**
	 * A property that indicates when groups have been created
	 * and are ready to be used.
	 */
	readonly isReady: boolean;

	/**
	 * A promise that resolves when groups have been created
	 * and are ready to be used.
	 *
	 * Await this promise to safely work on the editor groups model
	 * (for example, install editor group listeners).
	 *
	 * Use the `whenRestored` property to await visible editors
	 * having fully resolved.
	 */
	readonly whenReady: Promise<void>;

	/**
	 * A promise that resolves when groups have been restored.
	 *
	 * For groups with active editor, the promise will resolve
	 * when the visible editor has finished to resolve.
	 *
	 * Use the `whenReady` property to not await editors to
	 * resolve.
	 */
	readonly whenRestored: Promise<void>;

	/**
	 * Find out if the editor group service has UI state to restore
	 * from a previous session.
	 */
	readonly hasRestorableState: boolean;

	/**
	 * Get all groups that are currently visible in the editor area.
	 *
	 * @param order the order of the editors to use
	 */
	getGroups(order: GroupsOrder): readonly IEditorGroup[];

	/**
	 * Allows to convert a group identifier to a group.
	 */
	getGroup(identifier: GroupIdentifier): IEditorGroup | undefined;

	/**
	 * Set a group as active. An active group is the default location for new editors to open.
	 */
	activateGroup(group: IEditorGroup | GroupIdentifier): IEditorGroup;

	/**
	 * Returns the size of a group.
	 */
	getSize(group: IEditorGroup | GroupIdentifier): { width: number; height: number };

	/**
	 * Sets the size of a group.
	 */
	setSize(group: IEditorGroup | GroupIdentifier, size: { width: number; height: number }): void;

	/**
	 * Arrange all groups according to the provided arrangement.
	 */
	arrangeGroups(arrangement: GroupsArrangement): void;

	/**
	 * Applies the provided layout by either moving existing groups or creating new groups.
	 */
	applyLayout(layout: EditorGroupLayout): void;

	/**
	 * Returns an editor layout describing the current grid
	 */
	getLayout(): EditorGroupLayout;

	/**
	 * Enable or disable centered editor layout.
	 */
	centerLayout(active: boolean): void;

	/**
	 * Find out if the editor layout is currently centered.
	 */
	isLayoutCentered(): boolean;

	/**
	 * Sets the orientation of the root group to be either vertical or horizontal.
	 */
	setGroupOrientation(orientation: GroupOrientation): void;

	/**
	 * Find a group in a specific scope:
	 * * `GroupLocation.FIRST`: the first group
	 * * `GroupLocation.LAST`: the last group
	 * * `GroupLocation.NEXT`: the next group from either the active one or `source`
	 * * `GroupLocation.PREVIOUS`: the previous group from either the active one or `source`
	 * * `GroupDirection.UP`: the next group above the active one or `source`
	 * * `GroupDirection.DOWN`: the next group below the active one or `source`
	 * * `GroupDirection.LEFT`: the next group to the left of the active one or `source`
	 * * `GroupDirection.RIGHT`: the next group to the right of the active one or `source`
	 *
	 * @param scope the scope of the group to search in
	 * @param source optional source to search from
	 * @param wrap optionally wrap around if reaching the edge of groups
	 */
	findGroup(scope: IFindGroupScope, source?: IEditorGroup | GroupIdentifier, wrap?: boolean): IEditorGroup | undefined;

	/**
	 * Add a new group to the editor area. A new group is added by splitting a provided one in
	 * one of the four directions.
	 *
	 * @param location the group from which to split to add a new group
	 * @param direction the direction of where to split to
	 * @param options configure the newly group with options
	 */
	addGroup(location: IEditorGroup | GroupIdentifier, direction: GroupDirection, options?: IAddGroupOptions): IEditorGroup;

	/**
	 * Remove a group from the editor area.
	 */
	removeGroup(group: IEditorGroup | GroupIdentifier): void;

	/**
	 * Move a group to a new group in the editor area.
	 *
	 * @param group the group to move
	 * @param location the group from which to split to add the moved group
	 * @param direction the direction of where to split to
	 */
	moveGroup(group: IEditorGroup | GroupIdentifier, location: IEditorGroup | GroupIdentifier, direction: GroupDirection): IEditorGroup;

	/**
	 * Merge the editors of a group into a target group. By default, all editors will
	 * move and the source group will close. This behaviour can be configured via the
	 * `IMergeGroupOptions` options.
	 *
	 * @param group the group to merge
	 * @param target the target group to merge into
	 * @param options controls how the merge should be performed. by default all editors
	 * will be moved over to the target and the source group will close. Configure to
	 * `MOVE_EDITORS_KEEP_GROUP` to prevent the source group from closing. Set to
	 * `COPY_EDITORS` to copy the editors into the target instead of moding them.
	 */
	mergeGroup(group: IEditorGroup | GroupIdentifier, target: IEditorGroup | GroupIdentifier, options?: IMergeGroupOptions): IEditorGroup;

	/**
	 * Merge all editor groups into the active one.
	 */
	mergeAllGroups(): IEditorGroup;

	/**
	 * Copy a group to a new group in the editor area.
	 *
	 * @param group the group to copy
	 * @param location the group from which to split to add the copied group
	 * @param direction the direction of where to split to
	 */
	copyGroup(group: IEditorGroup | GroupIdentifier, location: IEditorGroup | GroupIdentifier, direction: GroupDirection): IEditorGroup;

	/**
	 * Access the options of the editor part.
	 */
	readonly partOptions: IEditorPartOptions;

	/**
	 * An event that notifies when editor part options change.
	 */
	readonly onDidChangeEditorPartOptions: Event<IEditorPartOptionsChangeEvent>;

	/**
	 * Enforce editor part options temporarily.
	 */
	enforcePartOptions(options: IEditorPartOptions): IDisposable;
}

export const enum OpenEditorContext {
	NEW_EDITOR = 1,
	MOVE_EDITOR = 2,
	COPY_EDITOR = 3
}

export interface IEditorGroup {

	/**
	 * An event which fires whenever the underlying group model changes.
	 */
	readonly onDidModelChange: Event<IGroupModelChangeEvent>;

	/**
	 * An event that is fired when the group gets disposed.
	 */
	readonly onWillDispose: Event<void>;

	/**
	 * An event that is fired when the active editor in the group changed.
	 */
	readonly onDidActiveEditorChange: Event<IActiveEditorChangeEvent>;

	/**
	 * An event that is fired when an editor is about to close.
	 */
	readonly onWillCloseEditor: Event<IEditorCloseEvent>;

	/**
	 * An event that is fired when an editor is closed.
	 */
	readonly onDidCloseEditor: Event<IEditorCloseEvent>;

	/**
	 * An event that is fired when an editor is about to move to
	 * a different group.
	 */
	readonly onWillMoveEditor: Event<IEditorWillMoveEvent>;

	/**
	 * An event that is fired when an editor is about to be opened
	 * in the group.
	 */
	readonly onWillOpenEditor: Event<IEditorWillOpenEvent>;

	/**
	 * A unique identifier of this group that remains identical even if the
	 * group is moved to different locations.
	 */
	readonly id: GroupIdentifier;

	/**
	 * A number that indicates the position of this group in the visual
	 * order of groups from left to right and top to bottom. The lowest
	 * index will likely be top-left while the largest index in most
	 * cases should be bottom-right, but that depends on the grid.
	 */
	readonly index: number;

	/**
	 * A human readable label for the group. This label can change depending
	 * on the layout of all editor groups. Clients should listen on the
	 * `onDidGroupModelChange` event to react to that.
	 */
	readonly label: string;

	/**
	 * A human readable label for the group to be used by screen readers.
	 */
	readonly ariaLabel: string;

	/**
	 * The active editor pane is the currently visible editor pane of the group.
	 */
	readonly activeEditorPane: IVisibleEditorPane | undefined;

	/**
	 * The active editor is the currently visible editor of the group
	 * within the current active editor pane.
	 */
	readonly activeEditor: EditorInput | null;

	/**
	 * The editor in the group that is in preview mode if any. There can
	 * only ever be one editor in preview mode.
	 */
	readonly previewEditor: EditorInput | null;

	/**
	 * The number of opened editors in this group.
	 */
	readonly count: number;

	/**
	 * Whether the group has editors or not.
	 */
	readonly isEmpty: boolean;

	/**
	 * Whether this editor group is locked or not. Locked editor groups
	 * will only be considered for editors to open in when the group is
	 * explicitly provided for the editor.
	 *
	 * Note: editor group locking only applies when more than one group
	 * is opened.
	 */
	readonly isLocked: boolean;

	/**
	 * The number of sticky editors in this group.
	 */
	readonly stickyCount: number;

	/**
	 * All opened editors in the group in sequential order of their appearance.
	 */
	readonly editors: readonly EditorInput[];

	/**
	 * The scoped context key service for this group.
	 */
	readonly scopedContextKeyService: IContextKeyService;

	/**
	 * Get all editors that are currently opened in the group.
	 *
	 * @param order the order of the editors to use
	 * @param options options to select only specific editors as instructed
	 */
	getEditors(order: EditorsOrder, options?: { excludeSticky?: boolean }): readonly EditorInput[];

	/**
	 * Finds all editors for the given resource that are currently
	 * opened in the group. This method will return an entry for
	 * each editor that reports a `resource` that matches the
	 * provided one.
	 *
	 * @param resource the resource of the editor to find
	 * @param options whether to support side by side editors or not
	 */
	findEditors(resource: URI, options?: IFindEditorOptions): readonly EditorInput[];

	/**
	 * Returns the editor at a specific index of the group.
	 */
	getEditorByIndex(index: number): EditorInput | undefined;

	/**
	 * Returns the index of the editor in the group or -1 if not opened.
	 */
	getIndexOfEditor(editor: EditorInput): number;

	/**
	 * Whether the editor is the first in the group.
	 */
	isFirst(editor: EditorInput): boolean;

	/**
	 * Whether the editor is the last in the group.
	 */
	isLast(editor: EditorInput): boolean;

	/**
	 * Open an editor in this group.
	 *
	 * @returns a promise that resolves around an IEditor instance unless
	 * the call failed, or the editor was not opened as active editor.
	 */
	openEditor(editor: EditorInput, options?: IEditorOptions): Promise<IEditorPane | undefined>;

	/**
	 * Opens editors in this group.
	 *
	 * @returns a promise that resolves around an IEditor instance unless
	 * the call failed, or the editor was not opened as active editor. Since
	 * a group can only ever have one active editor, even if many editors are
	 * opened, the result will only be one editor.
	 */
	openEditors(editors: EditorInputWithOptions[]): Promise<IEditorPane | undefined>;

	/**
	 * Find out if the provided editor is pinned in the group.
	 */
	isPinned(editorOrIndex: EditorInput | number): boolean;

	/**
	 * Find out if the provided editor or index of editor is sticky in the group.
	 */
	isSticky(editorOrIndex: EditorInput | number): boolean;

	/**
	 * Find out if the provided editor is active in the group.
	 */
	isActive(editor: EditorInput | IUntypedEditorInput): boolean;

	/**
	 * Find out if a certain editor is included in the group.
	 *
	 * @param candidate the editor to find
	 * @param options fine tune how to match editors
	 */
	contains(candidate: EditorInput | IUntypedEditorInput, options?: IMatchEditorOptions): boolean;

	/**
	 * Move an editor from this group either within this group or to another group.
	 */
	moveEditor(editor: EditorInput, target: IEditorGroup, options?: IEditorOptions): void;

	/**
	 * Move editors from this group either within this group or to another group.
	 */
	moveEditors(editors: EditorInputWithOptions[], target: IEditorGroup): void;

	/**
	 * Copy an editor from this group to another group.
	 *
	 * Note: It is currently not supported to show the same editor more than once in the same group.
	 */
	copyEditor(editor: EditorInput, target: IEditorGroup, options?: IEditorOptions): void;

	/**
	 * Copy editors from this group to another group.
	 *
	 * Note: It is currently not supported to show the same editor more than once in the same group.
	 */
	copyEditors(editors: EditorInputWithOptions[], target: IEditorGroup): void;

	/**
	 * Close an editor from the group. This may trigger a confirmation dialog if
	 * the editor is dirty and thus returns a promise as value.
	 *
	 * @param editor the editor to close, or the currently active editor
	 * if unspecified.
	 *
	 * @returns a promise when the editor is closed or not. If `true`, the editor
	 * is closed and if `false` there was a veto closing the editor, e.g. when it
	 * is dirty.
	 */
	closeEditor(editor?: EditorInput, options?: ICloseEditorOptions): Promise<boolean>;

	/**
	 * Closes specific editors in this group. This may trigger a confirmation dialog if
	 * there are dirty editors and thus returns a promise as value.
	 *
	 * @returns a promise whether the editors were closed or not. If `true`, the editors
	 * were closed and if `false` there was a veto closing the editors, e.g. when one
	 * is dirty.
	 */
	closeEditors(editors: EditorInput[] | ICloseEditorsFilter, options?: ICloseEditorOptions): Promise<boolean>;

	/**
	 * Closes all editors from the group. This may trigger a confirmation dialog if
	 * there are dirty editors and thus returns a promise as value.
	 *
	 * @returns a promise when all editors are closed.
	 */
	closeAllEditors(options?: ICloseAllEditorsOptions): Promise<boolean>;

	/**
	 * Replaces editors in this group with the provided replacement.
	 *
	 * @param editors the editors to replace
	 *
	 * @returns a promise that is resolved when the replaced active
	 * editor (if any) has finished loading.
	 */
	replaceEditors(editors: IEditorReplacement[]): Promise<void>;

	/**
	 * Set an editor to be pinned. A pinned editor is not replaced
	 * when another editor opens at the same location.
	 *
	 * @param editor the editor to pin, or the currently active editor
	 * if unspecified.
	 */
	pinEditor(editor?: EditorInput): void;

	/**
	 * Set an editor to be sticky. A sticky editor is showing in the beginning
	 * of the tab stripe and will not be impacted by close operations.
	 *
	 * @param editor the editor to make sticky, or the currently active editor
	 * if unspecified.
	 */
	stickEditor(editor?: EditorInput): void;

	/**
	 * Set an editor to be non-sticky and thus moves back to a location after
	 * sticky editors and can be closed normally.
	 *
	 * @param editor the editor to make unsticky, or the currently active editor
	 * if unspecified.
	 */
	unstickEditor(editor?: EditorInput): void;

	/**
	 * Whether this editor group should be locked or not.
	 *
	 * See {@linkcode IEditorGroup.isLocked `isLocked`}
	 */
	lock(locked: boolean): void;

	/**
	 * Move keyboard focus into the group.
	 */
	focus(): void;
}

export function isEditorGroup(obj: unknown): obj is IEditorGroup {
	const group = obj as IEditorGroup | undefined;

	return !!group && typeof group.id === 'number' && Array.isArray(group.editors);
}

//#region Editor Group Helpers

export function preferredSideBySideGroupDirection(configurationService: IConfigurationService): GroupDirection.DOWN | GroupDirection.RIGHT {
	const openSideBySideDirection = configurationService.getValue('workbench.editor.openSideBySideDirection');

	if (openSideBySideDirection === 'down') {
		return GroupDirection.DOWN;
	}

	return GroupDirection.RIGHT;
}

//#endregion
