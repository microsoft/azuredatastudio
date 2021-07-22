/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { URI } from 'vs/base/common/uri';
import { Schemas } from 'vs/base/common/network';
import { GroupIdentifier, IEditorInput, IEditorInputWithPreferredResource, Verbosity, IFileEditorInput, IMoveResult, isTextEditorPane } from 'vs/workbench/common/editor';
import { IUntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';
import { EncodingMode, IEncodingSupport, IModeSupport, ITextFileService, ITextFileSaveOptions, TextFileEditorModelState, TextFileResolveReason, TextFileOperationError, TextFileOperationResult, ITextFileEditorModel, } from 'vs/workbench/services/textfile/common/textfiles';
import { ILabelService } from 'vs/platform/label/common/label';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IFileService, FileOperationError, FileOperationResult } from 'vs/platform/files/common/files';
import { IFilesConfigurationService } from 'vs/workbench/services/filesConfiguration/common/filesConfigurationService';
import { isEqual } from 'vs/base/common/resources';
import { BinaryEditorModel } from 'vs/workbench/common/editor/binaryEditorModel';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IReference, dispose, DisposableStore } from 'vs/base/common/lifecycle';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
//import { FILE_EDITOR_INPUT_ID, TEXT_FILE_EDITOR_ID, BINARY_FILE_EDITOR_ID } from 'vs/workbench/contrib/files/common/files';
//import { Event } from 'vs/base/common/event';
import { IEditorViewState } from 'vs/editor/common/editorCommon';
//import { decorateFileEditorLabel } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';

import { AbstractTextResourceEditorInput } from 'vs/workbench/common/editor/textResourceEditorInput';

const enum ForceOpenAs {
	None,
	Text,
	Binary
}

export abstract class QueryTextEditorInput extends AbstractTextResourceEditorInput implements IEditorInputWithPreferredResource {
	override save(group: GroupIdentifier, options?: ITextFileSaveOptions, resultsVisible?: boolean): Promise<IEditorInput | undefined> {

		// If this is neither an `untitled` resource, nor a resource
		// we can handle with the file service, we can only "Save As..."
		if (this.resource.scheme !== Schemas.untitled && !this.fileService.canHandleResource(this.resource)) {
			return this.saveAs(group, options, resultsVisible);
		}

		// Normal save
		return this.doSaveQuery(options, false, resultsVisible);
	}

	override saveAs(group: GroupIdentifier, options?: ITextFileSaveOptions, resultsVisible?: boolean): Promise<IEditorInput | undefined> {
		return this.doSaveQuery(options, true, resultsVisible);
	}

	private async doSaveQuery(options: ITextFileSaveOptions | undefined, saveAs: boolean, resultsVisible?: boolean): Promise<IEditorInput | undefined> {

		// Save / Save As
		let target: URI | undefined;
		if (saveAs) {
			target = await this.textFileService.saveAs(this.resource, undefined, { ...options, suggestedTarget: this.preferredResource });
		} else {
			target = await this.textFileService.save(this.resource, options);
		}

		if (!target) {
			return undefined; // save cancelled
		}

		// If this save operation results in a new editor, either
		// because it was saved to disk (e.g. from untitled) or
		// through an explicit "Save As", make sure to replace it.
		if (
			target.scheme !== this.resource.scheme ||
			(saveAs && !isEqual(target, this.preferredResource))
		) {
			let result = this.editorService.createEditorInput({ resource: target });
			result['resultsVisible'] = resultsVisible;
			return result;
		}

		return this;
	}
	// {{SQL CARBON EDIT}} - End
}

/**
 * An editor input to be used for untitled query text buffers. Based on UntitledTextEditorInput but extending QueryTextEditorInput.
 */
export class UntitledQueryTextEditorInput extends QueryTextEditorInput implements IEncodingSupport, IModeSupport {

	static readonly ID: string = 'workbench.editors.untitledEditorInput';

	override get typeId(): string {
		return UntitledQueryTextEditorInput.ID;
	}

	private modelResolve: Promise<void> | undefined = undefined;

	constructor(
		public readonly model: IUntitledTextEditorModel,
		@ITextFileService textFileService: ITextFileService,
		@ILabelService labelService: ILabelService,
		@IEditorService editorService: IEditorService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService,
		@IFileService fileService: IFileService,
		@IFilesConfigurationService filesConfigurationService: IFilesConfigurationService
	) {
		super(model.resource, undefined, editorService, editorGroupService, textFileService, labelService, fileService, filesConfigurationService);

		this.registerModelListeners(model);
	}

	private registerModelListeners(model: IUntitledTextEditorModel): void {

		// re-emit some events from the model
		this._register(model.onDidChangeDirty(() => this._onDidChangeDirty.fire()));
		this._register(model.onDidChangeName(() => this._onDidChangeLabel.fire()));

		// a reverted untitled text editor model renders this input disposed
		this._register(model.onDidRevert(() => this.dispose()));
	}

	override getName(): string {
		return this.model.name;
	}

	override getDescription(verbosity: Verbosity = Verbosity.MEDIUM): string | undefined {

		// Without associated path: only use if name and description differ
		if (!this.model.hasAssociatedFilePath) {
			const descriptionCandidate = this.resource.path;
			if (descriptionCandidate !== this.getName()) {
				return descriptionCandidate;
			}

			return undefined;
		}

		// With associated path: delegate to parent
		return super.getDescription(verbosity);
	}

	override getTitle(verbosity: Verbosity): string {

		// Without associated path: check if name and description differ to decide
		// if description should appear besides the name to distinguish better
		if (!this.model.hasAssociatedFilePath) {
			const name = this.getName();
			const description = this.getDescription();
			if (description && description !== name) {
				return `${name} • ${description}`;
			}

			return name;
		}

		// With associated path: delegate to parent
		return super.getTitle(verbosity);
	}

	override isDirty(): boolean {
		return this.model.isDirty();
	}

	getEncoding(): string | undefined {
		return this.model.getEncoding();
	}

	setEncoding(encoding: string, mode: EncodingMode /* ignored, we only have Encode */): Promise<void> {
		return this.model.setEncoding(encoding);
	}

	setMode(mode: string): void {
		this.model.setMode(mode);
	}

	getMode(): string | undefined {
		return this.model.getMode();
	}

	override async resolve(): Promise<IUntitledTextEditorModel> {
		if (!this.modelResolve) {
			this.modelResolve = this.model.resolve();
		}

		await this.modelResolve;

		return this.model;
	}

	override matches(otherInput: unknown): boolean {
		if (otherInput === this) {
			return true;
		}

		if (otherInput instanceof UntitledQueryTextEditorInput) {
			return isEqual(otherInput.resource, this.resource);
		}

		return false;
	}

	override dispose(): void {
		this.modelResolve = undefined;

		super.dispose();
	}
}

/**
 * A file query text editor input is the input type for the query file editor of file system resources. Based on FileEditorInput but extending QueryTextEditorInput.
 */
export class FileQueryTextEditorInput extends QueryTextEditorInput implements IFileEditorInput {

	override get typeId(): string {
		//return FILE_EDITOR_INPUT_ID;
		return '';
	}

	private preferredName: string | undefined;
	private preferredDescription: string | undefined;
	private preferredEncoding: string | undefined;
	private preferredMode: string | undefined;

	private forceOpenAs: ForceOpenAs = ForceOpenAs.None;

	private model: ITextFileEditorModel | undefined = undefined;
	private cachedTextFileModelReference: IReference<ITextFileEditorModel> | undefined = undefined;

	private readonly modelListeners = this._register(new DisposableStore());

	constructor(
		resource: URI,
		preferredResource: URI | undefined,
		preferredName: string | undefined,
		preferredDescription: string | undefined,
		preferredEncoding: string | undefined,
		preferredMode: string | undefined,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ITextFileService textFileService: ITextFileService,
		@ITextModelService private readonly textModelResolverService: ITextModelService,
		@ILabelService labelService: ILabelService,
		@IFileService fileService: IFileService,
		@IFilesConfigurationService filesConfigurationService: IFilesConfigurationService,
		@IEditorService editorService: IEditorService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService
	) {
		super(resource, preferredResource, editorService, editorGroupService, textFileService, labelService, fileService, filesConfigurationService);

		this.model = this.textFileService.files.get(resource);

		if (preferredName) {
			this.setPreferredName(preferredName);
		}

		if (preferredDescription) {
			this.setPreferredDescription(preferredDescription);
		}

		if (preferredEncoding) {
			this.setPreferredEncoding(preferredEncoding);
		}

		if (preferredMode) {
			this.setPreferredMode(preferredMode);
		}

		// If a file model already exists, make sure to wire it in
		if (this.model) {
			this.registerModelListeners(this.model);
		}
	}

	protected override registerListeners(): void {
		super.registerListeners();

		// Attach to model that matches our resource once created
		this._register(this.textFileService.files.onDidCreate(model => this.onDidCreateTextFileModel(model)));
	}

	private onDidCreateTextFileModel(model: ITextFileEditorModel): void {

		// Once the text file model is created, we keep it inside
		// the input to be able to implement some methods properly
		if (isEqual(model.resource, this.resource)) {
			this.model = model;

			this.registerModelListeners(model);
		}
	}

	private registerModelListeners(model: ITextFileEditorModel): void {

		// Clear any old
		this.modelListeners.clear();

		// re-emit some events from the model
		this.modelListeners.add(model.onDidChangeDirty(() => this._onDidChangeDirty.fire()));
		this.modelListeners.add(model.onDidChangeOrphaned(() => this._onDidChangeLabel.fire()));

		// important: treat save errors as potential dirty change because
		// a file that is in save conflict or error will report dirty even
		// if auto save is turned on.
		this.modelListeners.add(model.onDidSaveError(() => this._onDidChangeDirty.fire()));

		// remove model association once it gets disposed
		// this.modelListeners.add(Event.once(model.onWillDispose)(() => {
		// 	this.modelListeners.clear();
		// 	this.model = undefined;
		// }));
	}

	override getName(): string {
		return this.preferredName || this.decorateLabel(super.getName());
	}

	setPreferredName(name: string): void {
		if (!this.allowLabelOverride()) {
			return; // block for specific schemes we own
		}

		if (this.preferredName !== name) {
			this.preferredName = name;

			this._onDidChangeLabel.fire();
		}
	}

	private allowLabelOverride(): boolean {
		return this.resource.scheme !== Schemas.file && this.resource.scheme !== Schemas.vscodeRemote && this.resource.scheme !== Schemas.userData;
	}

	getPreferredName(): string | undefined {
		return this.preferredName;
	}

	override getDescription(verbosity?: Verbosity): string | undefined {
		return this.preferredDescription || super.getDescription(verbosity);
	}

	setPreferredDescription(description: string): void {
		if (!this.allowLabelOverride()) {
			return; // block for specific schemes we own
		}

		if (this.preferredDescription !== description) {
			this.preferredDescription = description;

			this._onDidChangeLabel.fire();
		}
	}

	getPreferredDescription(): string | undefined {
		return this.preferredDescription;
	}

	override getTitle(verbosity: Verbosity): string {
		switch (verbosity) {
			case Verbosity.SHORT:
				return this.decorateLabel(super.getName());
			case Verbosity.MEDIUM:
			case Verbosity.LONG:
				return this.decorateLabel(super.getTitle(verbosity));
		}
	}

	private decorateLabel(label: string): string {
		// const orphaned = this.model?.hasState(TextFileEditorModelState.ORPHAN);
		// const readonly = this.isReadonly();
		//return decorateFileEditorLabel(label, { orphaned: !!orphaned, readonly });
		return '';
	}

	getEncoding(): string | undefined {
		if (this.model) {
			return this.model.getEncoding();
		}

		return this.preferredEncoding;
	}

	getPreferredEncoding(): string | undefined {
		return this.preferredEncoding;
	}

	async setEncoding(encoding: string, mode: EncodingMode): Promise<void> {
		this.setPreferredEncoding(encoding);

		return this.model?.setEncoding(encoding, mode);
	}

	setPreferredEncoding(encoding: string): void {
		this.preferredEncoding = encoding;

		// encoding is a good hint to open the file as text
		this.setForceOpenAsText();
	}

	getPreferredMode(): string | undefined {
		return this.preferredMode;
	}

	setMode(mode: string): void {
		this.setPreferredMode(mode);

		this.model?.setMode(mode);
	}

	setPreferredMode(mode: string): void {
		this.preferredMode = mode;

		// mode is a good hint to open the file as text
		this.setForceOpenAsText();
	}

	setForceOpenAsText(): void {
		this.forceOpenAs = ForceOpenAs.Text;
	}

	setForceOpenAsBinary(): void {
		this.forceOpenAs = ForceOpenAs.Binary;
	}

	override isDirty(): boolean {
		return !!(this.model?.isDirty());
	}

	override isReadonly(): boolean {
		if (this.model) {
			return this.model.isReadonly();
		}

		return super.isReadonly();
	}

	override isSaving(): boolean {
		if (this.model?.hasState(TextFileEditorModelState.SAVED) || this.model?.hasState(TextFileEditorModelState.CONFLICT) || this.model?.hasState(TextFileEditorModelState.ERROR)) {
			return false; // require the model to be dirty and not in conflict or error state
		}

		// Note: currently not checking for ModelState.PENDING_SAVE for a reason
		// because we currently miss an event for this state change on editors
		// and it could result in bad UX where an editor can be closed even though
		// it shows up as dirty and has not finished saving yet.

		return super.isSaving();
	}

	override getPreferredEditorId(candidates: string[]): string {
		//return this.forceOpenAs === ForceOpenAs.Binary ? BINARY_FILE_EDITOR_ID : TEXT_FILE_EDITOR_ID;
		return '';
	}

	override resolve(): Promise<ITextFileEditorModel | BinaryEditorModel> {

		// Resolve as binary
		if (this.forceOpenAs === ForceOpenAs.Binary) {
			return this.doResolveAsBinary();
		}

		// Resolve as text
		return this.doResolveAsText();
	}

	private async doResolveAsText(): Promise<ITextFileEditorModel | BinaryEditorModel> {
		try {

			// Resolve resource via text file service and only allow
			// to open binary files if we are instructed so
			await this.textFileService.files.resolve(this.resource, {
				mode: this.preferredMode,
				encoding: this.preferredEncoding,
				reload: { async: true }, // trigger a reload of the model if it exists already but do not wait to show the model
				allowBinary: this.forceOpenAs === ForceOpenAs.Text,
				reason: TextFileResolveReason.EDITOR
			});

			// This is a bit ugly, because we first resolve the model and then resolve a model reference. the reason being that binary
			// or very large files do not resolve to a text file model but should be opened as binary files without text. First calling into
			// resolve() ensures we are not creating model references for these kind of resources.
			// In addition we have a bit of payload to take into account (encoding, reload) that the text resolver does not handle yet.
			if (!this.cachedTextFileModelReference) {
				this.cachedTextFileModelReference = await this.textModelResolverService.createModelReference(this.resource) as IReference<ITextFileEditorModel>;
			}

			const model = this.cachedTextFileModelReference.object;

			// It is possible that this input was disposed before the model
			// finished resolving. As such, we need to make sure to dispose
			// the model reference to not leak it.
			if (this.isDisposed()) {
				this.disposeModelReference();
			}

			return model;
		} catch (error) {

			// In case of an error that indicates that the file is binary or too large, just return with the binary editor model
			if (
				(<TextFileOperationError>error).textFileOperationResult === TextFileOperationResult.FILE_IS_BINARY ||
				(<FileOperationError>error).fileOperationResult === FileOperationResult.FILE_TOO_LARGE
			) {
				return this.doResolveAsBinary();
			}

			// Bubble any other error up
			throw error;
		}
	}

	private async doResolveAsBinary(): Promise<BinaryEditorModel> {
		const model = this.instantiationService.createInstance(BinaryEditorModel, this.preferredResource, this.getName());
		await model.resolve();

		return model;
	}

	isResolved(): boolean {
		return !!this.model;
	}

	override rename(group: GroupIdentifier, target: URI): IMoveResult {
		return {
			editor: {
				resource: target,
				encoding: this.getEncoding(),
				options: {
					viewState: this.getViewStateFor(group)
				}
			}
		};
	}

	private getViewStateFor(group: GroupIdentifier): IEditorViewState | undefined {
		for (const editorPane of this.editorService.visibleEditorPanes) {
			if (editorPane.group.id === group && this.matches(editorPane.input)) {
				if (isTextEditorPane(editorPane)) {
					return editorPane.getViewState();
				}
			}
		}

		return undefined;
	}

	override matches(otherInput: unknown): boolean {
		if (otherInput === this) {
			return true;
		}

		if (otherInput instanceof FileQueryTextEditorInput) {
			return isEqual(otherInput.resource, this.resource);
		}

		return false;
	}

	override dispose(): void {

		// Model
		this.model = undefined;

		// Model reference
		this.disposeModelReference();

		super.dispose();
	}

	private disposeModelReference(): void {
		dispose(this.cachedTextFileModelReference);
		this.cachedTextFileModelReference = undefined;
	}
}
