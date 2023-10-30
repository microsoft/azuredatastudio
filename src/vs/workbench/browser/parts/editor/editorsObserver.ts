/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorFactoryRegistry, IEditorIdentifier, GroupIdentifier, EditorExtensions, IEditorPartOptionsChangeEvent, EditorsOrder, GroupModelChangeKind, EditorInputCapabilities } from 'vs/workbench/common/editor';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { SideBySideEditorInput } from 'vs/workbench/common/editor/sideBySideEditorInput';
import { dispose, Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { Registry } from 'vs/platform/registry/common/platform';
import { Event, Emitter } from 'vs/base/common/event';
import { IEditorGroupsService, IEditorGroup, GroupsOrder } from 'vs/workbench/services/editor/common/editorGroupsService';
import { coalesce } from 'vs/base/common/arrays';
import { LinkedMap, Touch, ResourceMap } from 'vs/base/common/map';
import { equals } from 'vs/base/common/objects';
import { IResourceEditorInputIdentifier } from 'vs/platform/editor/common/editor';
import { URI } from 'vs/base/common/uri';

interface ISerializedEditorsList {
	entries: ISerializedEditorIdentifier[];
}

interface ISerializedEditorIdentifier {
	groupId: GroupIdentifier;
	index: number;
}

/**
 * A observer of opened editors across all editor groups by most recently used.
 * Rules:
 * - the last editor in the list is the one most recently activated
 * - the first editor in the list is the one that was activated the longest time ago
 * - an editor that opens inactive will be placed behind the currently active editor
 *
 * The observer may start to close editors based on the workbench.editor.limit setting.
 */
export class EditorsObserver extends Disposable {

	private static readonly STORAGE_KEY = 'editors.mru';

	private readonly keyMap = new Map<GroupIdentifier, Map<EditorInput, IEditorIdentifier>>();
	private readonly mostRecentEditorsMap = new LinkedMap<IEditorIdentifier, IEditorIdentifier>();
	private readonly editorsPerResourceCounter = new ResourceMap<Map<string /* typeId/editorId */, number /* counter */>>();

	private readonly _onDidMostRecentlyActiveEditorsChange = this._register(new Emitter<void>());
	readonly onDidMostRecentlyActiveEditorsChange = this._onDidMostRecentlyActiveEditorsChange.event;

	get count(): number {
		return this.mostRecentEditorsMap.size;
	}

	get editors(): IEditorIdentifier[] {
		return [...this.mostRecentEditorsMap.values()];
	}

	hasEditor(editor: IResourceEditorInputIdentifier): boolean {
		const editors = this.editorsPerResourceCounter.get(editor.resource);

		return editors?.has(this.toIdentifier(editor)) ?? false;
	}

	hasEditors(resource: URI): boolean {
		return this.editorsPerResourceCounter.has(resource);
	}

	private toIdentifier(typeId: string, editorId: string | undefined): string;
	private toIdentifier(editor: IResourceEditorInputIdentifier): string;
	private toIdentifier(arg1: string | IResourceEditorInputIdentifier, editorId?: string | undefined): string {
		if (typeof arg1 !== 'string') {
			return this.toIdentifier(arg1.typeId, arg1.editorId);
		}

		if (editorId) {
			return `${arg1}/${editorId}`;
		}

		return arg1;
	}

	constructor(
		@IEditorGroupsService private editorGroupsService: IEditorGroupsService,
		@IStorageService private readonly storageService: IStorageService
	) {
		super();

		this.registerListeners();
	}

	private registerListeners(): void {
		this._register(this.storageService.onWillSaveState(() => this.saveState()));
		this._register(this.editorGroupsService.onDidAddGroup(group => this.onGroupAdded(group)));
		this._register(this.editorGroupsService.onDidChangeEditorPartOptions(e => this.onDidChangeEditorPartOptions(e)));

		this.editorGroupsService.whenReady.then(() => this.loadState());
	}

	private onGroupAdded(group: IEditorGroup): void {

		// Make sure to add any already existing editor
		// of the new group into our list in LRU order
		const groupEditorsMru = group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
		for (let i = groupEditorsMru.length - 1; i >= 0; i--) {
			this.addMostRecentEditor(group, groupEditorsMru[i], false /* is not active */, true /* is new */);
		}

		// Make sure that active editor is put as first if group is active
		if (this.editorGroupsService.activeGroup === group && group.activeEditor) {
			this.addMostRecentEditor(group, group.activeEditor, true /* is active */, false /* already added before */);
		}

		// Group Listeners
		this.registerGroupListeners(group);
	}

	private registerGroupListeners(group: IEditorGroup): void {
		const groupDisposables = new DisposableStore();
		groupDisposables.add(group.onDidModelChange(e => {
			switch (e.kind) {

				// Group gets active: put active editor as most recent
				case GroupModelChangeKind.GROUP_ACTIVE: {
					if (this.editorGroupsService.activeGroup === group && group.activeEditor) {
						this.addMostRecentEditor(group, group.activeEditor, true /* is active */, false /* editor already opened */);
					}

					break;
				}

				// Editor opens: put it as second most recent
				//
				// Also check for maximum allowed number of editors and
				// start to close oldest ones if needed.
				case GroupModelChangeKind.EDITOR_OPEN: {
					if (e.editor) {
						this.addMostRecentEditor(group, e.editor, false /* is not active */, true /* is new */);
						this.ensureOpenedEditorsLimit({ groupId: group.id, editor: e.editor }, group.id);
					}

					break;
				}
			}
		}));

		// Editor closes: remove from recently opened
		groupDisposables.add(group.onDidCloseEditor(e => {
			this.removeMostRecentEditor(group, e.editor);
		}));

		// Editor gets active: put active editor as most recent
		// if group is active, otherwise second most recent
		groupDisposables.add(group.onDidActiveEditorChange(e => {
			if (e.editor) {
				this.addMostRecentEditor(group, e.editor, this.editorGroupsService.activeGroup === group, false /* editor already opened */);
			}
		}));

		// Make sure to cleanup on dispose
		Event.once(group.onWillDispose)(() => dispose(groupDisposables));
	}

	private onDidChangeEditorPartOptions(event: IEditorPartOptionsChangeEvent): void {
		if (!equals(event.newPartOptions.limit, event.oldPartOptions.limit)) {
			const activeGroup = this.editorGroupsService.activeGroup;
			let exclude: IEditorIdentifier | undefined = undefined;
			if (activeGroup.activeEditor) {
				exclude = { editor: activeGroup.activeEditor, groupId: activeGroup.id };
			}

			this.ensureOpenedEditorsLimit(exclude);
		}
	}

	private addMostRecentEditor(group: IEditorGroup, editor: EditorInput, isActive: boolean, isNew: boolean): void {
		const key = this.ensureKey(group, editor);
		const mostRecentEditor = this.mostRecentEditorsMap.first;

		// Active or first entry: add to end of map
		if (isActive || !mostRecentEditor) {
			this.mostRecentEditorsMap.set(key, key, mostRecentEditor ? Touch.AsOld /* make first */ : undefined);
		}

		// Otherwise: insert before most recent
		else {
			// we have most recent editors. as such we
			// put this newly opened editor right before
			// the current most recent one because it cannot
			// be the most recently active one unless
			// it becomes active. but it is still more
			// active then any other editor in the list.
			this.mostRecentEditorsMap.set(key, key, Touch.AsOld /* make first */);
			this.mostRecentEditorsMap.set(mostRecentEditor, mostRecentEditor, Touch.AsOld /* make first */);
		}

		// Update in resource map if this is a new editor
		if (isNew) {
			this.updateEditorResourcesMap(editor, true);
		}

		// Event
		this._onDidMostRecentlyActiveEditorsChange.fire();
	}

	private updateEditorResourcesMap(editor: EditorInput, add: boolean): void {

		// Distill the editor resource and type id with support
		// for side by side editor's primary side too.
		let resource: URI | undefined = undefined;
		let typeId: string | undefined = undefined;
		let editorId: string | undefined = undefined;
		if (editor instanceof SideBySideEditorInput) {
			resource = editor.primary.resource;
			typeId = editor.primary.typeId;
			editorId = editor.primary.editorId;
		} else {
			resource = editor.resource;
			typeId = editor.typeId;
			editorId = editor.editorId;
		}

		if (!resource) {
			return; // require a resource
		}

		const identifier = this.toIdentifier(typeId, editorId);

		// Add entry
		if (add) {
			let editorsPerResource = this.editorsPerResourceCounter.get(resource);
			if (!editorsPerResource) {
				editorsPerResource = new Map<string, number>();
				this.editorsPerResourceCounter.set(resource, editorsPerResource);
			}

			editorsPerResource.set(identifier, (editorsPerResource.get(identifier) ?? 0) + 1);
		}

		// Remove entry
		else {
			const editorsPerResource = this.editorsPerResourceCounter.get(resource);
			if (editorsPerResource) {
				const counter = editorsPerResource.get(identifier) ?? 0;
				if (counter > 1) {
					editorsPerResource.set(identifier, counter - 1);
				} else {
					editorsPerResource.delete(identifier);

					if (editorsPerResource.size === 0) {
						this.editorsPerResourceCounter.delete(resource);
					}
				}
			}
		}
	}

	private removeMostRecentEditor(group: IEditorGroup, editor: EditorInput): void {

		// Update in resource map
		this.updateEditorResourcesMap(editor, false);

		// Update in MRU list
		const key = this.findKey(group, editor);
		if (key) {

			// Remove from most recent editors
			this.mostRecentEditorsMap.delete(key);

			// Remove from key map
			const map = this.keyMap.get(group.id);
			if (map && map.delete(key.editor) && map.size === 0) {
				this.keyMap.delete(group.id);
			}

			// Event
			this._onDidMostRecentlyActiveEditorsChange.fire();
		}
	}

	private findKey(group: IEditorGroup, editor: EditorInput): IEditorIdentifier | undefined {
		const groupMap = this.keyMap.get(group.id);
		if (!groupMap) {
			return undefined;
		}

		return groupMap.get(editor);
	}

	private ensureKey(group: IEditorGroup, editor: EditorInput): IEditorIdentifier {
		let groupMap = this.keyMap.get(group.id);
		if (!groupMap) {
			groupMap = new Map();

			this.keyMap.set(group.id, groupMap);
		}

		let key = groupMap.get(editor);
		if (!key) {
			key = { groupId: group.id, editor };
			groupMap.set(editor, key);
		}

		return key;
	}

	private async ensureOpenedEditorsLimit(exclude: IEditorIdentifier | undefined, groupId?: GroupIdentifier): Promise<void> {
		if (
			!this.editorGroupsService.partOptions.limit?.enabled ||
			typeof this.editorGroupsService.partOptions.limit.value !== 'number' ||
			this.editorGroupsService.partOptions.limit.value <= 0
		) {
			return; // return early if not enabled or invalid
		}

		const limit = this.editorGroupsService.partOptions.limit.value;

		// In editor group
		if (this.editorGroupsService.partOptions.limit?.perEditorGroup) {

			// For specific editor groups
			if (typeof groupId === 'number') {
				const group = this.editorGroupsService.getGroup(groupId);
				if (group) {
					await this.doEnsureOpenedEditorsLimit(limit, group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).map(editor => ({ editor, groupId })), exclude);
				}
			}

			// For all editor groups
			else {
				for (const group of this.editorGroupsService.groups) {
					await this.ensureOpenedEditorsLimit(exclude, group.id);
				}
			}
		}

		// Across all editor groups
		else {
			await this.doEnsureOpenedEditorsLimit(limit, [...this.mostRecentEditorsMap.values()], exclude);
		}
	}

	private async doEnsureOpenedEditorsLimit(limit: number, mostRecentEditors: IEditorIdentifier[], exclude?: IEditorIdentifier): Promise<void> {

		// Check for `excludeDirty` setting and apply it by excluding
		// any recent editor that is dirty from the opened editors limit
		let mostRecentEditorsCountingForLimit: IEditorIdentifier[];
		if (this.editorGroupsService.partOptions.limit?.excludeDirty) {
			mostRecentEditorsCountingForLimit = mostRecentEditors.filter(({ editor }) => {
				if ((editor.isDirty() && !editor.isSaving()) || editor.hasCapability(EditorInputCapabilities.Scratchpad)) {
					return false; // not dirty editors (unless in the process of saving) or scratchpads
				}

				return true;
			});
		} else {
			mostRecentEditorsCountingForLimit = mostRecentEditors;
		}

		if (limit >= mostRecentEditorsCountingForLimit.length) {
			return; // only if opened editors exceed setting and is valid and enabled
		}

		// Extract least recently used editors that can be closed
		const leastRecentlyClosableEditors = mostRecentEditorsCountingForLimit.reverse().filter(({ editor, groupId }) => {
			if ((editor.isDirty() && !editor.isSaving()) || editor.hasCapability(EditorInputCapabilities.Scratchpad)) {
				return false; // not dirty editors (unless in the process of saving) or scratchpads
			}

			if (exclude && editor === exclude.editor && groupId === exclude.groupId) {
				return false; // never the editor that should be excluded
			}

			if (this.editorGroupsService.getGroup(groupId)?.isSticky(editor)) {
				return false; // never sticky editors
			}

			return true;
		});

		// Close editors until we reached the limit again
		let editorsToCloseCount = mostRecentEditorsCountingForLimit.length - limit;
		const mapGroupToEditorsToClose = new Map<GroupIdentifier, EditorInput[]>();
		for (const { groupId, editor } of leastRecentlyClosableEditors) {
			let editorsInGroupToClose = mapGroupToEditorsToClose.get(groupId);
			if (!editorsInGroupToClose) {
				editorsInGroupToClose = [];
				mapGroupToEditorsToClose.set(groupId, editorsInGroupToClose);
			}

			editorsInGroupToClose.push(editor);
			editorsToCloseCount--;

			if (editorsToCloseCount === 0) {
				break; // limit reached
			}
		}

		for (const [groupId, editors] of mapGroupToEditorsToClose) {
			const group = this.editorGroupsService.getGroup(groupId);
			if (group) {
				await group.closeEditors(editors, { preserveFocus: true });
			}
		}
	}

	private saveState(): void {
		if (this.mostRecentEditorsMap.isEmpty()) {
			this.storageService.remove(EditorsObserver.STORAGE_KEY, StorageScope.WORKSPACE);
		} else {
			this.storageService.store(EditorsObserver.STORAGE_KEY, JSON.stringify(this.serialize()), StorageScope.WORKSPACE, StorageTarget.MACHINE);
		}
	}

	private serialize(): ISerializedEditorsList {
		const registry = Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory);

		const entries = [...this.mostRecentEditorsMap.values()];
		const mapGroupToSerializableEditorsOfGroup = new Map<IEditorGroup, EditorInput[]>();

		return {
			entries: coalesce(entries.map(({ editor, groupId }) => {

				// Find group for entry
				const group = this.editorGroupsService.getGroup(groupId);
				if (!group) {
					return undefined;
				}

				// Find serializable editors of group
				let serializableEditorsOfGroup = mapGroupToSerializableEditorsOfGroup.get(group);
				if (!serializableEditorsOfGroup) {
					serializableEditorsOfGroup = group.getEditors(EditorsOrder.SEQUENTIAL).filter(editor => {
						const editorSerializer = registry.getEditorSerializer(editor);

						return editorSerializer?.canSerialize(editor);
					});
					mapGroupToSerializableEditorsOfGroup.set(group, serializableEditorsOfGroup);
				}

				// Only store the index of the editor of that group
				// which can be undefined if the editor is not serializable
				const index = serializableEditorsOfGroup.indexOf(editor);
				if (index === -1) {
					return undefined;
				}

				return { groupId, index };
			}))
		};
	}

	private loadState(): void {
		const serialized = this.storageService.get(EditorsObserver.STORAGE_KEY, StorageScope.WORKSPACE);

		// Previous state: Load editors map from persisted state
		if (serialized) {
			this.deserialize(JSON.parse(serialized));
		}

		// No previous state: best we can do is add each editor
		// from oldest to most recently used editor group
		else {
			const groups = this.editorGroupsService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE);
			for (let i = groups.length - 1; i >= 0; i--) {
				const group = groups[i];
				const groupEditorsMru = group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
				for (let i = groupEditorsMru.length - 1; i >= 0; i--) {
					this.addMostRecentEditor(group, groupEditorsMru[i], true /* enforce as active to preserve order */, true /* is new */);
				}
			}
		}

		// Ensure we listen on group changes for those that exist on startup
		for (const group of this.editorGroupsService.groups) {
			this.registerGroupListeners(group);
		}
	}

	private deserialize(serialized: ISerializedEditorsList): void {
		const mapValues: [IEditorIdentifier, IEditorIdentifier][] = [];

		for (const { groupId, index } of serialized.entries) {

			// Find group for entry
			const group = this.editorGroupsService.getGroup(groupId);
			if (!group) {
				continue;
			}

			// Find editor for entry
			const editor = group.getEditorByIndex(index);
			if (!editor) {
				continue;
			}

			// Make sure key is registered as well
			const editorIdentifier = this.ensureKey(group, editor);
			mapValues.push([editorIdentifier, editorIdentifier]);

			// Update in resource map
			this.updateEditorResourcesMap(editor, true);
		}

		// Fill map with deserialized values
		this.mostRecentEditorsMap.fromJSON(mapValues);
	}
}
