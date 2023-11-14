/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { Event } from 'vs/base/common/event';
import { IEditorMemento, IEditorCloseEvent, IEditorOpenContext, EditorResourceAccessor, SideBySideEditor } from 'vs/workbench/common/editor';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/textResourceConfiguration';
import { IEditorGroupsService, IEditorGroup } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IExtUri } from 'vs/base/common/resources';
import { IDisposable, MutableDisposable } from 'vs/base/common/lifecycle';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';

/**
 * Base class of editors that want to store and restore view state.
 */
export abstract class AbstractEditorWithViewState<T extends object> extends EditorPane {

	private viewState: IEditorMemento<T>;

	private readonly groupListener = this._register(new MutableDisposable());

	private editorViewStateDisposables: Map<EditorInput, IDisposable> | undefined;

	constructor(
		id: string,
		viewStateStorageKey: string,
		@ITelemetryService telemetryService: ITelemetryService,
		@IInstantiationService protected readonly instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@ITextResourceConfigurationService protected readonly textResourceConfigurationService: ITextResourceConfigurationService,
		@IThemeService themeService: IThemeService,
		@IEditorService protected readonly editorService: IEditorService,
		@IEditorGroupsService protected readonly editorGroupService: IEditorGroupsService
	) {
		super(id, telemetryService, themeService, storageService);

		this.viewState = this.getEditorMemento<T>(editorGroupService, textResourceConfigurationService, viewStateStorageKey, 100);
	}

	protected override setEditorVisible(visible: boolean, group: IEditorGroup | undefined): void {

		// Listen to close events to trigger `onWillCloseEditorInGroup`
		this.groupListener.value = group?.onWillCloseEditor(e => this.onWillCloseEditor(e));

		super.setEditorVisible(visible, group);
	}

	private onWillCloseEditor(e: IEditorCloseEvent): void {
		const editor = e.editor;
		if (editor === this.input) {
			// React to editors closing to preserve or clear view state. This needs to happen
			// in the `onWillCloseEditor` because at that time the editor has not yet
			// been disposed and we can safely persist the view state.
			this.updateEditorViewState(editor);
		}
	}

	override clearInput(): void {

		// Preserve current input view state before clearing
		this.updateEditorViewState(this.input);

		super.clearInput();
	}

	protected override saveState(): void {

		// Preserve current input view state before shutting down
		this.updateEditorViewState(this.input);

		super.saveState();
	}

	private updateEditorViewState(input: EditorInput | undefined): void {
		if (!input || !this.tracksEditorViewState(input)) {
			return; // ensure we have an input to handle view state for
		}

		const resource = this.toEditorViewStateResource(input);
		if (!resource) {
			return; // we need a resource
		}

		// If we are not tracking disposed editor view state
		// make sure to clear the view state once the editor
		// is disposed.
		if (!this.tracksDisposedEditorViewState()) {
			if (!this.editorViewStateDisposables) {
				this.editorViewStateDisposables = new Map<EditorInput, IDisposable>();
			}

			if (!this.editorViewStateDisposables.has(input)) {
				this.editorViewStateDisposables.set(input, Event.once(input.onWillDispose)(() => {
					this.clearEditorViewState(resource, this.group);
					this.editorViewStateDisposables?.delete(input);
				}));
			}
		}

		// Clear the editor view state if:
		// - the editor view state should not be tracked for disposed editors
		// - the user configured to not restore view state unless the editor is still opened in the group
		if (
			(input.isDisposed() && !this.tracksDisposedEditorViewState()) ||
			(!this.shouldRestoreEditorViewState(input) && (!this.group || !this.group.contains(input)))
		) {
			this.clearEditorViewState(resource, this.group);
		}

		// Otherwise we save the view state
		else if (!input.isDisposed()) {
			this.saveEditorViewState(resource);
		}
	}

	private shouldRestoreEditorViewState(input: EditorInput, context?: IEditorOpenContext): boolean {

		// new editor: check with workbench.editor.restoreViewState setting
		if (context?.newInGroup) {
			return this.textResourceConfigurationService.getValue<boolean>(EditorResourceAccessor.getOriginalUri(input, { supportSideBySide: SideBySideEditor.PRIMARY }), 'workbench.editor.restoreViewState') === false ? false : true /* restore by default */;
		}

		// existing editor: always restore viewstate
		return true;
	}

	override getViewState(): T | undefined {
		const input = this.input;
		if (!input || !this.tracksEditorViewState(input)) {
			return undefined; // need valid input for view state
		}

		const resource = this.toEditorViewStateResource(input);
		if (!resource) {
			return undefined; // need a resource for finding view state
		}

		return this.computeEditorViewState(resource);
	}

	private saveEditorViewState(resource: URI): void {
		if (!this.group) {
			return;
		}

		const editorViewState = this.computeEditorViewState(resource);
		if (!editorViewState) {
			return;
		}

		this.viewState.saveEditorState(this.group, resource, editorViewState);
	}

	protected loadEditorViewState(input: EditorInput | undefined, context?: IEditorOpenContext): T | undefined {
		if (!input || !this.group) {
			return undefined; // we need valid input
		}

		if (!this.tracksEditorViewState(input)) {
			return undefined; // not tracking for input
		}

		if (!this.shouldRestoreEditorViewState(input, context)) {
			return undefined; // not enabled for input
		}

		const resource = this.toEditorViewStateResource(input);
		if (!resource) {
			return undefined; // need a resource for finding view state
		}

		return this.viewState.loadEditorState(this.group, resource);
	}

	protected moveEditorViewState(source: URI, target: URI, comparer: IExtUri): void {
		return this.viewState.moveEditorState(source, target, comparer);
	}

	protected clearEditorViewState(resource: URI, group?: IEditorGroup): void {
		this.viewState.clearEditorState(resource, group);
	}

	override dispose(): void {
		super.dispose();

		if (this.editorViewStateDisposables) {
			for (const [, disposables] of this.editorViewStateDisposables) {
				disposables.dispose();
			}

			this.editorViewStateDisposables = undefined;
		}
	}

	//#region Subclasses should/could override based on needs

	/**
	 * The actual method to provide for gathering the view state
	 * object for the control.
	 *
	 * @param resource the expected `URI` for the view state. This
	 * should be used as a way to ensure the view state in the
	 * editor control is matching the resource expected, for example
	 * by comparing with the underlying model (this was a fix for
	 * https://github.com/microsoft/vscode/issues/40114).
	 */
	protected abstract computeEditorViewState(resource: URI): T | undefined;

	/**
	 * Whether view state should be associated with the given input.
	 * Subclasses need to ensure that the editor input is expected
	 * for the editor.
	 */
	protected abstract tracksEditorViewState(input: EditorInput): boolean;

	/**
	 * Whether view state should be tracked even when the editor is
	 * disposed.
	 *
	 * Subclasses should override this if the input can be restored
	 * from the resource at a later point, e.g. if backed by files.
	 */
	protected tracksDisposedEditorViewState(): boolean {
		return false;
	}

	/**
	 * Asks to return the `URI` to associate with the view state.
	 */
	protected abstract toEditorViewStateResource(input: EditorInput): URI | undefined;

	//#endregion
}
