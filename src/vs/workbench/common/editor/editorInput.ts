/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { firstOrDefault } from 'vs/base/common/arrays';
import { EditorInputCapabilities, Verbosity, GroupIdentifier, ISaveOptions, IRevertOptions, IMoveResult, IEditorDescriptor, IEditorPane, IUntypedEditorInput, EditorResourceAccessor, AbstractEditorInput, isEditorInput, IEditorIdentifier } from 'vs/workbench/common/editor';
import { isEqual } from 'vs/base/common/resources';
import { ConfirmResult } from 'vs/platform/dialogs/common/dialogs';

/**
 * Editor inputs are lightweight objects that can be passed to the workbench API to open inside the editor part.
 * Each editor input is mapped to an editor that is capable of opening it through the Platform facade.
 */
export abstract class EditorInput extends AbstractEditorInput {

	protected readonly _onDidChangeDirty = this._register(new Emitter<void>());
	protected readonly _onDidChangeLabel = this._register(new Emitter<void>());
	protected readonly _onDidChangeCapabilities = this._register(new Emitter<void>());
	private readonly _onWillDispose = this._register(new Emitter<void>());

	/**
	 * Triggered when this input changes its dirty state.
	 */
	readonly onDidChangeDirty = this._onDidChangeDirty.event;

	/**
	 * Triggered when this input changes its label
	 */
	readonly onDidChangeLabel = this._onDidChangeLabel.event;

	/**
	 * Triggered when this input changes its capabilities.
	 */
	readonly onDidChangeCapabilities = this._onDidChangeCapabilities.event;

	/**
	 * Triggered when this input is about to be disposed.
	 */
	readonly onWillDispose = this._onWillDispose.event;

	private disposed: boolean = false;

	/**
	 * Unique type identifier for this input. Every editor input of the
	 * same class should share the same type identifier. The type identifier
	 * is used for example for serialising/deserialising editor inputs
	 * via the serialisers of the `EditorInputFactoryRegistry`.
	 */
	abstract get typeId(): string;

	/**
	 * Returns the optional associated resource of this input.
	 *
	 * This resource should be unique for all editors of the same
	 * kind and input and is often used to identify the editor input among
	 * others.
	 *
	 * **Note:** DO NOT use this property for anything but identity
	 * checks. DO NOT use this property to present as label to the user.
	 * Please refer to `EditorResourceAccessor` documentation in that case.
	 */
	abstract get resource(): URI | undefined;

	/**
	 * Identifies the type of editor this input represents
	 * This ID is registered with the {@link EditorResolverService} to allow
	 * for resolving an untyped input to a typed one
	 */
	get editorId(): string | undefined {
		return undefined;
	}

	/**
	 * The capabilities of the input.
	 */
	get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly;
	}

	/**
	 * Figure out if the input has the provided capability.
	 */
	hasCapability(capability: EditorInputCapabilities): boolean {
		if (capability === EditorInputCapabilities.None) {
			return this.capabilities === EditorInputCapabilities.None;
		}

		return (this.capabilities & capability) !== 0;
	}

	/**
	 * Returns the display name of this input.
	 */
	getName(): string {
		return `Editor ${this.typeId}`;
	}

	/**
	 * Returns the display description of this input.
	 */
	getDescription(verbosity?: Verbosity): string | undefined {
		return undefined;
	}

	/**
	 * Returns the display title of this input.
	 */
	getTitle(verbosity?: Verbosity): string {
		return this.getName();
	}

	/**
	 * Returns the extra classes to apply to the label of this input.
	 */
	getLabelExtraClasses(): string[] {
		return [];
	}

	/**
	 * Returns the aria label to be read out by a screen reader.
	 */
	getAriaLabel(): string {
		return this.getTitle(Verbosity.SHORT);
	}

	/**
	 * Returns a descriptor suitable for telemetry events.
	 *
	 * Subclasses should extend if they can contribute.
	 */
	getTelemetryDescriptor(): { [key: string]: unknown } {
		/* __GDPR__FRAGMENT__
			"EditorTelemetryDescriptor" : {
				"typeId" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
			}
		*/
		return { typeId: this.typeId };
	}

	/**
	 * Returns if this input is dirty or not.
	 */
	isDirty(): boolean {
		return false;
	}

	/**
	 * Returns if this input is currently being saved or soon to be
	 * saved. Based on this assumption the editor may for example
	 * decide to not signal the dirty state to the user assuming that
	 * the save is scheduled to happen anyway.
	 */
	isSaving(): boolean {
		return false;
	}

	/**
	 * Returns a type of `IEditorModel` that represents the resolved input.
	 * Subclasses should override to provide a meaningful model or return
	 * `null` if the editor does not require a model.
	 */
	async resolve(): Promise<IEditorModel | null> {
		return null;
	}

	/**
	 * Optional: if this method is implemented, allows an editor to
	 * control what should happen when the editor (or a list of editors
	 * of the same kind) is dirty and there is an intent to close it.
	 *
	 * By default a file specific dialog will open. If the editor is
	 * not dealing with files, this method should be implemented to
	 * show a different dialog.
	 *
	 * @param editors if more than one editor is closed, will pass in
	 * each editor of the same kind to be able to show a combined dialog.
	 */
	confirm?(editors?: ReadonlyArray<IEditorIdentifier>): Promise<ConfirmResult>;

	/**
	 * Saves the editor. The provided groupId helps implementors
	 * to e.g. preserve view state of the editor and re-open it
	 * in the correct group after saving.
	 *
	 * @returns the resulting editor input (typically the same) of
	 * this operation or `undefined` to indicate that the operation
	 * failed or was canceled.
	 */
	async save(group: GroupIdentifier, options?: ISaveOptions): Promise<EditorInput | undefined> {
		return this;
	}

	/**
	 * Saves the editor to a different location. The provided `group`
	 * helps implementors to e.g. preserve view state of the editor
	 * and re-open it in the correct group after saving.
	 *
	 * @returns the resulting editor input (typically a different one)
	 * of this operation or `undefined` to indicate that the operation
	 * failed or was canceled.
	 */
	async saveAs(group: GroupIdentifier, options?: ISaveOptions): Promise<EditorInput | undefined> {
		return this;
	}

	/**
	 * Reverts this input from the provided group.
	 */
	async revert(group: GroupIdentifier, options?: IRevertOptions): Promise<void> { }

	/**
	 * Called to determine how to handle a resource that is renamed that matches
	 * the editors resource (or is a child of).
	 *
	 * Implementors are free to not implement this method to signal no intent
	 * to participate. If an editor is returned though, it will replace the
	 * current one with that editor and optional options.
	 */
	async rename(group: GroupIdentifier, target: URI): Promise<IMoveResult | undefined> {
		return undefined;
	}

	/**
	 * Returns a copy of the current editor input. Used when we can't just reuse the input
	 */
	copy(): EditorInput {
		return this;
	}

	/**
	 * Returns if the other object matches this input.
	 */
	matches(otherInput: EditorInput | IUntypedEditorInput): boolean {

		// Typed inputs: via  === check
		if (isEditorInput(otherInput)) {
			return this === otherInput;
		}

		// Untyped inputs: go into properties
		const otherInputEditorId = otherInput.options?.override;

		if (this.editorId === undefined) {
			return false; // untyped inputs can only match for editors that have adopted `editorId`
		}

		if (this.editorId !== otherInputEditorId) {
			return false; // untyped input uses another `editorId`
		}

		return isEqual(this.resource, EditorResourceAccessor.getCanonicalUri(otherInput));
	}

	/**
	 * If a editor was registered onto multiple editor panes, this method
	 * will be asked to return the preferred one to use.
	 *
	 * @param editorPanes a list of editor pane descriptors that are candidates
	 * for the editor to open in.
	 */
	prefersEditorPane<T extends IEditorDescriptor<IEditorPane>>(editorPanes: T[]): T | undefined {
		return firstOrDefault(editorPanes);
	}

	/**
	 * Returns a representation of this typed editor input as untyped
	 * resource editor input that e.g. can be used to serialize the
	 * editor input into a form that it can be restored.
	 *
	 * May return `undefined` if a untyped representatin is not supported.
	 *
	 * @param options additional configuration for the expected return type.
	 * When `preserveViewState` is provided, implementations should try to
	 * preserve as much view state as possible from the typed input based on
	 * the group the editor is opened.
	 */
	toUntyped(options?: { preserveViewState: GroupIdentifier }): IUntypedEditorInput | undefined {
		return undefined;
	}

	/**
	 * Returns if this editor is disposed.
	 */
	isDisposed(): boolean {
		return this.disposed;
	}

	override dispose(): void {
		if (!this.disposed) {
			this.disposed = true;
			this._onWillDispose.fire();
		}

		super.dispose();
	}
}
