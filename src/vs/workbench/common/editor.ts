/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Event } from 'vs/base/common/event';
import { assertIsDefined, isUndefinedOrNull } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import { IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { IEditor, IEditorViewState, IDiffEditor } from 'vs/editor/common/editorCommon';
import { IEditorModel, IEditorOptions, ITextEditorOptions, IBaseResourceEditorInput, IResourceEditorInput, ITextResourceEditorInput, IBaseTextResourceEditorInput } from 'vs/platform/editor/common/editor';
import { IInstantiationService, IConstructorSignature0, ServicesAccessor, BrandedService } from 'vs/platform/instantiation/common/instantiation';
import { IContextKeyService, RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { Registry } from 'vs/platform/registry/common/platform';
import { IEncodingSupport, IModeSupport } from 'vs/workbench/services/textfile/common/textfiles';
import { GroupsOrder, IEditorGroup, IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { ICompositeControl, IComposite } from 'vs/workbench/common/composite';
import { IFileService } from 'vs/platform/files/common/files';
import { IPathData } from 'vs/platform/windows/common/windows';
import { coalesce } from 'vs/base/common/arrays';
import { ACTIVE_GROUP, IResourceEditorInputType, SIDE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { IExtUri } from 'vs/base/common/resources';

// Static values for editor contributions
export const EditorExtensions = {
	Editors: 'workbench.contributions.editors',
	Associations: 'workbench.editors.associations',
	EditorInputFactories: 'workbench.contributions.editor.inputFactories'
};

// Editor State Context Keys
export const ActiveEditorDirtyContext = new RawContextKey<boolean>('activeEditorIsDirty', false, localize('activeEditorIsDirty', "Whether the active editor is dirty"));
export const ActiveEditorPinnedContext = new RawContextKey<boolean>('activeEditorIsNotPreview', false, localize('activeEditorIsNotPreview', "Whether the active editor is not in preview mode"));
export const ActiveEditorStickyContext = new RawContextKey<boolean>('activeEditorIsPinned', false, localize('activeEditorIsPinned', "Whether the active editor is pinned"));
export const ActiveEditorReadonlyContext = new RawContextKey<boolean>('activeEditorIsReadonly', false, localize('activeEditorIsReadonly', "Whether the active editor is readonly"));

// Editor Kind Context Keys
export const ActiveEditorContext = new RawContextKey<string | null>('activeEditor', null, { type: 'string', description: localize('activeEditor', "The identifier of the active editor") });
export const ActiveEditorAvailableEditorIdsContext = new RawContextKey<string>('activeEditorAvailableEditorIds', '', localize('activeEditorAvailableEditorIds', "The available editor identifiers that are usable for the active editor"));
export const TextCompareEditorVisibleContext = new RawContextKey<boolean>('textCompareEditorVisible', false, localize('textCompareEditorVisible', "Whether a text compare editor is visible"));
export const TextCompareEditorActiveContext = new RawContextKey<boolean>('textCompareEditorActive', false, localize('textCompareEditorActive', "Whether a text compare editor is active"));

// Editor Group Context Keys
export const EditorGroupEditorsCountContext = new RawContextKey<number>('groupEditorsCount', 0, localize('groupEditorsCount', "The number of opened editor groups"));
export const ActiveEditorGroupEmptyContext = new RawContextKey<boolean>('activeEditorGroupEmpty', false, localize('activeEditorGroupEmpty', "Whether the active editor group is empty"));
export const ActiveEditorGroupIndexContext = new RawContextKey<number>('activeEditorGroupIndex', 0, localize('activeEditorGroupIndex', "The index of the active editor group"));
export const ActiveEditorGroupLastContext = new RawContextKey<boolean>('activeEditorGroupLast', false, localize('activeEditorGroupLast', "Whether the active editor group is the last group"));
export const MultipleEditorGroupsContext = new RawContextKey<boolean>('multipleEditorGroups', false, localize('multipleEditorGroups', "Whether there are multiple editor groups opened"));
export const SingleEditorGroupsContext = MultipleEditorGroupsContext.toNegated();

// Editor Layout Context Keys
export const EditorsVisibleContext = new RawContextKey<boolean>('editorIsOpen', false, localize('editorIsOpen', "Whether an editor is open"));
export const InEditorZenModeContext = new RawContextKey<boolean>('inZenMode', false, localize('inZenMode', "Whether Zen mode is enabled"));
export const IsCenteredLayoutContext = new RawContextKey<boolean>('isCenteredLayout', false, localize('isCenteredLayout', "Whether centered layout is enabled"));
export const SplitEditorsVertically = new RawContextKey<boolean>('splitEditorsVertically', false, localize('splitEditorsVertically', "Whether editors split vertically"));
export const EditorAreaVisibleContext = new RawContextKey<boolean>('editorAreaVisible', true, localize('editorAreaVisible', "Whether the editor area is visible"));

/**
 * Text diff editor id.
 */
export const TEXT_DIFF_EDITOR_ID = 'workbench.editors.textDiffEditor';

/**
 * Binary diff editor id.
 */
export const BINARY_DIFF_EDITOR_ID = 'workbench.editors.binaryResourceDiffEditor';

export interface IEditorDescriptor<T extends IEditorPane> {

	/**
	 * The unique type identifier of the editor. All instances
	 * of the same `IEditorPane` should have the same type
	 * identifier.
	 */
	readonly typeId: string;

	/**
	 * The display name of the editor.
	 */
	readonly name: string;

	/**
	 * Instantiates the editor pane using the provided services.
	 */
	instantiate(instantiationService: IInstantiationService): T;

	/**
	 * Whether the descriptor is for the provided editor pane.
	 */
	describes(editorPane: T): boolean;
}

/**
 * The editor pane is the container for workbench editors.
 */
export interface IEditorPane extends IComposite {

	/**
	 * The assigned input of this editor.
	 */
	readonly input: IEditorInput | undefined;

	/**
	 * The assigned options of the editor.
	 */
	readonly options: IEditorOptions | undefined;

	/**
	 * The assigned group this editor is showing in.
	 */
	readonly group: IEditorGroup | undefined;

	/**
	 * The minimum width of this editor.
	 */
	readonly minimumWidth: number;

	/**
	 * The maximum width of this editor.
	 */
	readonly maximumWidth: number;

	/**
	 * The minimum height of this editor.
	 */
	readonly minimumHeight: number;

	/**
	 * The maximum height of this editor.
	 */
	readonly maximumHeight: number;

	/**
	 * An event to notify whenever minimum/maximum width/height changes.
	 */
	readonly onDidChangeSizeConstraints: Event<{ width: number; height: number; } | undefined>;

	/**
	 * The context key service for this editor. Should be overridden by
	 * editors that have their own ScopedContextKeyService
	 */
	readonly scopedContextKeyService: IContextKeyService | undefined;

	/**
	 * Returns the underlying control of this editor. Callers need to cast
	 * the control to a specific instance as needed, e.g. by using the
	 * `isCodeEditor` helper method to access the text code editor.
	 */
	getControl(): IEditorControl | undefined;

	/**
	 * Finds out if this editor is visible or not.
	 */
	isVisible(): boolean;
}

/**
 * Overrides `IEditorPane` where `input` and `group` are known to be set.
 */
export interface IVisibleEditorPane extends IEditorPane {
	readonly input: IEditorInput;
	readonly group: IEditorGroup;
}

/**
 * The text editor pane is the container for workbench text editors.
 */
export interface ITextEditorPane extends IEditorPane {

	/**
	 * Returns the underlying text editor widget of this editor.
	 */
	getControl(): IEditor | undefined;

	/**
	 * Returns the current view state of the text editor if any.
	 */
	getViewState(): IEditorViewState | undefined;
}

export function isTextEditorPane(thing: IEditorPane | undefined): thing is ITextEditorPane {
	const candidate = thing as ITextEditorPane | undefined;

	return typeof candidate?.getViewState === 'function';
}

/**
 * The text editor pane is the container for workbench text diff editors.
 */
export interface ITextDiffEditorPane extends IEditorPane {

	/**
	 * Returns the underlying text editor widget of this editor.
	 */
	getControl(): IDiffEditor | undefined;
}

/**
 * Marker interface for the control inside an editor pane. Callers
 * have to cast the control to work with it, e.g. via methods
 * such as `isCodeEditor(control)`.
 */
export interface IEditorControl extends ICompositeControl { }

export interface IFileEditorInputFactory {

	/**
	 * The type identifier of the file editor input.
	 */
	typeId: string;

	/**
	 * Creates new new editor input capable of showing files.
	 */
	createFileEditorInput(resource: URI, preferredResource: URI | undefined, preferredName: string | undefined, preferredDescription: string | undefined, preferredEncoding: string | undefined, preferredMode: string | undefined, preferredContents: string | undefined, instantiationService: IInstantiationService): IFileEditorInput;

	/**
	 * Check if the provided object is a file editor input.
	 */
	isFileEditorInput(obj: unknown): obj is IFileEditorInput;
}

export interface IEditorInputFactoryRegistry {

	/**
	 * Registers the file editor input factory to use for file inputs.
	 */
	registerFileEditorInputFactory(factory: IFileEditorInputFactory): void;

	/**
	 * Returns the file editor input factory to use for file inputs.
	 */
	getFileEditorInputFactory(): IFileEditorInputFactory;

	/**
	 * Registers a editor input serializer for the given editor input to the registry.
	 * An editor input serializer is capable of serializing and deserializing editor
	 * inputs from string data.
	 *
	 * @param editorInputTypeId the type identifier of the editor input
	 * @param serializer the editor input serializer for serialization/deserialization
	 */
	registerEditorInputSerializer<Services extends BrandedService[]>(editorInputTypeId: string, ctor: { new(...Services: Services): IEditorInputSerializer }): IDisposable;

	/**
	 * Returns the editor input serializer for the given editor input.
	 */
	getEditorInputSerializer(editorInput: IEditorInput): IEditorInputSerializer | undefined;
	getEditorInputSerializer(editorInputTypeId: string): IEditorInputSerializer | undefined;

	/**
	 * Starts the registry by providing the required services.
	 */
	start(accessor: ServicesAccessor): void;
}

export interface IEditorInputSerializer {

	/**
	 * Determines whether the given editor input can be serialized by the serializer.
	 */
	canSerialize(editorInput: IEditorInput): boolean;

	/**
	 * Returns a string representation of the provided editor input that contains enough information
	 * to deserialize back to the original editor input from the deserialize() method.
	 */
	serialize(editorInput: IEditorInput): string | undefined;

	/**
	 * Returns an editor input from the provided serialized form of the editor input. This form matches
	 * the value returned from the serialize() method.
	 */
	deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): IEditorInput | undefined;
}

export interface IUntitledTextResourceEditorInput extends IBaseTextResourceEditorInput {

	/**
	 * Optional resource. If the resource is not provided a new untitled file is created (e.g. Untitled-1).
	 * If the used scheme for the resource is not `untitled://`, `forceUntitled: true` must be configured to
	 * force use the provided resource as associated path. As such, the resource will be used when saving
	 * the untitled editor.
	 */
	readonly resource?: URI;
}

export interface IResourceDiffEditorInput extends IBaseResourceEditorInput {

	/**
	 * The left hand side editor to open inside a diff editor.
	 */
	readonly originalInput: IResourceEditorInput | ITextResourceEditorInput | IUntitledTextResourceEditorInput;

	/**
	 * The right hand side editor to open inside a diff editor.
	 */
	readonly modifiedInput: IResourceEditorInput | ITextResourceEditorInput | IUntitledTextResourceEditorInput;
}

export const enum Verbosity {
	SHORT,
	MEDIUM,
	LONG
}

export const enum SaveReason {

	/**
	 * Explicit user gesture.
	 */
	EXPLICIT = 1,

	/**
	 * Auto save after a timeout.
	 */
	AUTO = 2,

	/**
	 * Auto save after editor focus change.
	 */
	FOCUS_CHANGE = 3,

	/**
	 * Auto save after window change.
	 */
	WINDOW_CHANGE = 4
}

export interface ISaveOptions {

	/**
	 * An indicator how the save operation was triggered.
	 */
	reason?: SaveReason;

	/**
	 * Forces to save the contents of the working copy
	 * again even if the working copy is not dirty.
	 */
	readonly force?: boolean;

	/**
	 * Instructs the save operation to skip any save participants.
	 */
	readonly skipSaveParticipants?: boolean;

	/**
	 * A hint as to which file systems should be available for saving.
	 */
	readonly availableFileSystems?: string[];
}

export interface IRevertOptions {

	/**
	 * Forces to load the contents of the working copy
	 * again even if the working copy is not dirty.
	 */
	readonly force?: boolean;

	/**
	 * A soft revert will clear dirty state of a working copy
	 * but will not attempt to load it from its persisted state.
	 *
	 * This option may be used in scenarios where an editor is
	 * closed and where we do not require to load the contents.
	 */
	readonly soft?: boolean;
}

export interface IMoveResult {
	editor: IEditorInput | IResourceEditorInputType;
	options?: IEditorOptions;
}

export const enum EditorInputCapabilities {

	/**
	 * Signals no specific capability for the input.
	 */
	None = 0,

	/**
	 * Signals that the input is readonly.
	 */
	Readonly = 1 << 1,

	/**
	 * Signals that the input is untitled.
	 */
	Untitled = 1 << 2,

	/**
	 * Signals that the input can only be shown in one group
	 * and not be split into multiple groups.
	 */
	Singleton = 1 << 3,

	/**
	 * Signals that the input requires workspace trust.
	 */
	RequiresTrust = 1 << 4,
}

export interface IEditorInput extends IDisposable {

	/**
	 * Triggered when this input is about to be disposed.
	 */
	readonly onWillDispose: Event<void>;

	/**
	 * Triggered when this input changes its dirty state.
	 */
	readonly onDidChangeDirty: Event<void>;

	/**
	 * Triggered when this input changes its label
	 */
	readonly onDidChangeLabel: Event<void>;

	/**
	 * Triggered when this input changes its capabilities.
	 */
	readonly onDidChangeCapabilities: Event<void>;

	/**
	 * Unique type identifier for this input. Every editor input of the
	 * same class should share the same type identifier. The type identifier
	 * is used for example for serialising/deserialising editor inputs
	 * via the serialisers of the `IEditorInputFactoryRegistry`.
	 */
	readonly typeId: string;

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
	readonly resource: URI | undefined;

	/**
	 * The capabilities of the input.
	 */
	readonly capabilities: EditorInputCapabilities;

	/**
	 * Figure out if the input has the provided capability.
	 */
	hasCapability(capability: EditorInputCapabilities): boolean;

	/**
	 * Returns the display name of this input.
	 */
	getName(): string;

	/**
	 * Returns the display description of this input.
	 */
	getDescription(verbosity?: Verbosity): string | undefined;

	/**
	 * Returns the display title of this input.
	 */
	getTitle(verbosity?: Verbosity): string | undefined;

	/**
	 * Returns the aria label to be read out by a screen reader.
	 */
	getAriaLabel(): string;

	/**
	 * Returns a type of `IEditorModel` that represents the resolved input.
	 * Subclasses should override to provide a meaningful model or return
	 * `null` if the editor does not require a model.
	 */
	resolve(): Promise<IEditorModel | null>;

	/**
	 * Returns if this input is dirty or not.
	 */
	isDirty(): boolean;

	/**
	 * Returns if this input is currently being saved or soon to be
	 * saved. Based on this assumption the editor may for example
	 * decide to not signal the dirty state to the user assuming that
	 * the save is scheduled to happen anyway.
	 */
	isSaving(): boolean;

	/**
	 * Saves the editor. The provided groupId helps implementors
	 * to e.g. preserve view state of the editor and re-open it
	 * in the correct group after saving.
	 *
	 * @returns the resulting editor input (typically the same) of
	 * this operation or `undefined` to indicate that the operation
	 * failed or was canceled.
	 */
	save(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined>;

	/**
	 * Saves the editor to a different location. The provided `group`
	 * helps implementors to e.g. preserve view state of the editor
	 * and re-open it in the correct group after saving.
	 *
	 * @returns the resulting editor input (typically a different one)
	 * of this operation or `undefined` to indicate that the operation
	 * failed or was canceled.
	 */
	saveAs(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined>;

	/**
	 * Reverts this input from the provided group.
	 */
	revert(group: GroupIdentifier, options?: IRevertOptions): Promise<void>;

	/**
	 * Called to determine how to handle a resource that is renamed that matches
	 * the editors resource (or is a child of).
	 *
	 * Implementors are free to not implement this method to signal no intent
	 * to participate. If an editor is returned though, it will replace the
	 * current one with that editor and optional options.
	 */
	rename(group: GroupIdentifier, target: URI): IMoveResult | undefined;

	/**
	 * Returns a copy of the current editor input. Used when we can't just reuse the input
	 */
	copy(): IEditorInput;

	/**
	 * Returns a representation of this typed editor input as untyped
	 * resource editor input that e.g. can be used to serialize the
	 * editor input into a form that it can be restored.
	 *
	 * May return `undefined` if a untyped representatin is not supported.
	 */
	asResourceEditorInput(groupId: GroupIdentifier): IBaseResourceEditorInput | undefined;

	/**
	 * Returns if the other object matches this input.
	 */
	matches(other: unknown): boolean;

	/**
	 * Returns if this editor is disposed.
	 */
	isDisposed(): boolean;
}

export interface IEditorInputWithPreferredResource {

	/**
	 * An editor may provide an additional preferred resource alongside
	 * the `resource` property. While the `resource` property serves as
	 * unique identifier of the editor that should be used whenever we
	 * compare to other editors, the `preferredResource` should be used
	 * in places where e.g. the resource is shown to the user.
	 *
	 * For example: on Windows and macOS, the same URI with different
	 * casing may point to the same file. The editor may chose to
	 * "normalize" the URIs so that only one editor opens for different
	 * URIs. But when displaying the editor label to the user, the
	 * preferred URI should be used.
	 *
	 * Not all editors have a `preferredResouce`. The `EditorResourceAccessor`
	 * utility can be used to always get the right resource without having
	 * to do instanceof checks.
	 */
	readonly preferredResource: URI;
}

export function isEditorInputWithPreferredResource(obj: unknown): obj is IEditorInputWithPreferredResource {
	const editorInputWithPreferredResource = obj as IEditorInputWithPreferredResource | undefined;
	if (!editorInputWithPreferredResource) {
		return false;
	}

	return URI.isUri(editorInputWithPreferredResource.preferredResource);
}

export interface ISideBySideEditorInput extends IEditorInput {

	/**
	 * The primary editor input is shown on the right hand side.
	 */
	primary: IEditorInput;

	/**
	 * The secondary editor input is shown on the left hand side.
	 */
	secondary: IEditorInput;
}

function isSideBySideEditorInput(obj: unknown): obj is ISideBySideEditorInput {
	const sideBySideEditorInput = obj as ISideBySideEditorInput | undefined;
	if (!sideBySideEditorInput) {
		return false;
	}

	return !!sideBySideEditorInput.primary && !!sideBySideEditorInput.secondary;
}

/**
 * This is a tagging interface to declare an editor input being capable of dealing with files. It is only used in the editor registry
 * to register this kind of input to the platform.
 */
export interface IFileEditorInput extends IEditorInput, IEncodingSupport, IModeSupport, IEditorInputWithPreferredResource {

	/**
	 * Gets the resource this file input is about. This will always be the
	 * canonical form of the resource, so it may differ from the original
	 * resource that was provided to create the input. Use `preferredResource`
	 * for the form as it was created.
	 */
	readonly resource: URI;

	/**
	 * Sets the preferred resource to use for this file input.
	 */
	setPreferredResource(preferredResource: URI): void;

	/**
	 * Sets the preferred name to use for this file input.
	 *
	 * Note: for certain file schemes the input may decide to ignore this
	 * name and use our standard naming. Specifically for schemes we own,
	 * we do not let others override the name.
	 */
	setPreferredName(name: string): void;

	/**
	 * Sets the preferred description to use for this file input.
	 *
	 * Note: for certain file schemes the input may decide to ignore this
	 * description and use our standard naming. Specifically for schemes we own,
	 * we do not let others override the description.
	 */
	setPreferredDescription(description: string): void;

	/**
	 * Sets the preferred encoding to use for this file input.
	 */
	setPreferredEncoding(encoding: string): void;

	/**
	 * Sets the preferred language mode to use for this file input.
	 */
	setPreferredMode(mode: string): void;

	/**
	 * Sets the preferred contents to use for this file input.
	 */
	setPreferredContents(contents: string): void;

	/**
	 * Forces this file input to open as binary instead of text.
	 */
	setForceOpenAsBinary(): void;

	/**
	 * Figure out if the file input has been resolved or not.
	 */
	isResolved(): boolean;
}

export interface IEditorInputWithOptions {
	editor: IEditorInput;
	options?: IEditorOptions;
}

export interface IEditorInputWithOptionsAndGroup extends IEditorInputWithOptions {
	group?: IEditorGroup;
}

export function isEditorInputWithOptions(obj: unknown): obj is IEditorInputWithOptions {
	const editorInputWithOptions = obj as IEditorInputWithOptions;

	return !!editorInputWithOptions && !!editorInputWithOptions.editor;
}

/**
 * Context passed into `EditorPane#setInput` to give additional
 * context information around why the editor was opened.
 */
export interface IEditorOpenContext {

	/**
	 * An indicator if the editor input is new for the group the editor is in.
	 * An editor is new for a group if it was not part of the group before and
	 * otherwise was already opened in the group and just became the active editor.
	 *
	 * This hint can e.g. be used to decide whether to restore view state or not.
	 */
	newInGroup?: boolean;
}

export interface IEditorIdentifier {
	groupId: GroupIdentifier;
	editor: IEditorInput;
}

export function isEditorIdentifier(thing: unknown): thing is IEditorIdentifier {
	const identifier = thing as IEditorIdentifier | undefined;
	if (!identifier) {
		return false;
	}

	return typeof identifier.groupId === 'number' && !isUndefinedOrNull(identifier.editor);
}

/**
 * The editor commands context is used for editor commands (e.g. in the editor title)
 * and we must ensure that the context is serializable because it potentially travels
 * to the extension host!
 */
export interface IEditorCommandsContext {
	groupId: GroupIdentifier;
	editorIndex?: number;
}

export interface IEditorCloseEvent extends IEditorIdentifier {
	replaced: boolean;
	index: number;
	sticky: boolean;
}

export interface IEditorMoveEvent extends IEditorIdentifier {
	target: GroupIdentifier;
}

export interface IEditorOpenEvent extends IEditorIdentifier { }

export type GroupIdentifier = number;

export interface IWorkbenchEditorConfiguration {
	workbench?: {
		editor?: IEditorPartConfiguration,
		iconTheme?: string;
	};
}

interface IEditorPartConfiguration {
	showTabs?: boolean;
	wrapTabs?: boolean;
	scrollToSwitchTabs?: boolean;
	highlightModifiedTabs?: boolean;
	tabCloseButton?: 'left' | 'right' | 'off';
	tabSizing?: 'fit' | 'shrink';
	pinnedTabSizing?: 'normal' | 'compact' | 'shrink';
	titleScrollbarSizing?: 'default' | 'large';
	focusRecentEditorAfterClose?: boolean;
	showIcons?: boolean;
	enablePreview?: boolean;
	enablePreviewFromQuickOpen?: boolean;
	enablePreviewFromCodeNavigation?: boolean;
	closeOnFileDelete?: boolean;
	openPositioning?: 'left' | 'right' | 'first' | 'last';
	openSideBySideDirection?: 'right' | 'down';
	closeEmptyGroups?: boolean;
	revealIfOpen?: boolean;
	mouseBackForwardToNavigate?: boolean;
	labelFormat?: 'default' | 'short' | 'medium' | 'long';
	restoreViewState?: boolean;
	splitSizing?: 'split' | 'distribute';
	splitOnDragAndDrop?: boolean;
	limit?: {
		enabled?: boolean;
		value?: number;
		perEditorGroup?: boolean;
	};
	decorations?: {
		badges?: boolean;
		colors?: boolean;
	}
}

export interface IEditorPartOptions extends IEditorPartConfiguration {
	hasIcons?: boolean;
}

export interface IEditorPartOptionsChangeEvent {
	oldPartOptions: IEditorPartOptions;
	newPartOptions: IEditorPartOptions;
}

export enum SideBySideEditor {
	PRIMARY = 1,
	SECONDARY = 2,
	BOTH = 3
}

export interface IEditorResourceAccessorOptions {

	/**
	 * Allows to access the `resource(s)` of side by side editors. If not
	 * specified, a `resource` for a side by side editor will always be
	 * `undefined`.
	 */
	supportSideBySide?: SideBySideEditor;

	/**
	 * Allows to filter the scheme to consider. A resource scheme that does
	 * not match a filter will not be considered.
	 */
	filterByScheme?: string | string[];
}

class EditorResourceAccessorImpl {

	/**
	 * The original URI of an editor is the URI that was used originally to open
	 * the editor and should be used whenever the URI is presented to the user,
	 * e.g. as a label together with utility methods such as `ResourceLabel` or
	 * `ILabelService` that can turn this original URI into the best form for
	 * presenting.
	 *
	 * In contrast, the canonical URI (#getCanonicalUri) may be different and should
	 * be used whenever the URI is used to e.g. compare with other editors or when
	 * caching certain data based on the URI.
	 *
	 * For example: on Windows and macOS, the same file URI with different casing may
	 * point to the same file. The editor may chose to "normalize" the URI into a canonical
	 * form so that only one editor opens for same file URIs with different casing. As
	 * such, the original URI and the canonical URI can be different.
	 */
	getOriginalUri(editor: IEditorInput | undefined | null): URI | undefined;
	getOriginalUri(editor: IEditorInput | undefined | null, options: IEditorResourceAccessorOptions & { supportSideBySide?: SideBySideEditor.PRIMARY | SideBySideEditor.SECONDARY }): URI | undefined;
	getOriginalUri(editor: IEditorInput | undefined | null, options: IEditorResourceAccessorOptions & { supportSideBySide: SideBySideEditor.BOTH }): URI | { primary?: URI, secondary?: URI } | undefined;
	getOriginalUri(editor: IEditorInput | undefined | null, options?: IEditorResourceAccessorOptions): URI | { primary?: URI, secondary?: URI } | undefined {
		if (!editor) {
			return undefined;
		}

		// Optionally support side-by-side editors
		if (options?.supportSideBySide && isSideBySideEditorInput(editor)) {
			if (options?.supportSideBySide === SideBySideEditor.BOTH) {
				return {
					primary: this.getOriginalUri(editor.primary, { filterByScheme: options.filterByScheme }),
					secondary: this.getOriginalUri(editor.secondary, { filterByScheme: options.filterByScheme })
				};
			}

			editor = options.supportSideBySide === SideBySideEditor.PRIMARY ? editor.primary : editor.secondary;
		}

		// Original URI is the `preferredResource` of an editor if any
		const originalResource = isEditorInputWithPreferredResource(editor) ? editor.preferredResource : editor.resource;
		if (!originalResource || !options || !options.filterByScheme) {
			return originalResource;
		}

		return this.filterUri(originalResource, options.filterByScheme);
	}

	/**
	 * The canonical URI of an editor is the true unique identifier of the editor
	 * and should be used whenever the URI is used e.g. to compare with other
	 * editors or when caching certain data based on the URI.
	 *
	 * In contrast, the original URI (#getOriginalUri) may be different and should
	 * be used whenever the URI is presented to the user, e.g. as a label.
	 *
	 * For example: on Windows and macOS, the same file URI with different casing may
	 * point to the same file. The editor may chose to "normalize" the URI into a canonical
	 * form so that only one editor opens for same file URIs with different casing. As
	 * such, the original URI and the canonical URI can be different.
	 */
	getCanonicalUri(editor: IEditorInput | undefined | null): URI | undefined;
	getCanonicalUri(editor: IEditorInput | undefined | null, options: IEditorResourceAccessorOptions & { supportSideBySide?: SideBySideEditor.PRIMARY | SideBySideEditor.SECONDARY }): URI | undefined;
	getCanonicalUri(editor: IEditorInput | undefined | null, options: IEditorResourceAccessorOptions & { supportSideBySide: SideBySideEditor.BOTH }): URI | { primary?: URI, secondary?: URI } | undefined;
	getCanonicalUri(editor: IEditorInput | undefined | null, options?: IEditorResourceAccessorOptions): URI | { primary?: URI, secondary?: URI } | undefined {
		if (!editor) {
			return undefined;
		}

		// Optionally support side-by-side editors
		if (options?.supportSideBySide && isSideBySideEditorInput(editor)) {
			if (options?.supportSideBySide === SideBySideEditor.BOTH) {
				return {
					primary: this.getCanonicalUri(editor.primary, { filterByScheme: options.filterByScheme }),
					secondary: this.getCanonicalUri(editor.secondary, { filterByScheme: options.filterByScheme })
				};
			}

			editor = options.supportSideBySide === SideBySideEditor.PRIMARY ? editor.primary : editor.secondary;
		}

		// Canonical URI is the `resource` of an editor
		const canonicalResource = editor.resource;
		if (!canonicalResource || !options || !options.filterByScheme) {
			return canonicalResource;
		}

		return this.filterUri(canonicalResource, options.filterByScheme);
	}

	private filterUri(resource: URI, filter: string | string[]): URI | undefined {

		// Multiple scheme filter
		if (Array.isArray(filter)) {
			if (filter.some(scheme => resource.scheme === scheme)) {
				return resource;
			}
		}

		// Single scheme filter
		else {
			if (filter === resource.scheme) {
				return resource;
			}
		}

		return undefined;
	}
}

export const EditorResourceAccessor = new EditorResourceAccessorImpl();

export const enum CloseDirection {
	LEFT,
	RIGHT
}

export interface IEditorMemento<T> {

	saveEditorState(group: IEditorGroup, resource: URI, state: T): void;
	saveEditorState(group: IEditorGroup, editor: IEditorInput, state: T): void;

	loadEditorState(group: IEditorGroup, resource: URI): T | undefined;
	loadEditorState(group: IEditorGroup, editor: IEditorInput): T | undefined;

	clearEditorState(resource: URI, group?: IEditorGroup): void;
	clearEditorState(editor: IEditorInput, group?: IEditorGroup): void;

	clearEditorStateOnDispose(resource: URI, editor: IEditorInput): void;

	moveEditorState(source: URI, target: URI, comparer: IExtUri): void;
}

class EditorInputFactoryRegistry implements IEditorInputFactoryRegistry {
	private instantiationService: IInstantiationService | undefined;

	private fileEditorInputFactory: IFileEditorInputFactory | undefined;

	private readonly editorInputSerializerConstructors: Map<string /* Type ID */, IConstructorSignature0<IEditorInputSerializer>> = new Map();
	private readonly editorInputSerializerInstances: Map<string /* Type ID */, IEditorInputSerializer> = new Map();

	start(accessor: ServicesAccessor): void {
		const instantiationService = this.instantiationService = accessor.get(IInstantiationService);

		for (const [key, ctor] of this.editorInputSerializerConstructors) {
			this.createEditorInputSerializer(key, ctor, instantiationService);
		}

		this.editorInputSerializerConstructors.clear();
	}

	private createEditorInputSerializer(editorInputTypeId: string, ctor: IConstructorSignature0<IEditorInputSerializer>, instantiationService: IInstantiationService): void {
		const instance = instantiationService.createInstance(ctor);
		this.editorInputSerializerInstances.set(editorInputTypeId, instance);
	}

	registerFileEditorInputFactory(factory: IFileEditorInputFactory): void {
		if (this.fileEditorInputFactory) {
			throw new Error('Can only register one file editor input factory.');
		}

		this.fileEditorInputFactory = factory;
	}

	getFileEditorInputFactory(): IFileEditorInputFactory {
		return assertIsDefined(this.fileEditorInputFactory);
	}

	registerEditorInputSerializer(editorInputTypeId: string, ctor: IConstructorSignature0<IEditorInputSerializer>): IDisposable {
		if (this.editorInputSerializerConstructors.has(editorInputTypeId) || this.editorInputSerializerInstances.has(editorInputTypeId)) {
			throw new Error(`A editor input serializer with type ID '${editorInputTypeId}' was already registered.`);
		}

		if (!this.instantiationService) {
			this.editorInputSerializerConstructors.set(editorInputTypeId, ctor);
		} else {
			this.createEditorInputSerializer(editorInputTypeId, ctor, this.instantiationService);
		}

		return toDisposable(() => {
			this.editorInputSerializerConstructors.delete(editorInputTypeId);
			this.editorInputSerializerInstances.delete(editorInputTypeId);
		});
	}

	getEditorInputSerializer(editorInput: IEditorInput): IEditorInputSerializer | undefined;
	getEditorInputSerializer(editorInputTypeId: string): IEditorInputSerializer | undefined;
	getEditorInputSerializer(arg1: string | IEditorInput): IEditorInputSerializer | undefined {
		return this.editorInputSerializerInstances.get(typeof arg1 === 'string' ? arg1 : arg1.typeId);
	}
}

Registry.add(EditorExtensions.EditorInputFactories, new EditorInputFactoryRegistry());

export async function pathsToEditors(paths: IPathData[] | undefined, fileService: IFileService): Promise<(IResourceEditorInput | IUntitledTextResourceEditorInput)[]> {
	if (!paths || !paths.length) {
		return [];
	}

	const editors = await Promise.all(paths.map(async path => {
		const resource = URI.revive(path.fileUri);
		if (!resource || !fileService.canHandleResource(resource)) {
			return undefined; // {{SQL CARBON EDIT}} @anthonydresser strict-null-checks
		}

		const exists = (typeof path.exists === 'boolean') ? path.exists : await fileService.exists(resource);
		if (!exists && path.openOnlyIfExists) {
			return undefined; // {{SQL CARBON EDIT}} @anthonydresser strict-null-checks
		}

		const options: ITextEditorOptions = (exists && typeof path.lineNumber === 'number') ? {
			selection: {
				startLineNumber: path.lineNumber,
				startColumn: path.columnNumber || 1
			},
			pinned: true,
			override: path.editorOverrideId
		} : {
			pinned: true,
			override: path.editorOverrideId
		};

		let input: IResourceEditorInput | IUntitledTextResourceEditorInput;
		if (!exists) {
			input = { resource, options, forceUntitled: true };
		} else {
			input = { resource, options, forceFile: true };
		}

		return input;
	}));

	return coalesce(editors);
}

export const enum EditorsOrder {

	/**
	 * Editors sorted by most recent activity (most recent active first)
	 */
	MOST_RECENTLY_ACTIVE,

	/**
	 * Editors sorted by sequential order
	 */
	SEQUENTIAL
}

/**
 * A way to address editor groups through a column based system
 * where `0` is the first column. Will fallback to `SIDE_GROUP`
 * in case the column does not exist yet.
 */
export type EditorGroupColumn = number;

export function viewColumnToEditorGroup(editorGroupService: IEditorGroupsService, viewColumn?: EditorGroupColumn): GroupIdentifier {
	if (typeof viewColumn !== 'number' || viewColumn === ACTIVE_GROUP) {
		return ACTIVE_GROUP; // prefer active group when position is undefined or passed in as such
	}

	const groups = editorGroupService.getGroups(GroupsOrder.GRID_APPEARANCE);

	let candidateGroup = groups[viewColumn];
	if (candidateGroup) {
		return candidateGroup.id; // found direct match
	}

	let firstGroup = groups[0];
	if (groups.length === 1 && firstGroup.count === 0) {
		return firstGroup.id; // first editor should always open in first group independent from position provided
	}

	return SIDE_GROUP; // open to the side if group not found or we are instructed to
}

export function editorGroupToViewColumn(editorGroupService: IEditorGroupsService, editorGroup: IEditorGroup | GroupIdentifier): EditorGroupColumn {
	let group = (typeof editorGroup === 'number') ? editorGroupService.getGroup(editorGroup) : editorGroup;
	group = group ?? editorGroupService.activeGroup;

	return editorGroupService.getGroups(GroupsOrder.GRID_APPEARANCE).indexOf(group);
}
