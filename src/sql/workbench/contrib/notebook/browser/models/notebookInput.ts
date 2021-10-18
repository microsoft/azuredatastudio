/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IRevertOptions, GroupIdentifier, IEditorInput, EditorInputCapabilities } from 'vs/workbench/common/editor';
import { Emitter, Event } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import * as resources from 'vs/base/common/resources';
import * as azdata from 'azdata';

import { IStandardKernelWithProvider, getProvidersForFileName, getStandardKernelsForProvider } from 'sql/workbench/services/notebook/browser/models/notebookUtils';
import { INotebookService, DEFAULT_NOTEBOOK_PROVIDER, IProviderInfo } from 'sql/workbench/services/notebook/browser/notebookService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextEditorModel, ITextModelService } from 'vs/editor/common/services/resolverService';
import { INotebookModel, IContentLoader, NotebookContentChange } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { TextFileEditorModel } from 'vs/workbench/services/textfile/common/textFileEditorModel';
import { Schemas } from 'vs/base/common/network';
import { ITextFileSaveOptions, ITextFileEditorModel } from 'vs/workbench/services/textfile/common/textfiles';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IDisposable } from 'vs/base/common/lifecycle';
import { NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { Deferred } from 'sql/base/common/promise';
import { NotebookTextFileModel } from 'sql/workbench/contrib/notebook/browser/models/notebookTextFileModel';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { TextResourceEditorModel } from 'vs/workbench/common/editor/textResourceEditorModel';
import { UntitledTextEditorModel, IUntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { AbstractResourceEditorInput } from 'vs/workbench/common/editor/resourceEditorInput';
import { FileEditorInput } from 'vs/workbench/contrib/files/browser/editors/fileEditorInput';
import { BinaryEditorModel } from 'vs/workbench/common/editor/binaryEditorModel';
import { NotebookFindModel } from 'sql/workbench/contrib/notebook/browser/find/notebookFindModel';
import { onUnexpectedError } from 'vs/base/common/errors';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { INotebookInput } from 'sql/workbench/services/notebook/browser/interface';
import { EditorModel } from 'vs/workbench/common/editor/editorModel';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { LocalContentManager } from 'sql/workbench/services/notebook/common/localContentManager';

export type ModeViewSaveHandler = (handle: number) => Thenable<boolean>;

export class NotebookEditorModel extends EditorModel {
	private _dirty: boolean;
	private _changeEventsHookedUp: boolean = false;
	private _notebookTextFileModel: NotebookTextFileModel;
	private readonly _onDidChangeDirty: Emitter<void> = this._register(new Emitter<void>());
	private _lastEditFullReplacement: boolean;
	private _isFirstKernelChange: boolean = true;
	constructor(public readonly notebookUri: URI,
		private textEditorModel: ITextFileEditorModel | IUntitledTextEditorModel | TextResourceEditorModel,
		@INotebookService private notebookService: INotebookService,
		@ITextResourcePropertiesService private textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super();
		let _eol = this.textResourcePropertiesService.getEOL(URI.from({ scheme: Schemas.untitled }));
		this._notebookTextFileModel = new NotebookTextFileModel(_eol);
		this._register(this.notebookService.onNotebookEditorAdd(notebook => {
			if (notebook.id === this.notebookUri.toString()) {
				// Hook to content change events
				notebook.modelReady.then((model) => {
					if (!this._changeEventsHookedUp) {
						this._changeEventsHookedUp = true;
						this._register(model.kernelChanged(e => this.updateModel(undefined, NotebookChangeType.KernelChanged).catch(e => onUnexpectedError(e))));
						this._register(model.contentChanged(e => this.updateModel(e, e.changeType).catch(e => onUnexpectedError(e))));
						this._register(notebook.model.onActiveCellChanged((cell) => {
							if (cell) {
								this._notebookTextFileModel.activeCellGuid = cell.cellGuid;
							}
						}));
					}
				}, err => undefined);
			}
		}));
		if (this.textEditorModel instanceof UntitledTextEditorModel) {
			this._register(this.textEditorModel.onDidChangeDirty(e => {
				let dirty = this.textEditorModel instanceof TextResourceEditorModel ? false : this.textEditorModel.isDirty();
				this.setDirty(dirty);
			}));
		} else {
			if (this.textEditorModel instanceof TextFileEditorModel) {
				this._register(this.textEditorModel.onDidSave(() => {
					let dirty = this.textEditorModel instanceof TextResourceEditorModel ? false : this.textEditorModel.isDirty();
					this.setDirty(dirty);
					this.sendNotebookSerializationStateChange();
				}));
				this._register(this.textEditorModel.onDidChangeDirty(() => {
					let dirty = this.textEditorModel instanceof TextResourceEditorModel ? false : this.textEditorModel.isDirty();
					this.setDirty(dirty);
				}));
				this._register(this.textEditorModel.onDidResolve(async (e) => {
					if (this.textEditorModel instanceof TextFileEditorModel) {
						let model = this.getNotebookModel() as NotebookModel;
						await model.loadContents(model.trustedMode, true);
					}
				}));
			}
		}
		this._dirty = this.textEditorModel instanceof TextResourceEditorModel ? false : this.textEditorModel.isDirty();
	}

	public get contentString(): string {
		let model = this.textEditorModel.textEditorModel;
		return model.getValue();
	}

	public get lastEditFullReplacement(): boolean {
		return this._lastEditFullReplacement;
	}

	isDirty(): boolean {
		return this.textEditorModel instanceof TextResourceEditorModel ? false : this.textEditorModel.isDirty();
	}

	public setDirty(dirty: boolean): void {
		if (this._dirty === dirty) {
			return;
		}
		this._dirty = dirty;
		this._onDidChangeDirty.fire();
	}

	public async updateModel(contentChange?: NotebookContentChange, type?: NotebookChangeType): Promise<void> {
		// If text editor model is readonly, exit early as no changes need to occur on the model
		// Note: this follows what happens in fileCommands where update/save logic is skipped for readonly text editor models
		if (this.textEditorModel?.isReadonly()) {
			return;
		}
		if (type === NotebookChangeType.KernelChanged && this._isFirstKernelChange) {
			this._isFirstKernelChange = false;
			return;
		}
		if (contentChange?.isDirty === false) {
			return;
		}
		this._lastEditFullReplacement = false;
		if (contentChange && contentChange.changeType === NotebookChangeType.Saved) {
			// We send the saved events out, so ignore. Otherwise we double-count this as a change
			// and cause the text to be reapplied
			return;
		}
		if (contentChange && contentChange.changeType === NotebookChangeType.TrustChanged) {
			// This is a serializable change (in that we permanently cache trusted state, but
			// ironically isn't cached in the JSON contents since trust doesn't persist across machines.
			// Request serialization so trusted state is preserved but don't update the model
			this.sendNotebookSerializationStateChange();
		} else {
			let notebookModel = this.getNotebookModel();
			let editAppliedSuccessfully = false;
			if (notebookModel && this.textEditorModel && this.textEditorModel.textEditorModel) {
				if (contentChange && contentChange.cells && contentChange.cells[0]) {
					if (type === NotebookChangeType.CellSourceUpdated) {
						if (this._notebookTextFileModel.transformAndApplyEditForSourceUpdate(contentChange, this.textEditorModel)) {
							editAppliedSuccessfully = true;
						}
					} else if (type === NotebookChangeType.CellOutputUpdated) {
						if (this._notebookTextFileModel.transformAndApplyEditForOutputUpdate(contentChange, this.textEditorModel)) {
							editAppliedSuccessfully = true;
						}
					} else if (type === NotebookChangeType.CellOutputCleared) {
						if (this._notebookTextFileModel.transformAndApplyEditForClearOutput(contentChange, this.textEditorModel)) {
							editAppliedSuccessfully = true;
						}
					} else if (type === NotebookChangeType.CellExecuted) {
						if (this._notebookTextFileModel.transformAndApplyEditForCellUpdated(contentChange, this.textEditorModel)) {
							editAppliedSuccessfully = true;
						}
					}
				}
				// If edit was already applied, skip replacing entire text model
				if (editAppliedSuccessfully) {
					return;
				}
				await this.replaceEntireTextEditorModel(notebookModel, type);
				this._lastEditFullReplacement = true;
			}
		}
	}

	public replaceEntireTextEditorModel(notebookModel: INotebookModel, type: NotebookChangeType): Promise<void> {
		return this._notebookTextFileModel.replaceEntireTextEditorModel(notebookModel, type, this.textEditorModel);
	}

	private sendNotebookSerializationStateChange(): void {
		let notebookModel = this.getNotebookModel();
		if (notebookModel) {
			this.notebookService.serializeNotebookStateChange(this.notebookUri, NotebookChangeType.Saved)
				.catch(e => onUnexpectedError(e));
		}
	}

	isModelCreated(): boolean {
		return this.getNotebookModel() !== undefined;
	}

	public getNotebookModel(): INotebookModel | undefined {
		let editor = this.notebookService.findNotebookEditor(this.notebookUri);
		if (editor) {
			return editor.model;
		}
		return undefined;
	}

	get onDidChangeDirty(): Event<void> {
		return this._onDidChangeDirty.event;
	}

	get editorModel() {
		return this.textEditorModel;
	}
}

type TextInput = AbstractResourceEditorInput | UntitledTextEditorInput | FileEditorInput;

export abstract class NotebookInput extends EditorInput implements INotebookInput {
	private _providerId: string;
	private _providers: string[];
	private _standardKernels: IStandardKernelWithProvider[];
	private _connectionProfile: IConnectionProfile;
	private _defaultKernel: azdata.nb.IKernelSpec;
	public hasBootstrapped = false;
	// Holds the HTML content for the editor when the editor discards this input and loads another
	private _parentContainer: HTMLElement;
	private readonly _layoutChanged: Emitter<void> = this._register(new Emitter<void>());
	private _model: NotebookEditorModel;
	private _untitledEditorModel: IUntitledTextEditorModel;
	private _contentLoader: IContentLoader;
	private _providersLoaded: Promise<void>;
	private _dirtyListener: IDisposable;
	private _notebookEditorOpenedTimestamp: number;
	private _modelResolveInProgress: boolean = false;
	private _modelResolved: Deferred<void> = new Deferred<void>();
	private _containerResolved: Deferred<void> = new Deferred<void>();

	private _notebookFindModel: NotebookFindModel;

	constructor(private _title: string,
		private _resource: URI,
		private _textInput: TextInput,
		private _showActions: boolean,
		@ITextModelService private textModelService: ITextModelService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@INotebookService private notebookService: INotebookService,
		@IExtensionService private extensionService: IExtensionService
	) {
		super();
		this._standardKernels = [];
		this._providersLoaded = this.assignProviders();
		this._notebookEditorOpenedTimestamp = Date.now();
		if (this._textInput) {
			this.hookDirtyListener(this._textInput.onDidChangeDirty, () => this._onDidChangeDirty.fire());
		}
	}

	public get textInput(): TextInput {
		return this._textInput;
	}

	public override revert(group: GroupIdentifier, options?: IRevertOptions): Promise<void> {
		return this._textInput.revert(group, options);
	}

	public get notebookUri(): URI {
		return this.resource;
	}

	public get notebookModel(): INotebookModel | undefined {
		return this._model.getNotebookModel();
	}

	public get notebookFindModel(): NotebookFindModel {
		if (!this._notebookFindModel) {
			this._notebookFindModel = new NotebookFindModel(this._model.getNotebookModel());
		}
		return this._notebookFindModel;
	}

	public get contentLoader(): IContentLoader {
		if (!this._contentLoader) {
			let contentManager = this.instantiationService.createInstance(LocalContentManager);
			this._contentLoader = this.instantiationService.createInstance(NotebookEditorContentLoader, this, contentManager);
		}
		return this._contentLoader;
	}

	public override getName(): string {
		if (!this._title) {
			this._title = resources.basenameOrAuthority(this.resource);
		}
		return this._title;
	}

	public override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.None;
	}

	public get providersLoaded(): Promise<void> {
		return this._providersLoaded;
	}

	public async getProviderInfo(): Promise<IProviderInfo> {
		await this._providersLoaded;
		return {
			providerId: this._providerId ? this._providerId : DEFAULT_NOTEBOOK_PROVIDER,
			providers: this._providers ? this._providers : [DEFAULT_NOTEBOOK_PROVIDER]
		};
	}

	public set connectionProfile(value: IConnectionProfile) {
		this._connectionProfile = value;
	}

	public get connectionProfile(): IConnectionProfile {
		return this._connectionProfile;
	}

	public get standardKernels(): IStandardKernelWithProvider[] {
		return this._standardKernels;
	}

	override async save(groupId: number, options?: ITextFileSaveOptions): Promise<IEditorInput | undefined> {
		await this.updateModel();
		let input = await this.textInput.save(groupId, options);
		await this.setTrustForNewEditor(input);
		return input;
	}

	override async saveAs(group: number, options?: ITextFileSaveOptions): Promise<IEditorInput | undefined> {
		await this.updateModel();
		let input = await this.textInput.saveAs(group, options);
		await this.setTrustForNewEditor(input);
		return input;
	}

	private async setTrustForNewEditor(newInput: IEditorInput | undefined): Promise<void> {
		let model = this._model.getNotebookModel();
		if (model?.trustedMode && newInput && newInput.resource !== this.resource) {
			await this.notebookService.serializeNotebookStateChange(newInput.resource, NotebookChangeType.Saved, undefined, true);
		}
	}

	public set standardKernels(value: IStandardKernelWithProvider[]) {
		value.forEach(kernel => {
			this._standardKernels.push({
				connectionProviderIds: kernel.connectionProviderIds,
				name: kernel.name,
				displayName: kernel.displayName,
				notebookProvider: kernel.notebookProvider
			});
		});
	}

	public get defaultKernel(): azdata.nb.IKernelSpec {
		return this._defaultKernel;
	}

	public set defaultKernel(kernel: azdata.nb.IKernelSpec) {
		this._defaultKernel = kernel;
	}

	get layoutChanged(): Event<void> {
		return this._layoutChanged.event;
	}

	public get editorOpenedTimestamp(): number {
		return this._notebookEditorOpenedTimestamp;
	}

	doChangeLayout(): any {
		this._layoutChanged.fire();
	}

	get resource(): URI {
		return this._resource;
	}

	public get untitledEditorModel(): IUntitledTextEditorModel {
		return this._untitledEditorModel;
	}

	public set untitledEditorModel(value: IUntitledTextEditorModel) {
		this._untitledEditorModel = value;
	}

	override async resolve(): Promise<NotebookEditorModel> {
		if (!this._modelResolveInProgress) {
			this._modelResolveInProgress = true;
		} else {
			await this._modelResolved;
			return this._model;
		}
		if (this._model) {
			return Promise.resolve(this._model);
		} else {
			let textOrUntitledEditorModel: ITextFileEditorModel | IUntitledTextEditorModel | TextResourceEditorModel;
			if (this.resource.scheme === Schemas.untitled) {
				if (this._untitledEditorModel) {
					this._untitledEditorModel.textEditorModel.onBeforeAttached();
					textOrUntitledEditorModel = this._untitledEditorModel;
				} else {
					let resolvedInput = await this._textInput.resolve();
					if (!(resolvedInput instanceof BinaryEditorModel)) {
						(resolvedInput as ITextEditorModel).textEditorModel.onBeforeAttached();
					}
					textOrUntitledEditorModel = resolvedInput as TextFileEditorModel | UntitledTextEditorModel | TextResourceEditorModel;
				}
			} else {
				const textEditorModelReference = await this.textModelService.createModelReference(this.resource);
				textEditorModelReference.object.textEditorModel.onBeforeAttached();
				await textEditorModelReference.object.resolve();
				textOrUntitledEditorModel = textEditorModelReference.object as TextFileEditorModel | TextResourceEditorModel;
			}
			this._model = this._register(this.instantiationService.createInstance(NotebookEditorModel, this.resource, textOrUntitledEditorModel));
			this.hookDirtyListener(this._model.onDidChangeDirty, () => this._onDidChangeDirty.fire());
			this._modelResolved.resolve();
			return this._model;
		}
	}

	private hookDirtyListener(dirtyEvent: Event<void>, listener: (e: any) => void): void {
		let disposable = dirtyEvent(listener);
		if (this._dirtyListener) {
			this._dirtyListener.dispose();
		} else {
			this._register({
				dispose: () => {
					if (this._dirtyListener) {
						this._dirtyListener.dispose();
					}
				}
			});
		}
		this._dirtyListener = disposable;
	}

	private async assignProviders(): Promise<void> {
		await this.extensionService.whenInstalledExtensionsRegistered();
		let providerIds: string[] = getProvidersForFileName(this._title, this.notebookService);
		if (providerIds && providerIds.length > 0) {
			this._providerId = providerIds.filter(provider => provider !== DEFAULT_NOTEBOOK_PROVIDER)[0];
			this._providers = providerIds;
			this._standardKernels = [];
			this._providers.forEach(provider => {
				let standardKernels = getStandardKernelsForProvider(provider, this.notebookService);
				this._standardKernels.push(...standardKernels);
			});
			let serializationProvider = await this.notebookService.getOrCreateSerializationManager(this._providerId, this._resource);
			this._contentLoader = this.instantiationService.createInstance(NotebookEditorContentLoader, this, serializationProvider.contentManager);
		}
	}

	public override dispose(): void {
		if (this._model && this._model.editorModel && this._model.editorModel.textEditorModel) {
			this._model.editorModel.textEditorModel.onBeforeDetached();
		}
		this._disposeContainer();
		super.dispose();
	}

	private _disposeContainer() {
		if (!this._parentContainer) {
			return;
		}

		let parentNode = this._parentContainer.parentNode;
		if (parentNode) {
			parentNode.removeChild(this._parentContainer);
			this._parentContainer = null;
		}
	}

	set container(container: HTMLElement) {
		this._disposeContainer();
		this._parentContainer = container;
		this._containerResolved.resolve();
	}

	get container(): HTMLElement {
		return this._parentContainer;
	}

	get containerResolved(): Promise<void> {
		return this._containerResolved.promise;
	}

	/**
	 * An editor that is dirty will be asked to be saved once it closes.
	 */
	override isDirty(): boolean {
		if (this._model) {
			return this._model.isDirty();
		} else if (this._textInput) {
			return this._textInput.isDirty();
		}
		return false;
	}

	/**
	 * Sets active editor with dirty value.
	 * @param isDirty boolean value to set editor dirty
	 */
	setDirty(isDirty: boolean): void {
		if (this._model) {
			this._model.setDirty(isDirty);
		}
	}

	public updateModel(): Promise<void> {
		return this._model.updateModel();
	}

	public override matches(otherInput: any): boolean {
		if (otherInput instanceof NotebookInput) {
			return this.textInput.matches(otherInput.textInput);
		} else {
			return this.textInput.matches(otherInput);
		}
	}

	public get showActions(): boolean {
		return this._showActions;
	}
}

export class NotebookEditorContentLoader implements IContentLoader {
	constructor(
		private notebookInput: NotebookInput,
		private contentManager: azdata.nb.ContentManager) {
	}

	async loadContent(): Promise<azdata.nb.INotebookContents> {
		let notebookEditorModel = await this.notebookInput.resolve();
		return this.contentManager.deserializeNotebook(notebookEditorModel.contentString);
	}
}
