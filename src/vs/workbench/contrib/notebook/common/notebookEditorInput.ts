/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as glob from 'vs/base/common/glob';
import { IEditorInput, GroupIdentifier, ISaveOptions, IMoveResult, IRevertOptions, EditorInputCapabilities, Verbosity, IUntypedEditorInput } from 'vs/workbench/common/editor';
import { INotebookService, SimpleNotebookProviderInfo } from 'vs/workbench/contrib/notebook/common/notebookService';
import { URI } from 'vs/base/common/uri';
import { isEqual, joinPath } from 'vs/base/common/resources';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IFileDialogService } from 'vs/platform/dialogs/common/dialogs';
import { INotebookEditorModelResolverService } from 'vs/workbench/contrib/notebook/common/notebookEditorModelResolverService';
import { IDisposable, IReference } from 'vs/base/common/lifecycle';
import { CellEditType, IResolvedNotebookEditorModel } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { ILabelService } from 'vs/platform/label/common/label';
import { Schemas } from 'vs/base/common/network';
import { mark } from 'vs/workbench/contrib/notebook/common/notebookPerformance';
import { FileSystemProviderCapabilities, IFileService } from 'vs/platform/files/common/files';
import { AbstractResourceEditorInput } from 'vs/workbench/common/editor/resourceEditorInput';
import { IResourceEditorInput } from 'vs/platform/editor/common/editor';
import { onUnexpectedError } from 'vs/base/common/errors';
import { VSBuffer } from 'vs/base/common/buffer';
import { IWorkingCopyIdentifier } from 'vs/workbench/services/workingCopy/common/workingCopy';
import { IWorkingCopyBackupService } from 'vs/workbench/services/workingCopy/common/workingCopyBackup';

export interface NotebookEditorInputOptions {
	startDirty?: boolean;
	/**
	 * backupId for webview
	 */
	_backupId?: string;
	_workingCopy?: IWorkingCopyIdentifier;
}

export class NotebookEditorInput extends AbstractResourceEditorInput {

	static create(instantiationService: IInstantiationService, resource: URI, viewType: string, options: NotebookEditorInputOptions = {}) {
		return instantiationService.createInstance(NotebookEditorInput, resource, viewType, options);
	}

	static readonly ID: string = 'workbench.input.notebook';

	private _editorModelReference: IReference<IResolvedNotebookEditorModel> | null = null;
	private _sideLoadedListener: IDisposable;
	private _defaultDirtyState: boolean = false;

	constructor(
		resource: URI,
		public readonly viewType: string,
		public readonly options: NotebookEditorInputOptions,
		@INotebookService private readonly _notebookService: INotebookService,
		@INotebookEditorModelResolverService private readonly _notebookModelResolverService: INotebookEditorModelResolverService,
		@IFileDialogService private readonly _fileDialogService: IFileDialogService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IWorkingCopyBackupService private readonly workingCopyBackupService: IWorkingCopyBackupService,
		@ILabelService labelService: ILabelService,
		@IFileService fileService: IFileService
	) {
		super(resource, undefined, labelService, fileService);
		this._defaultDirtyState = !!options.startDirty;

		// Automatically resolve this input when the "wanted" model comes to life via
		// some other way. This happens only once per input and resolve disposes
		// this listener
		this._sideLoadedListener = _notebookService.onDidAddNotebookDocument(e => {
			if (e.viewType === this.viewType && e.uri.toString() === this.resource.toString()) {
				this.resolve().catch(onUnexpectedError);
			}
		});
	}

	override dispose() {
		this._sideLoadedListener.dispose();
		this._editorModelReference?.dispose();
		this._editorModelReference = null;
		super.dispose();
	}

	override get typeId(): string {
		return NotebookEditorInput.ID;
	}

	override get editorId(): string | undefined {
		return this.viewType;
	}

	override get capabilities(): EditorInputCapabilities {
		let capabilities = EditorInputCapabilities.None;

		if (this.resource.scheme === Schemas.untitled) {
			capabilities |= EditorInputCapabilities.Untitled;
		}

		if (this._editorModelReference) {
			if (this._editorModelReference.object.isReadonly()) {
				capabilities |= EditorInputCapabilities.Readonly;
			}
		} else {
			if (this.fileService.hasCapability(this.resource, FileSystemProviderCapabilities.Readonly)) {
				capabilities |= EditorInputCapabilities.Readonly;
			}
		}

		return capabilities;
	}

	override getDescription(verbosity = Verbosity.MEDIUM): string | undefined {
		if (!this.hasCapability(EditorInputCapabilities.Untitled) || this._editorModelReference?.object.hasAssociatedFilePath()) {
			return super.getDescription(verbosity);
		}

		return undefined; // no description for untitled notebooks without associated file path
	}

	override isDirty() {
		if (!this._editorModelReference) {
			return this._defaultDirtyState;
		}
		return this._editorModelReference.object.isDirty();
	}

	override isOrphaned() {
		if (!this._editorModelReference) {
			return super.isOrphaned();
		}

		return this._editorModelReference.object.isOrphaned();
	}

	override async save(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined> {
		if (this._editorModelReference) {

			if (this.hasCapability(EditorInputCapabilities.Untitled)) {
				return this.saveAs(group, options);
			} else {
				await this._editorModelReference.object.save(options);
			}

			return this;
		}

		return undefined;
	}

	override async saveAs(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined> {
		if (!this._editorModelReference) {
			return undefined;
		}

		const provider = this._notebookService.getContributedNotebookType(this.viewType);

		if (!provider) {
			return undefined;
		}

		const pathCandidate = this.hasCapability(EditorInputCapabilities.Untitled) ? await this._suggestName(this.labelService.getUriBasenameLabel(this.resource)) : this._editorModelReference.object.resource;
		let target: URI | undefined;
		if (this._editorModelReference.object.hasAssociatedFilePath()) {
			target = pathCandidate;
		} else {
			target = await this._fileDialogService.pickFileToSave(pathCandidate, options?.availableFileSystems);
			if (!target) {
				return undefined; // save cancelled
			}
		}

		if (!provider.matches(target)) {
			const patterns = provider.selectors.map(pattern => {
				if (typeof pattern === 'string') {
					return pattern;
				}

				if (glob.isRelativePattern(pattern)) {
					return `${pattern} (base ${pattern.base})`;
				}

				if (pattern.exclude) {
					return `${pattern.include} (exclude: ${pattern.exclude})`;
				} else {
					return `${pattern.include}`;
				}

			}).join(', ');
			throw new Error(`File name ${target} is not supported by ${provider.providerDisplayName}.\n\nPlease make sure the file name matches following patterns:\n${patterns}`);
		}

		return await this._editorModelReference.object.saveAs(target);
	}

	private async _suggestName(suggestedFilename: string) {
		return joinPath(await this._fileDialogService.defaultFilePath(), suggestedFilename);
	}

	// called when users rename a notebook document
	override rename(group: GroupIdentifier, target: URI): IMoveResult | undefined {
		if (this._editorModelReference) {
			const contributedNotebookProviders = this._notebookService.getContributedNotebookTypes(target);

			if (contributedNotebookProviders.find(provider => provider.id === this._editorModelReference!.object.viewType)) {
				return this._move(group, target);
			}
		}
		return undefined;
	}

	private _move(_group: GroupIdentifier, newResource: URI): { editor: IEditorInput; } {
		const editorInput = NotebookEditorInput.create(this._instantiationService, newResource, this.viewType);
		return { editor: editorInput };
	}

	override async revert(_group: GroupIdentifier, options?: IRevertOptions): Promise<void> {
		if (this._editorModelReference && this._editorModelReference.object.isDirty()) {
			await this._editorModelReference.object.revert(options);
		}
	}

	override async resolve(): Promise<IResolvedNotebookEditorModel | null> {
		if (!await this._notebookService.canResolve(this.viewType)) {
			return null;
		}

		mark(this.resource, 'extensionActivated');

		// we are now loading the notebook and don't need to listen to
		// "other" loading anymore
		this._sideLoadedListener.dispose();

		if (!this._editorModelReference) {
			const ref = await this._notebookModelResolverService.resolve(this.resource, this.viewType);
			if (this._editorModelReference) {
				// Re-entrant, double resolve happened. Dispose the addition references and proceed
				// with the truth.
				ref.dispose();
				return (<IReference<IResolvedNotebookEditorModel>>this._editorModelReference).object;
			}
			this._editorModelReference = ref;
			if (this.isDisposed()) {
				this._editorModelReference.dispose();
				this._editorModelReference = null;
				return null;
			}
			this._register(this._editorModelReference.object.onDidChangeDirty(() => this._onDidChangeDirty.fire()));
			this._register(this._editorModelReference.object.onDidChangeOrphaned(() => this._onDidChangeLabel.fire()));
			this._register(this._editorModelReference.object.onDidChangeReadonly(() => this._onDidChangeCapabilities.fire()));
			if (this._editorModelReference.object.isDirty()) {
				this._onDidChangeDirty.fire();
			}
		} else {
			this._editorModelReference.object.load();
		}

		if (this.options._backupId) {
			const info = await this._notebookService.withNotebookDataProvider(this._editorModelReference.object.notebook.uri, this._editorModelReference.object.notebook.viewType);
			if (!(info instanceof SimpleNotebookProviderInfo)) {
				throw new Error('CANNOT open file notebook with this provider');
			}

			const data = await info.serializer.dataToNotebook(VSBuffer.fromString(JSON.stringify({ __webview_backup: this.options._backupId })));
			this._editorModelReference.object.notebook.applyEdits([
				{
					editType: CellEditType.Replace,
					index: 0,
					count: this._editorModelReference.object.notebook.length,
					cells: data.cells
				}
			], true, undefined, () => undefined, undefined, false);

			if (this.options._workingCopy) {
				await this.workingCopyBackupService.discardBackup(this.options._workingCopy);
				this.options._backupId = undefined;
				this.options._workingCopy = undefined;
				this.options.startDirty = undefined;
			}
		}

		return this._editorModelReference.object;
	}

	override toUntyped(): IResourceEditorInput {
		return {
			resource: this.preferredResource,
			options: {
				override: this.viewType
			}
		};
	}

	override matches(otherInput: IEditorInput | IUntypedEditorInput): boolean {
		if (super.matches(otherInput)) {
			return true;
		}
		if (otherInput instanceof NotebookEditorInput) {
			return this.viewType === otherInput.viewType && isEqual(this.resource, otherInput.resource);
		}
		return false;
	}
}

export interface ICompositeNotebookEditorInput {
	readonly editorInputs: NotebookEditorInput[];
}

export function isCompositeNotebookEditorInput(thing: unknown): thing is ICompositeNotebookEditorInput {
	return !!thing
		&& typeof thing === 'object'
		&& Array.isArray((<ICompositeNotebookEditorInput>thing).editorInputs)
		&& ((<ICompositeNotebookEditorInput>thing).editorInputs.every(input => input instanceof NotebookEditorInput));
}
