/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as glob from 'vs/base/common/glob';
import { IEditorInput, GroupIdentifier, ISaveOptions, IMoveResult, IRevertOptions, EditorInputCapabilities, Verbosity } from 'vs/workbench/common/editor';
import { INotebookService } from 'vs/workbench/contrib/notebook/common/notebookService';
import { URI } from 'vs/base/common/uri';
import { isEqual, joinPath } from 'vs/base/common/resources';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IFileDialogService } from 'vs/platform/dialogs/common/dialogs';
import { INotebookEditorModelResolverService } from 'vs/workbench/contrib/notebook/common/notebookEditorModelResolverService';
import { IReference } from 'vs/base/common/lifecycle';
import { IResolvedNotebookEditorModel } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { ILabelService } from 'vs/platform/label/common/label';
import { Schemas } from 'vs/base/common/network';
import { mark } from 'vs/workbench/contrib/notebook/common/notebookPerformance';
import { FileSystemProviderCapabilities, IFileService } from 'vs/platform/files/common/files';
import { AbstractResourceEditorInput } from 'vs/workbench/common/editor/resourceEditorInput';
import { IResourceEditorInput } from 'vs/platform/editor/common/editor';

interface NotebookEditorInputOptions {
	startDirty?: boolean;
}

export class NotebookEditorInput extends AbstractResourceEditorInput {

	static create(instantiationService: IInstantiationService, resource: URI, viewType: string, options: NotebookEditorInputOptions = {}) {
		return instantiationService.createInstance(NotebookEditorInput, resource, viewType, options);
	}

	static readonly ID: string = 'workbench.input.notebook';

	private _editorModelReference: IReference<IResolvedNotebookEditorModel> | null = null;
	private _defaultDirtyState: boolean = false;

	constructor(
		resource: URI,
		public readonly viewType: string,
		public readonly options: NotebookEditorInputOptions,
		@INotebookService private readonly _notebookService: INotebookService,
		@INotebookEditorModelResolverService private readonly _notebookModelResolverService: INotebookEditorModelResolverService,
		@IFileDialogService private readonly _fileDialogService: IFileDialogService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@ILabelService labelService: ILabelService,
		@IFileService fileService: IFileService
	) {
		super(resource, undefined, labelService, fileService);
		this._defaultDirtyState = !!options.startDirty;
	}

	override dispose() {
		this._editorModelReference?.dispose();
		this._editorModelReference = null;
		super.dispose();
	}

	override get typeId(): string {
		return NotebookEditorInput.ID;
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

		const dialogPath = this.hasCapability(EditorInputCapabilities.Untitled) ? await this._suggestName(this.labelService.getUriBasenameLabel(this.resource)) : this._editorModelReference.object.resource;

		const target = await this._fileDialogService.pickFileToSave(dialogPath, options?.availableFileSystems);
		if (!target) {
			return undefined; // save cancelled
		}

		if (!provider.matches(target)) {
			const patterns = provider.selectors.map(pattern => {
				if (typeof pattern === 'string') {
					return pattern;
				}

				if (glob.isRelativePattern(pattern)) {
					return `${pattern} (base ${pattern.base})`;
				}

				return `${pattern.include} (exclude: ${pattern.exclude})`;
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

	private _move(_group: GroupIdentifier, newResource: URI): { editor: IEditorInput } {
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

		if (!this._editorModelReference) {
			this._editorModelReference = await this._notebookModelResolverService.resolve(this.resource, this.viewType);
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

		return this._editorModelReference.object;
	}

	override asResourceEditorInput(groupId: GroupIdentifier): IResourceEditorInput {
		return {
			resource: this.preferredResource,
			options: {
				override: this.viewType
			}
		};
	}

	override matches(otherInput: unknown): boolean {
		if (super.matches(otherInput)) {
			return true;
		}
		if (otherInput instanceof NotebookEditorInput) {
			return this.viewType === otherInput.viewType && isEqual(this.resource, otherInput.resource);
		}
		return false;
	}
}
