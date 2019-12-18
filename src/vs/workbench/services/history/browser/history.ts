/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { onUnexpectedError } from 'vs/base/common/errors';
import { URI, UriComponents } from 'vs/base/common/uri';
import { IEditor } from 'vs/editor/common/editorCommon';
import { ITextEditorOptions, IResourceInput, ITextEditorSelection } from 'vs/platform/editor/common/editor';
import { IEditorInput, IEditor as IBaseEditor, Extensions as EditorExtensions, EditorInput, IEditorCloseEvent, IEditorInputFactoryRegistry, toResource, IEditorIdentifier, GroupIdentifier, Extensions } from 'vs/workbench/common/editor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IHistoryService } from 'vs/workbench/services/history/common/history';
import { FileChangesEvent, IFileService, FileChangeType, FILES_EXCLUDE_CONFIG } from 'vs/platform/files/common/files';
import { Selection } from 'vs/editor/common/core/selection';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { dispose, Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { Registry } from 'vs/platform/registry/common/platform';
import { Event, Emitter } from 'vs/base/common/event';
import { IConfigurationService, IConfigurationChangeEvent } from 'vs/platform/configuration/common/configuration';
import { IEditorGroupsService, IEditorGroup, EditorsOrder, GroupChangeKind, GroupsOrder } from 'vs/workbench/services/editor/common/editorGroupsService';
import { getCodeEditor, ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { getExcludes, ISearchConfiguration } from 'vs/workbench/services/search/common/search';
import { IExpression } from 'vs/base/common/glob';
import { ICursorPositionChangedEvent } from 'vs/editor/common/controller/cursorEvents';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ResourceGlobMatcher } from 'vs/workbench/common/resources';
import { EditorServiceImpl } from 'vs/workbench/browser/parts/editor/editor';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { IContextKeyService, RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { coalesce } from 'vs/base/common/arrays';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { withNullAsUndefined } from 'vs/base/common/types';
import { addDisposableListener, EventType, EventHelper } from 'vs/base/browser/dom';
import { IWorkspacesService } from 'vs/platform/workspaces/common/workspaces';
import { Schemas } from 'vs/base/common/network';
import { LinkedMap, Touch } from 'vs/base/common/map';

//#region Text Editor State helper

/**
 * Stores the selection & view state of an editor and allows to compare it to other selection states.
 */
export class TextEditorState {

	private static readonly EDITOR_SELECTION_THRESHOLD = 10; // number of lines to move in editor to justify for new state

	private textEditorSelection?: ITextEditorSelection;

	constructor(private _editorInput: IEditorInput, private _selection: Selection | null) {
		this.textEditorSelection = Selection.isISelection(_selection) ? {
			startLineNumber: _selection.startLineNumber,
			startColumn: _selection.startColumn
		} : undefined;
	}

	get editorInput(): IEditorInput {
		return this._editorInput;
	}

	get selection(): ITextEditorSelection | undefined {
		return this.textEditorSelection;
	}

	justifiesNewPushState(other: TextEditorState, event?: ICursorPositionChangedEvent): boolean {
		if (event?.source === 'api') {
			return true; // always let API source win (e.g. "Go to definition" should add a history entry)
		}

		if (!this._editorInput.matches(other._editorInput)) {
			return true; // different editor inputs
		}

		if (!Selection.isISelection(this._selection) || !Selection.isISelection(other._selection)) {
			return true; // unknown selections
		}

		const thisLineNumber = Math.min(this._selection.selectionStartLineNumber, this._selection.positionLineNumber);
		const otherLineNumber = Math.min(other._selection.selectionStartLineNumber, other._selection.positionLineNumber);

		if (Math.abs(thisLineNumber - otherLineNumber) < TextEditorState.EDITOR_SELECTION_THRESHOLD) {
			return false; // ignore selection changes in the range of EditorState.EDITOR_SELECTION_THRESHOLD lines
		}

		return true;
	}
}

//#endregion

//#region Editors History

interface ISerializedEditorHistory {
	history: ISerializedEditorIdentifier[];
}

interface ISerializedEditorIdentifier {
	groupId: GroupIdentifier;
	index: number;
}

/**
 * A history of opened editors across all editor groups by most recently used.
 * Rules:
 * - the last editor in the history is the one most recently activated
 * - the first editor in the history is the one that was activated the longest time ago
 * - an editor that opens inactive will be placed behind the currently active editor
 */
export class EditorsHistory extends Disposable {

	private static readonly STORAGE_KEY = 'history.editors';

	private readonly keyMap = new Map<GroupIdentifier, Map<IEditorInput, IEditorIdentifier>>();
	private readonly mostRecentEditorsMap = new LinkedMap<IEditorIdentifier, IEditorIdentifier>();

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	get editors(): IEditorIdentifier[] {
		return this.mostRecentEditorsMap.values();
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

		this.editorGroupsService.whenRestored.then(() => this.loadState());
	}

	private onGroupAdded(group: IEditorGroup): void {

		// Make sure to add any already existing editor
		// of the new group into our history in LRU order
		const groupEditorsMru = group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
		for (let i = groupEditorsMru.length - 1; i >= 0; i--) {
			this.addMostRecentEditor(group, groupEditorsMru[i], false /* is not active */);
		}

		// Make sure that active editor is put as first if group is active
		if (this.editorGroupsService.activeGroup === group && group.activeEditor) {
			this.addMostRecentEditor(group, group.activeEditor, true /* is active */);
		}

		// Group Listeners
		this.registerGroupListeners(group);
	}

	private registerGroupListeners(group: IEditorGroup): void {
		const groupDisposables = new DisposableStore();
		groupDisposables.add(group.onDidGroupChange(e => {
			switch (e.kind) {

				// Group gets active: put active editor as most recent
				case GroupChangeKind.GROUP_ACTIVE: {
					if (this.editorGroupsService.activeGroup === group && group.activeEditor) {
						this.addMostRecentEditor(group, group.activeEditor, true /* is active */);
					}

					break;
				}

				// Editor gets active: put active editor as most recent
				// if group is active, otherwise second most recent
				case GroupChangeKind.EDITOR_ACTIVE: {
					if (e.editor) {
						this.addMostRecentEditor(group, e.editor, this.editorGroupsService.activeGroup === group);
					}

					break;
				}

				// Editor opens: put it as second most recent
				case GroupChangeKind.EDITOR_OPEN: {
					if (e.editor) {
						this.addMostRecentEditor(group, e.editor, false /* is not active */);
					}

					break;
				}

				// Editor closes: remove from recently opened
				case GroupChangeKind.EDITOR_CLOSE: {
					if (e.editor) {
						this.removeMostRecentEditor(group, e.editor);
					}

					break;
				}
			}
		}));

		// Make sure to cleanup on dispose
		Event.once(group.onWillDispose)(() => dispose(groupDisposables));
	}

	private addMostRecentEditor(group: IEditorGroup, editor: IEditorInput, isActive: boolean): void {
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

		// Event
		this._onDidChange.fire();
	}

	private removeMostRecentEditor(group: IEditorGroup, editor: IEditorInput): void {
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
			this._onDidChange.fire();
		}
	}

	private findKey(group: IEditorGroup, editor: IEditorInput): IEditorIdentifier | undefined {
		const groupMap = this.keyMap.get(group.id);
		if (!groupMap) {
			return undefined;
		}

		return groupMap.get(editor);
	}

	private ensureKey(group: IEditorGroup, editor: IEditorInput): IEditorIdentifier {
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

	private saveState(): void {
		if (this.mostRecentEditorsMap.isEmpty()) {
			this.storageService.remove(EditorsHistory.STORAGE_KEY, StorageScope.WORKSPACE);
		} else {
			this.storageService.store(EditorsHistory.STORAGE_KEY, JSON.stringify(this.serialize()), StorageScope.WORKSPACE);
		}
	}

	private serialize(): ISerializedEditorHistory {
		const registry = Registry.as<IEditorInputFactoryRegistry>(Extensions.EditorInputFactories);

		const history = this.mostRecentEditorsMap.values();
		const mapGroupToSerializableEditorsOfGroup = new Map<IEditorGroup, IEditorInput[]>();

		return {
			history: coalesce(history.map(({ editor, groupId }) => {

				// Find group for entry
				const group = this.editorGroupsService.getGroup(groupId);
				if (!group) {
					return undefined;
				}

				// Find serializable editors of group
				let serializableEditorsOfGroup = mapGroupToSerializableEditorsOfGroup.get(group);
				if (!serializableEditorsOfGroup) {
					serializableEditorsOfGroup = group.getEditors(EditorsOrder.SEQUENTIAL).filter(editor => {
						const factory = registry.getEditorInputFactory(editor.getTypeId());

						return factory?.canSerialize(editor);
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
		const serialized = this.storageService.get(EditorsHistory.STORAGE_KEY, StorageScope.WORKSPACE);

		// Previous state:
		if (serialized) {

			// Load history map from persisted state
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
					this.addMostRecentEditor(group, groupEditorsMru[i], true /* enforce as active to preserve order */);
				}
			}
		}

		// Ensure we listen on group changes for those that exist on startup
		for (const group of this.editorGroupsService.groups) {
			this.registerGroupListeners(group);
		}
	}

	deserialize(serialized: ISerializedEditorHistory): void {
		const mapValues: [IEditorIdentifier, IEditorIdentifier][] = [];

		for (const { groupId, index } of serialized.history) {

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
		}

		// Fill map with deserialized values
		this.mostRecentEditorsMap.fromJSON(mapValues);
	}
}

//#endregion

interface ISerializedEditorHistoryEntry {
	resourceJSON?: object;
	editorInputJSON?: { typeId: string; deserialized: string; };
}

interface IStackEntry {
	input: IEditorInput | IResourceInput;
	selection?: ITextEditorSelection;
}

interface IRecentlyClosedFile {
	resource: URI;
	index: number;
}

export class HistoryService extends Disposable implements IHistoryService {

	_serviceBrand: undefined;

	private readonly activeEditorListeners = this._register(new DisposableStore());
	private lastActiveEditor?: IEditorIdentifier;

	private readonly editorHistoryListeners: Map<EditorInput, DisposableStore> = new Map();
	private readonly editorStackListeners: Map<EditorInput, DisposableStore> = new Map();

	constructor(
		@IEditorService private readonly editorService: EditorServiceImpl,
		@IEditorGroupsService private readonly editorGroupService: IEditorGroupsService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IStorageService private readonly storageService: IStorageService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspacesService private readonly workspacesService: IWorkspacesService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
	) {
		super();

		this.registerListeners();
	}

	private registerListeners(): void {
		this._register(this.editorService.onDidActiveEditorChange(() => this.onActiveEditorChanged()));
		this._register(this.editorService.onDidOpenEditorFail(event => this.remove(event.editor)));
		this._register(this.editorService.onDidCloseEditor(event => this.onEditorClosed(event)));
		this._register(this.storageService.onWillSaveState(() => this.saveState()));
		this._register(this.fileService.onFileChanges(event => this.onFileChanges(event)));
		this._register(this.resourceFilter.onExpressionChange(() => this.removeExcludedFromHistory()));
		this._register(this.mostRecentlyUsedOpenEditors.onDidChange(() => this.handleEditorEventInRecentEditorsStack()));

		// if the service is created late enough that an editor is already opened
		// make sure to trigger the onActiveEditorChanged() to track the editor
		// properly (fixes https://github.com/Microsoft/vscode/issues/59908)
		if (this.editorService.activeControl) {
			this.onActiveEditorChanged();
		}

		// Mouse back/forward support
		const mouseBackForwardSupportListener = this._register(new DisposableStore());
		const handleMouseBackForwardSupport = () => {
			mouseBackForwardSupportListener.clear();

			if (this.configurationService.getValue('workbench.editor.mouseBackForwardToNavigate')) {
				mouseBackForwardSupportListener.add(addDisposableListener(this.layoutService.getWorkbenchElement(), EventType.MOUSE_DOWN, e => this.onMouseDown(e)));
			}
		};

		this._register(this.configurationService.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('workbench.editor.mouseBackForwardToNavigate')) {
				handleMouseBackForwardSupport();
			}
		}));

		handleMouseBackForwardSupport();
	}

	private onMouseDown(e: MouseEvent): void {

		// Support to navigate in history when mouse buttons 4/5 are pressed
		switch (e.button) {
			case 3:
				EventHelper.stop(e);
				this.back();
				break;
			case 4:
				EventHelper.stop(e);
				this.forward();
				break;
		}
	}

	private onActiveEditorChanged(): void {
		const activeControl = this.editorService.activeControl;
		if (this.lastActiveEditor && this.matchesEditor(this.lastActiveEditor, activeControl)) {
			return; // return if the active editor is still the same
		}

		// Remember as last active editor (can be undefined if none opened)
		this.lastActiveEditor = activeControl?.input && activeControl.group ? { editor: activeControl.input, groupId: activeControl.group.id } : undefined;

		// Dispose old listeners
		this.activeEditorListeners.clear();

		// Propagate to history
		this.handleActiveEditorChange(activeControl);

		// Apply listener for selection changes if this is a text editor
		const activeTextEditorWidget = getCodeEditor(this.editorService.activeTextEditorWidget);
		const activeEditor = this.editorService.activeEditor;
		if (activeTextEditorWidget) {

			// Debounce the event with a timeout of 0ms so that multiple calls to
			// editor.setSelection() are folded into one. We do not want to record
			// subsequent history navigations for such API calls.
			this.activeEditorListeners.add(Event.debounce(activeTextEditorWidget.onDidChangeCursorPosition, (last, event) => event, 0)((event => {
				this.handleEditorSelectionChangeEvent(activeControl, event);
			})));

			// Track the last edit location by tracking model content change events
			// Use a debouncer to make sure to capture the correct cursor position
			// after the model content has changed.
			this.activeEditorListeners.add(Event.debounce(activeTextEditorWidget.onDidChangeModelContent, (last, event) => event, 0)((event => {
				if (activeEditor) {
					this.rememberLastEditLocation(activeEditor, activeTextEditorWidget);
				}
			})));
		}
	}

	private matchesEditor(identifier: IEditorIdentifier, editor?: IBaseEditor): boolean {
		if (!editor || !editor.group) {
			return false;
		}

		if (identifier.groupId !== editor.group.id) {
			return false;
		}

		return identifier.editor.matches(editor.input);
	}

	private onFileChanges(e: FileChangesEvent): void {
		if (e.gotDeleted()) {
			this.remove(e); // remove from history files that got deleted or moved
		}
	}

	private handleEditorSelectionChangeEvent(editor?: IBaseEditor, event?: ICursorPositionChangedEvent): void {
		this.handleEditorEventInNavigationStack(editor, event);
	}

	private handleActiveEditorChange(editor?: IBaseEditor): void {
		this.handleEditorEventInHistory(editor);
		this.handleEditorEventInNavigationStack(editor);
	}

	private onEditorDispose(editor: EditorInput, listener: Function, mapEditorToDispose: Map<EditorInput, DisposableStore>): void {
		const toDispose = Event.once(editor.onDispose)(() => listener());

		let disposables = mapEditorToDispose.get(editor);
		if (!disposables) {
			disposables = new DisposableStore();
			mapEditorToDispose.set(editor, disposables);
		}

		disposables.add(toDispose);
	}

	private clearOnEditorDispose(editor: IEditorInput | IResourceInput | FileChangesEvent, mapEditorToDispose: Map<EditorInput, DisposableStore>): void {
		if (editor instanceof EditorInput) {
			const disposables = mapEditorToDispose.get(editor);
			if (disposables) {
				dispose(disposables);
				mapEditorToDispose.delete(editor);
			}
		}
	}

	remove(input: IEditorInput | IResourceInput): void;
	remove(input: FileChangesEvent): void;
	remove(arg1: IEditorInput | IResourceInput | FileChangesEvent): void {
		this.removeFromHistory(arg1);
		this.removeFromNavigationStack(arg1);
		this.removeFromRecentlyClosedFiles(arg1);
		this.removeFromRecentlyOpened(arg1);
	}

	private removeFromRecentlyOpened(arg1: IEditorInput | IResourceInput | FileChangesEvent): void {
		if (arg1 instanceof EditorInput || arg1 instanceof FileChangesEvent) {
			return; // for now do not delete from file events since recently open are likely out of workspace files for which there are no delete events
		}

		const input = arg1 as IResourceInput;

		this.workspacesService.removeFromRecentlyOpened([input.resource]);
	}

	clear(): void {
		this.ensureHistoryLoaded();

		// Navigation (next, previous)
		this.navigationStackIndex = -1;
		this.lastNavigationStackIndex = -1;
		this.navigationStack.splice(0);
		this.editorStackListeners.forEach(listeners => dispose(listeners));
		this.editorStackListeners.clear();

		// Closed files
		this.recentlyClosedFiles = [];

		// History
		this.clearRecentlyOpened();

		// Context Keys
		this.updateContextKeys();
	}

	//#region Navigation (Go Forward, Go Backward)

	private static readonly MAX_NAVIGATION_STACK_ITEMS = 50;

	private navigationStack: IStackEntry[] = [];
	private navigationStackIndex = -1;
	private lastNavigationStackIndex = -1;

	private navigatingInStack = false;

	private currentTextEditorState: TextEditorState | null = null;

	forward(): void {
		if (this.navigationStack.length > this.navigationStackIndex + 1) {
			this.setIndex(this.navigationStackIndex + 1);
			this.navigate();
		}
	}

	back(): void {
		if (this.navigationStackIndex > 0) {
			this.setIndex(this.navigationStackIndex - 1);
			this.navigate();
		}
	}

	last(): void {
		if (this.lastNavigationStackIndex === -1) {
			this.back();
		} else {
			this.setIndex(this.lastNavigationStackIndex);
			this.navigate();
		}
	}

	private setIndex(value: number): void {
		this.lastNavigationStackIndex = this.navigationStackIndex;
		this.navigationStackIndex = value;

		// Context Keys
		this.updateContextKeys();
	}

	private navigate(): void {
		this.navigatingInStack = true;

		const navigateToStackEntry = this.navigationStack[this.navigationStackIndex];

		this.doNavigate(navigateToStackEntry).finally(() => this.navigatingInStack = false);
	}

	private doNavigate(location: IStackEntry): Promise<IBaseEditor | undefined> {
		const options: ITextEditorOptions = {
			revealIfOpened: true // support to navigate across editor groups
		};

		// Support selection and minimize scrolling by setting revealInCenterIfOutsideViewport
		if (location.selection) {
			options.selection = location.selection;
			options.revealInCenterIfOutsideViewport = true;
		}

		if (location.input instanceof EditorInput) {
			return this.editorService.openEditor(location.input, options);
		}

		return this.editorService.openEditor({ resource: (location.input as IResourceInput).resource, options });
	}

	private handleEditorEventInNavigationStack(control: IBaseEditor | undefined, event?: ICursorPositionChangedEvent): void {
		const codeEditor = control ? getCodeEditor(control.getControl()) : undefined;

		// treat editor changes that happen as part of stack navigation specially
		// we do not want to add a new stack entry as a matter of navigating the
		// stack but we need to keep our currentTextEditorState up to date with
		// the navigtion that occurs.
		if (this.navigatingInStack) {
			if (codeEditor && control?.input && !control.input.isDisposed()) {
				this.currentTextEditorState = new TextEditorState(control.input, codeEditor.getSelection());
			} else {
				this.currentTextEditorState = null; // we navigated to a non text or disposed editor
			}
		}

		// normal navigation not part of history navigation
		else {

			// navigation inside text editor
			if (codeEditor && control?.input && !control.input.isDisposed()) {
				this.handleTextEditorEventInNavigationStack(control, codeEditor, event);
			}

			// navigation to non-text disposed editor
			else {
				this.currentTextEditorState = null; // at this time we have no active text editor view state

				if (control?.input && !control.input.isDisposed()) {
					this.handleNonTextEditorEventInNavigationStack(control);
				}
			}
		}
	}

	private handleTextEditorEventInNavigationStack(editor: IBaseEditor, editorControl: IEditor, event?: ICursorPositionChangedEvent): void {
		if (!editor.input) {
			return;
		}

		const stateCandidate = new TextEditorState(editor.input, editorControl.getSelection());

		// Add to stack if we dont have a current state or this new state justifies a push
		if (!this.currentTextEditorState || this.currentTextEditorState.justifiesNewPushState(stateCandidate, event)) {
			this.addToNavigationStack(editor.input, stateCandidate.selection);
		}

		// Otherwise we replace the current stack entry with this one
		else {
			this.replaceInNavigationStack(editor.input, stateCandidate.selection);
		}

		// Update our current text editor state
		this.currentTextEditorState = stateCandidate;
	}

	private handleNonTextEditorEventInNavigationStack(editor: IBaseEditor): void {
		if (!editor.input) {
			return;
		}

		const currentStack = this.navigationStack[this.navigationStackIndex];
		if (currentStack && this.matches(editor.input, currentStack.input)) {
			return; // do not push same editor input again
		}

		this.addToNavigationStack(editor.input);
	}

	private addToNavigationStack(input: IEditorInput, selection?: ITextEditorSelection): void {
		if (!this.navigatingInStack) {
			this.doAddOrReplaceInNavigationStack(input, selection);
		}
	}

	private replaceInNavigationStack(input: IEditorInput, selection?: ITextEditorSelection): void {
		if (!this.navigatingInStack) {
			this.doAddOrReplaceInNavigationStack(input, selection, true /* force replace */);
		}
	}

	private doAddOrReplaceInNavigationStack(input: IEditorInput, selection?: ITextEditorSelection, forceReplace?: boolean): void {

		// Overwrite an entry in the stack if we have a matching input that comes
		// with editor options to indicate that this entry is more specific. Also
		// prevent entries that have the exact same options. Finally, Overwrite
		// entries if we detect that the change came in very fast which indicates
		// that it was not coming in from a user change but rather rapid programmatic
		// changes. We just take the last of the changes to not cause too many entries
		// on the stack.
		// We can also be instructed to force replace the last entry.
		let replace = false;
		const currentEntry = this.navigationStack[this.navigationStackIndex];
		if (currentEntry) {
			if (forceReplace) {
				replace = true; // replace if we are forced to
			} else if (this.matches(input, currentEntry.input) && this.sameSelection(currentEntry.selection, selection)) {
				replace = true; // replace if the input is the same as the current one and the selection as well
			}
		}

		const stackInput = this.preferResourceInput(input);
		const entry = { input: stackInput, selection };

		// Replace at current position
		let removedEntries: IStackEntry[] = [];
		if (replace) {
			removedEntries.push(this.navigationStack[this.navigationStackIndex]);
			this.navigationStack[this.navigationStackIndex] = entry;
		}

		// Add to stack at current position
		else {

			// If we are not at the end of history, we remove anything after
			if (this.navigationStack.length > this.navigationStackIndex + 1) {
				for (let i = this.navigationStackIndex + 1; i < this.navigationStack.length; i++) {
					removedEntries.push(this.navigationStack[i]);
				}

				this.navigationStack = this.navigationStack.slice(0, this.navigationStackIndex + 1);
			}

			// Insert entry at index
			this.navigationStack.splice(this.navigationStackIndex + 1, 0, entry);

			// Check for limit
			if (this.navigationStack.length > HistoryService.MAX_NAVIGATION_STACK_ITEMS) {
				removedEntries.push(this.navigationStack.shift()!); // remove first
				if (this.lastNavigationStackIndex >= 0) {
					this.lastNavigationStackIndex--;
				}
			} else {
				this.setIndex(this.navigationStackIndex + 1);
			}
		}

		// Clear editor listeners from removed entries
		removedEntries.forEach(removedEntry => this.clearOnEditorDispose(removedEntry.input, this.editorStackListeners));

		// Remove this from the stack unless the stack input is a resource
		// that can easily be restored even when the input gets disposed
		if (stackInput instanceof EditorInput) {
			this.onEditorDispose(stackInput, () => this.removeFromNavigationStack(stackInput), this.editorStackListeners);
		}

		// Context Keys
		this.updateContextKeys();
	}

	private preferResourceInput(input: IEditorInput): IEditorInput | IResourceInput {
		const resource = input.getResource();
		if (resource && (resource.scheme === Schemas.file || resource.scheme === Schemas.vscodeRemote || resource.scheme === Schemas.userData)) {
			// for now, only prefer well known schemes that we control to prevent
			// issues such as https://github.com/microsoft/vscode/issues/85204
			return { resource };
		}

		return input;
	}

	private sameSelection(selectionA?: ITextEditorSelection, selectionB?: ITextEditorSelection): boolean {
		if (!selectionA && !selectionB) {
			return true;
		}

		if (!selectionA || !selectionB) {
			return false;
		}

		return selectionA.startLineNumber === selectionB.startLineNumber; // we consider the history entry same if we are on the same line
	}

	private removeFromNavigationStack(arg1: IEditorInput | IResourceInput | FileChangesEvent): void {
		this.navigationStack = this.navigationStack.filter(e => {
			const matches = this.matches(arg1, e.input);

			// Cleanup any listeners associated with the input when removing
			if (matches) {
				this.clearOnEditorDispose(arg1, this.editorStackListeners);
			}

			return !matches;
		});
		this.navigationStackIndex = this.navigationStack.length - 1; // reset index
		this.lastNavigationStackIndex = -1;

		// Context Keys
		this.updateContextKeys();
	}

	private matches(arg1: IEditorInput | IResourceInput | FileChangesEvent, inputB: IEditorInput | IResourceInput): boolean {
		if (arg1 instanceof FileChangesEvent) {
			if (inputB instanceof EditorInput) {
				return false; // we only support this for IResourceInput
			}

			const resourceInputB = inputB as IResourceInput;

			return arg1.contains(resourceInputB.resource, FileChangeType.DELETED);
		}

		if (arg1 instanceof EditorInput && inputB instanceof EditorInput) {
			return arg1.matches(inputB);
		}

		if (arg1 instanceof EditorInput) {
			return this.matchesFile((inputB as IResourceInput).resource, arg1);
		}

		if (inputB instanceof EditorInput) {
			return this.matchesFile((arg1 as IResourceInput).resource, inputB);
		}

		const resourceInputA = arg1 as IResourceInput;
		const resourceInputB = inputB as IResourceInput;

		return resourceInputA && resourceInputB && resourceInputA.resource.toString() === resourceInputB.resource.toString();
	}

	private matchesFile(resource: URI, arg2: IEditorInput | IResourceInput | FileChangesEvent): boolean {
		if (arg2 instanceof FileChangesEvent) {
			return arg2.contains(resource, FileChangeType.DELETED);
		}

		if (arg2 instanceof EditorInput) {
			const inputResource = arg2.getResource();
			if (!inputResource) {
				return false;
			}

			if (this.layoutService.isRestored() && !this.fileService.canHandleResource(inputResource)) {
				return false; // make sure to only check this when workbench has restored (for https://github.com/Microsoft/vscode/issues/48275)
			}

			return inputResource.toString() === resource.toString();
		}

		const resourceInput = arg2 as IResourceInput;

		return resourceInput?.resource.toString() === resource.toString();
	}

	//#endregion

	//#region Recently Closed Files

	private static readonly MAX_RECENTLY_CLOSED_EDITORS = 20;

	private recentlyClosedFiles: IRecentlyClosedFile[] = [];

	private onEditorClosed(event: IEditorCloseEvent): void {

		// Track closing of editor to support to reopen closed editors (unless editor was replaced)
		if (!event.replaced) {
			const resource = event.editor ? event.editor.getResource() : undefined;
			const supportsReopen = resource && this.fileService.canHandleResource(resource); // we only support file'ish things to reopen
			if (resource && supportsReopen) {

				// Remove all inputs matching and add as last recently closed
				this.removeFromRecentlyClosedFiles(event.editor);
				this.recentlyClosedFiles.push({ resource, index: event.index });

				// Bounding
				if (this.recentlyClosedFiles.length > HistoryService.MAX_RECENTLY_CLOSED_EDITORS) {
					this.recentlyClosedFiles.shift();
				}

				// Context
				this.canReopenClosedEditorContextKey.set(true);
			}
		}
	}

	reopenLastClosedEditor(): void {
		let lastClosedFile = this.recentlyClosedFiles.pop();
		while (lastClosedFile && this.editorGroupService.activeGroup.isOpened({ resource: lastClosedFile.resource })) {
			lastClosedFile = this.recentlyClosedFiles.pop(); // pop until we find a file that is not opened
		}

		if (lastClosedFile) {
			(async () => {
				const editor = await this.editorService.openEditor({ resource: lastClosedFile.resource, options: { pinned: true, index: lastClosedFile.index } });

				// Fix for https://github.com/Microsoft/vscode/issues/67882
				// If opening of the editor fails, make sure to try the next one
				// but make sure to remove this one from the list to prevent
				// endless loops.
				if (!editor) {
					this.recentlyClosedFiles.pop();
					this.reopenLastClosedEditor();
				}
			})();
		}

		// Context
		this.canReopenClosedEditorContextKey.set(this.recentlyClosedFiles.length > 0);
	}

	private removeFromRecentlyClosedFiles(arg1: IEditorInput | IResourceInput | FileChangesEvent): void {
		this.recentlyClosedFiles = this.recentlyClosedFiles.filter(e => !this.matchesFile(e.resource, arg1));
		this.canReopenClosedEditorContextKey.set(this.recentlyClosedFiles.length > 0);
	}

	//#endregion

	//#region Last Edit Location

	private lastEditLocation: IStackEntry | undefined;

	private rememberLastEditLocation(activeEditor: IEditorInput, activeTextEditorWidget: ICodeEditor): void {
		this.lastEditLocation = { input: activeEditor };
		this.canNavigateToLastEditLocationContextKey.set(true);

		const position = activeTextEditorWidget.getPosition();
		if (position) {
			this.lastEditLocation.selection = {
				startLineNumber: position.lineNumber,
				startColumn: position.column
			};
		}
	}

	openLastEditLocation(): void {
		if (this.lastEditLocation) {
			this.doNavigate(this.lastEditLocation);
		}
	}

	//#endregion

	//#region Context Keys

	private readonly canNavigateBackContextKey = (new RawContextKey<boolean>('canNavigateBack', false)).bindTo(this.contextKeyService);
	private readonly canNavigateForwardContextKey = (new RawContextKey<boolean>('canNavigateForward', false)).bindTo(this.contextKeyService);
	private readonly canNavigateToLastEditLocationContextKey = (new RawContextKey<boolean>('canNavigateToLastEditLocation', false)).bindTo(this.contextKeyService);
	private readonly canReopenClosedEditorContextKey = (new RawContextKey<boolean>('canReopenClosedEditor', false)).bindTo(this.contextKeyService);

	private updateContextKeys(): void {
		this.canNavigateBackContextKey.set(this.navigationStack.length > 0 && this.navigationStackIndex > 0);
		this.canNavigateForwardContextKey.set(this.navigationStack.length > 0 && this.navigationStackIndex < this.navigationStack.length - 1);
		this.canNavigateToLastEditLocationContextKey.set(!!this.lastEditLocation);
		this.canReopenClosedEditorContextKey.set(this.recentlyClosedFiles.length > 0);
	}

	//#endregion

	//#region History

	private static readonly MAX_HISTORY_ITEMS = 200;
	private static readonly HISTORY_STORAGE_KEY = 'history.entries';

	private history: Array<IEditorInput | IResourceInput> = [];
	private loaded = false;
	private readonly resourceFilter = this._register(this.instantiationService.createInstance(
		ResourceGlobMatcher,
		(root?: URI) => this.getExcludes(root),
		(event: IConfigurationChangeEvent) => event.affectsConfiguration(FILES_EXCLUDE_CONFIG) || event.affectsConfiguration('search.exclude')
	));

	private getExcludes(root?: URI): IExpression {
		const scope = root ? { resource: root } : undefined;

		return getExcludes(scope ? this.configurationService.getValue<ISearchConfiguration>(scope) : this.configurationService.getValue<ISearchConfiguration>())!;
	}

	private handleEditorEventInHistory(editor?: IBaseEditor): void {

		// Ensure we have not configured to exclude input and don't track invalid inputs
		const input = editor?.input;
		if (!input || input.isDisposed() || !this.include(input)) {
			return;
		}

		this.ensureHistoryLoaded();

		const historyInput = this.preferResourceInput(input);

		// Remove any existing entry and add to the beginning
		this.removeFromHistory(input);
		this.history.unshift(historyInput);

		// Respect max entries setting
		if (this.history.length > HistoryService.MAX_HISTORY_ITEMS) {
			this.clearOnEditorDispose(this.history.pop()!, this.editorHistoryListeners);
		}

		// Remove this from the history unless the history input is a resource
		// that can easily be restored even when the input gets disposed
		if (historyInput instanceof EditorInput) {
			this.onEditorDispose(historyInput, () => this.removeFromHistory(historyInput), this.editorHistoryListeners);
		}
	}

	private include(input: IEditorInput | IResourceInput): boolean {
		if (input instanceof EditorInput) {
			return true; // include any non files
		}

		const resourceInput = input as IResourceInput;

		return !this.resourceFilter.matches(resourceInput.resource);
	}

	private removeExcludedFromHistory(): void {
		this.ensureHistoryLoaded();

		this.history = this.history.filter(e => {
			const include = this.include(e);

			// Cleanup any listeners associated with the input when removing from history
			if (!include) {
				this.clearOnEditorDispose(e, this.editorHistoryListeners);
			}

			return include;
		});
	}

	private removeFromHistory(arg1: IEditorInput | IResourceInput | FileChangesEvent): void {
		this.ensureHistoryLoaded();

		this.history = this.history.filter(e => {
			const matches = this.matches(arg1, e);

			// Cleanup any listeners associated with the input when removing from history
			if (matches) {
				this.clearOnEditorDispose(arg1, this.editorHistoryListeners);
			}

			return !matches;
		});
	}

	clearRecentlyOpened(): void {
		this.history = [];

		this.editorHistoryListeners.forEach(listeners => dispose(listeners));
		this.editorHistoryListeners.clear();
	}

	getHistory(): Array<IEditorInput | IResourceInput> {
		this.ensureHistoryLoaded();

		return this.history.slice(0);
	}

	private ensureHistoryLoaded(): void {
		if (!this.loaded) {
			this.loadHistory();
		}

		this.loaded = true;
	}

	private saveState(): void {
		if (!this.history) {
			return; // nothing to save because history was not used
		}

		const registry = Registry.as<IEditorInputFactoryRegistry>(EditorExtensions.EditorInputFactories);

		const entries: ISerializedEditorHistoryEntry[] = coalesce(this.history.map((input): ISerializedEditorHistoryEntry | undefined => {

			// Editor input: try via factory
			if (input instanceof EditorInput) {
				const factory = registry.getEditorInputFactory(input.getTypeId());
				if (factory) {
					const deserialized = factory.serialize(input);
					if (deserialized) {
						return { editorInputJSON: { typeId: input.getTypeId(), deserialized } };
					}
				}
			}

			// File resource: via URI.toJSON()
			else {
				return { resourceJSON: (input as IResourceInput).resource.toJSON() };
			}

			return undefined;
		}));

		this.storageService.store(HistoryService.HISTORY_STORAGE_KEY, JSON.stringify(entries), StorageScope.WORKSPACE);
	}

	private loadHistory(): void {
		let entries: ISerializedEditorHistoryEntry[] = [];

		const entriesRaw = this.storageService.get(HistoryService.HISTORY_STORAGE_KEY, StorageScope.WORKSPACE);
		if (entriesRaw) {
			entries = coalesce(JSON.parse(entriesRaw));
		}

		const registry = Registry.as<IEditorInputFactoryRegistry>(EditorExtensions.EditorInputFactories);

		this.history = coalesce(entries.map(entry => {
			try {
				return this.safeLoadHistoryEntry(registry, entry);
			} catch (error) {
				onUnexpectedError(error);

				return undefined; // https://github.com/Microsoft/vscode/issues/60960
			}
		}));
	}

	private safeLoadHistoryEntry(registry: IEditorInputFactoryRegistry, entry: ISerializedEditorHistoryEntry): IEditorInput | IResourceInput | undefined {
		const serializedEditorHistoryEntry = entry;

		// File resource: via URI.revive()
		if (serializedEditorHistoryEntry.resourceJSON) {
			return { resource: URI.revive(<UriComponents>serializedEditorHistoryEntry.resourceJSON) };
		}

		// Editor input: via factory
		const { editorInputJSON } = serializedEditorHistoryEntry;
		if (editorInputJSON?.deserialized) {
			const factory = registry.getEditorInputFactory(editorInputJSON.typeId);
			if (factory) {
				const input = factory.deserialize(this.instantiationService, editorInputJSON.deserialized);
				if (input) {
					this.onEditorDispose(input, () => this.removeFromHistory(input), this.editorHistoryListeners);
				}

				return withNullAsUndefined(input);
			}
		}

		return undefined;
	}

	//#endregion

	//#region Last Active Workspace/File

	getLastActiveWorkspaceRoot(schemeFilter?: string): URI | undefined {

		// No Folder: return early
		const folders = this.contextService.getWorkspace().folders;
		if (folders.length === 0) {
			return undefined;
		}

		// Single Folder: return early
		if (folders.length === 1) {
			const resource = folders[0].uri;
			if (!schemeFilter || resource.scheme === schemeFilter) {
				return resource;
			}

			return undefined;
		}

		// Multiple folders: find the last active one
		const history = this.getHistory();
		for (const input of history) {
			if (input instanceof EditorInput) {
				continue;
			}

			const resourceInput = input as IResourceInput;
			if (schemeFilter && resourceInput.resource.scheme !== schemeFilter) {
				continue;
			}

			const resourceWorkspace = this.contextService.getWorkspaceFolder(resourceInput.resource);
			if (resourceWorkspace) {
				return resourceWorkspace.uri;
			}
		}

		// fallback to first workspace matching scheme filter if any
		for (const folder of folders) {
			const resource = folder.uri;
			if (!schemeFilter || resource.scheme === schemeFilter) {
				return resource;
			}
		}

		return undefined;
	}

	getLastActiveFile(filterByScheme: string): URI | undefined {
		const history = this.getHistory();
		for (const input of history) {
			let resource: URI | undefined;
			if (input instanceof EditorInput) {
				resource = toResource(input, { filterByScheme });
			} else {
				resource = (input as IResourceInput).resource;
			}

			if (resource?.scheme === filterByScheme) {
				return resource;
			}
		}

		return undefined;
	}

	//#endregion

	//#region Editor Most Recently Used History

	private readonly mostRecentlyUsedOpenEditors = this._register(this.instantiationService.createInstance(EditorsHistory));

	private recentlyUsedEditorsStack: IEditorIdentifier[] | undefined = undefined;
	private recentlyUsedEditorsStackIndex = 0;

	private recentlyUsedEditorsInGroupStack: IEditorIdentifier[] | undefined = undefined;
	private recentlyUsedEditorsInGroupStackIndex = 0;

	private navigatingInRecentlyUsedEditorsStack = false;
	private navigatingInRecentlyUsedEditorsInGroupStack = false;

	openNextRecentlyUsedEditor(groupId?: GroupIdentifier): void {
		const [stack, index] = this.ensureRecentlyUsedStack(index => index - 1, groupId);

		this.doNavigateInRecentlyUsedEditorsStack(stack[index], groupId);
	}

	openPreviouslyUsedEditor(groupId?: GroupIdentifier): void {
		const [stack, index] = this.ensureRecentlyUsedStack(index => index + 1, groupId);

		this.doNavigateInRecentlyUsedEditorsStack(stack[index], groupId);
	}

	private doNavigateInRecentlyUsedEditorsStack(editorIdentifier: IEditorIdentifier | undefined, groupId?: GroupIdentifier): void {
		if (editorIdentifier) {
			const acrossGroups = typeof groupId !== 'number' || !this.editorGroupService.getGroup(groupId);

			if (acrossGroups) {
				this.navigatingInRecentlyUsedEditorsStack = true;
			} else {
				this.navigatingInRecentlyUsedEditorsInGroupStack = true;
			}

			this.editorService.openEditor(editorIdentifier.editor, undefined, editorIdentifier.groupId).finally(() => {
				if (acrossGroups) {
					this.navigatingInRecentlyUsedEditorsStack = false;
				} else {
					this.navigatingInRecentlyUsedEditorsInGroupStack = false;
				}
			});
		}
	}

	private ensureRecentlyUsedStack(indexModifier: (index: number) => number, groupId?: GroupIdentifier): [IEditorIdentifier[], number] {
		let editors: IEditorIdentifier[];
		let index: number;

		const group = typeof groupId === 'number' ? this.editorGroupService.getGroup(groupId) : undefined;

		// Across groups
		if (!group) {
			editors = this.recentlyUsedEditorsStack || this.mostRecentlyUsedOpenEditors.editors;
			index = this.recentlyUsedEditorsStackIndex;
		}

		// Within group
		else {
			editors = this.recentlyUsedEditorsInGroupStack || group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).map(editor => ({ groupId: group.id, editor }));
			index = this.recentlyUsedEditorsInGroupStackIndex;
		}

		// Adjust index
		let newIndex = indexModifier(index);
		if (newIndex < 0) {
			newIndex = 0;
		} else if (newIndex > editors.length - 1) {
			newIndex = editors.length - 1;
		}

		// Remember index and editors
		if (!group) {
			this.recentlyUsedEditorsStack = editors;
			this.recentlyUsedEditorsStackIndex = newIndex;
		} else {
			this.recentlyUsedEditorsInGroupStack = editors;
			this.recentlyUsedEditorsInGroupStackIndex = newIndex;
		}

		return [editors, newIndex];
	}

	private handleEditorEventInRecentEditorsStack(): void {

		// Drop all-editors stack unless navigating in all editors
		if (!this.navigatingInRecentlyUsedEditorsStack) {
			this.recentlyUsedEditorsStack = undefined;
			this.recentlyUsedEditorsStackIndex = 0;
		}

		// Drop in-group-editors stack unless navigating in group
		if (!this.navigatingInRecentlyUsedEditorsInGroupStack) {
			this.recentlyUsedEditorsInGroupStack = undefined;
			this.recentlyUsedEditorsInGroupStackIndex = 0;
		}
	}

	getMostRecentlyUsedOpenEditors(): Array<IEditorIdentifier> {
		return this.mostRecentlyUsedOpenEditors.editors;
	}

	//#endregion
}

registerSingleton(IHistoryService, HistoryService);
