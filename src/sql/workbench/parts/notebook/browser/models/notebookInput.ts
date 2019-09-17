/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorModel } from 'vs/platform/editor/common/editor';
import { EditorInput, EditorModel, ConfirmResult } from 'vs/workbench/common/editor';
import { Emitter, Event } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import * as resources from 'vs/base/common/resources';
import * as azdata from 'azdata';

import { IStandardKernelWithProvider, getProvidersForFileName, getStandardKernelsForProvider } from 'sql/workbench/parts/notebook/browser/models/notebookUtils';
import { INotebookService, DEFAULT_NOTEBOOK_PROVIDER, IProviderInfo } from 'sql/workbench/services/notebook/browser/notebookService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { INotebookModel, IContentManager, NotebookContentChange } from 'sql/workbench/parts/notebook/browser/models/modelInterfaces';
import { TextFileEditorModel } from 'vs/workbench/services/textfile/common/textFileEditorModel';
import { UntitledEditorModel } from 'vs/workbench/common/editor/untitledEditorModel';
import { Schemas } from 'vs/base/common/network';
import { ITextFileService, ISaveOptions, StateChange } from 'vs/workbench/services/textfile/common/textfiles';
import { LocalContentManager } from 'sql/workbench/services/notebook/common/localContentManager';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IDisposable } from 'vs/base/common/lifecycle';
import { NotebookChangeType } from 'sql/workbench/parts/notebook/common/models/contracts';
import { Deferred } from 'sql/base/common/promise';
import { NotebookTextFileModel } from 'sql/workbench/parts/notebook/browser/models/notebookTextFileModel';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/resourceConfiguration';

export type ModeViewSaveHandler = (handle: number) => Thenable<boolean>;

export class NotebookEditorModel extends EditorModel {
	private _dirty: boolean;
	private _changeEventsHookedUp: boolean = false;
	private _notebookTextFileModel: NotebookTextFileModel;
	private readonly _onDidChangeDirty: Emitter<void> = this._register(new Emitter<void>());
	private _lastEditFullReplacement: boolean;
	constructor(public readonly notebookUri: URI,
		private textEditorModel: TextFileEditorModel | UntitledEditorModel,
		@INotebookService private notebookService: INotebookService,
		@ITextFileService private textFileService: ITextFileService,
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
						this._register(model.kernelChanged(e => this.updateModel(undefined, NotebookChangeType.KernelChanged)));
						this._register(model.contentChanged(e => this.updateModel(e, e.changeType)));
						this._register(notebook.model.onActiveCellChanged((cell) => {
							if (cell) {
								this._notebookTextFileModel.activeCellGuid = cell.cellGuid;
							}
						}));
					}
				}, err => undefined);
			}
		}));

		if (this.textEditorModel instanceof UntitledEditorModel) {
			this._register(this.textEditorModel.onDidChangeDirty(e => this.setDirty(this.textEditorModel.isDirty())));
		} else {
			this._register(this.textEditorModel.onDidStateChange(change => {
				this.setDirty(this.textEditorModel.isDirty());
				if (change === StateChange.SAVED) {
					this.sendNotebookSerializationStateChange();
				}
			}));
		}
		this._dirty = this.textEditorModel.isDirty();
	}

	public get contentString(): string {
		let model = this.textEditorModel.textEditorModel;
		return model.getValue();
	}

	public get lastEditFullReplacement(): boolean {
		return this._lastEditFullReplacement;
	}

	isDirty(): boolean {
		return this.textEditorModel.isDirty();
	}

	public setDirty(dirty: boolean): void {
		if (this._dirty === dirty) {
			return;
		}
		this._dirty = dirty;
		this._onDidChangeDirty.fire();
	}

	/**
	 * UntitledEditor uses TextFileService to save data from UntitledEditorInput
	 * Titled editor uses TextFileEditorModel to save existing notebook
	*/
	save(options: ISaveOptions): Promise<boolean> {
		if (this.textEditorModel instanceof TextFileEditorModel) {
			this.textEditorModel.save(options);
			return Promise.resolve(true);
		}
		else {
			return this.textFileService.save(this.notebookUri, options);
		}
	}

	public updateModel(contentChange?: NotebookContentChange, type?: NotebookChangeType): void {
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
				this.replaceEntireTextEditorModel(notebookModel, type);
				this._lastEditFullReplacement = true;
			}
		}
	}

	public replaceEntireTextEditorModel(notebookModel: INotebookModel, type: NotebookChangeType) {
		this._notebookTextFileModel.replaceEntireTextEditorModel(notebookModel, type, this.textEditorModel);
	}

	private sendNotebookSerializationStateChange(): void {
		let notebookModel = this.getNotebookModel();
		if (notebookModel) {
			this.notebookService.serializeNotebookStateChange(this.notebookUri, NotebookChangeType.Saved);
		}
	}

	isModelCreated(): boolean {
		return this.getNotebookModel() !== undefined;
	}

	private getNotebookModel(): INotebookModel {
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

export class NotebookInput extends EditorInput {
	public static ID: string = 'workbench.editorinputs.notebookInput';
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
	private _untitledEditorModel: UntitledEditorModel;
	private _contentManager: IContentManager;
	private _providersLoaded: Promise<void>;
	private _dirtyListener: IDisposable;
	private _notebookEditorOpenedTimestamp: number;
	private _modelResolveInProgress: boolean = false;
	private _modelResolved: Deferred<void> = new Deferred<void>();

	constructor(private _title: string,
		private resource: URI,
		private _textInput: UntitledEditorInput,
		@ITextModelService private textModelService: ITextModelService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@INotebookService private notebookService: INotebookService,
		@IExtensionService private extensionService: IExtensionService
	) {
		super();
		this.resource = resource;
		this._standardKernels = [];
		this._providersLoaded = this.assignProviders();
		this._notebookEditorOpenedTimestamp = Date.now();
		if (this._textInput) {
			this.hookDirtyListener(this._textInput.onDidChangeDirty, () => this._onDidChangeDirty.fire());
		}
	}

	public get textInput(): UntitledEditorInput {
		return this._textInput;
	}

	public confirmSave(): Promise<ConfirmResult> {
		return this._textInput.confirmSave();
	}

	public revert(): Promise<boolean> {
		return this._textInput.revert();
	}

	public get notebookUri(): URI {
		return this.resource;
	}

	public get contentManager(): IContentManager {
		if (!this._contentManager) {
			this._contentManager = this.instantiationService.createInstance(NotebookEditorContentManager, this);
		}
		return this._contentManager;
	}

	public getName(): string {
		if (!this._title) {
			this._title = resources.basenameOrAuthority(this.resource);
		}
		return this._title;
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

	public save(): Promise<boolean> {
		let options: ISaveOptions = { force: false };
		return this._model.save(options);
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

	public getTypeId(): string {
		return NotebookInput.ID;
	}

	getResource(): URI {
		return this.resource;
	}

	public get untitledEditorModel(): UntitledEditorModel {
		return this._untitledEditorModel;
	}

	public set untitledEditorModel(value: UntitledEditorModel) {
		this._untitledEditorModel = value;
	}

	async resolve(): Promise<NotebookEditorModel> {
		if (!this._modelResolveInProgress) {
			this._modelResolveInProgress = true;
		} else {
			await this._modelResolved;
			return this._model;
		}
		if (this._model) {
			return Promise.resolve(this._model);
		} else {
			let textOrUntitledEditorModel: UntitledEditorModel | IEditorModel;
			if (this.resource.scheme === Schemas.untitled) {
				textOrUntitledEditorModel = this._untitledEditorModel ? this._untitledEditorModel : await this._textInput.resolve();
			}
			else {
				const textEditorModelReference = await this.textModelService.createModelReference(this.resource);
				textOrUntitledEditorModel = await textEditorModelReference.object.load();
			}
			this._model = this.instantiationService.createInstance(NotebookEditorModel, this.resource, textOrUntitledEditorModel);
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
		}
	}

	public dispose(): void {
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
	}

	get container(): HTMLElement {
		return this._parentContainer;
	}

	/**
	 * An editor that is dirty will be asked to be saved once it closes.
	 */
	isDirty(): boolean {
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

	updateModel(): void {
		this._model.updateModel();
	}

	public matches(otherInput: any): boolean {
		if (super.matches(otherInput) === true) {
			return true;
		}

		if (otherInput instanceof NotebookInput) {
			const otherNotebookEditorInput = <NotebookInput>otherInput;

			// Compare by resource
			return otherNotebookEditorInput.notebookUri.toString() === this.notebookUri.toString();
		}
		return false;
	}
}

class NotebookEditorContentManager implements IContentManager {
	constructor(
		private notebookInput: NotebookInput,
		@IInstantiationService private readonly instantiationService: IInstantiationService) {
	}

	async loadContent(): Promise<azdata.nb.INotebookContents> {
		let notebookEditorModel = await this.notebookInput.resolve();
		let contentManager = this.instantiationService.createInstance(LocalContentManager);
		let contents = await contentManager.loadFromContentString(notebookEditorModel.contentString);
		return contents;
	}

}
