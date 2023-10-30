/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextModel } from 'vs/editor/common/model';
import { IDisposable, toDisposable, IReference, ReferenceCollection, Disposable, AsyncReferenceCollection } from 'vs/base/common/lifecycle';
import { IModelService } from 'vs/editor/common/services/model';
import { TextResourceEditorModel } from 'vs/workbench/common/editor/textResourceEditorModel';
import { ITextFileService, TextFileResolveReason } from 'vs/workbench/services/textfile/common/textfiles';
import { Schemas } from 'vs/base/common/network';
import { ITextModelService, ITextModelContentProvider, ITextEditorModel, IResolvedTextEditorModel, isResolvedTextEditorModel } from 'vs/editor/common/services/resolverService';
import { TextFileEditorModel } from 'vs/workbench/services/textfile/common/textFileEditorModel';
import { IFileService } from 'vs/platform/files/common/files';
import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IUndoRedoService } from 'vs/platform/undoRedo/common/undoRedo';
import { ModelUndoRedoParticipant } from 'vs/editor/common/services/modelUndoRedoParticipant';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';

class ResourceModelCollection extends ReferenceCollection<Promise<IResolvedTextEditorModel>> {

	private readonly providers = new Map<string, ITextModelContentProvider[]>();
	private readonly modelsToDispose = new Set<string>();

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ITextFileService private readonly textFileService: ITextFileService,
		@IFileService private readonly fileService: IFileService,
		@IModelService private readonly modelService: IModelService
	) {
		super();
	}

	protected createReferencedObject(key: string): Promise<IResolvedTextEditorModel> {
		return this.doCreateReferencedObject(key);
	}

	private async doCreateReferencedObject(key: string, skipActivateProvider?: boolean): Promise<IResolvedTextEditorModel> {

		// Untrack as being disposed
		this.modelsToDispose.delete(key);

		// inMemory Schema: go through model service cache
		const resource = URI.parse(key);
		if (resource.scheme === Schemas.inMemory) {
			const cachedModel = this.modelService.getModel(resource);
			if (!cachedModel) {
				throw new Error(`Unable to resolve inMemory resource ${key}`);
			}

			const model = this.instantiationService.createInstance(TextResourceEditorModel, resource);
			if (this.ensureResolvedModel(model, key)) {
				return model;
			}
		}

		// Untitled Schema: go through untitled text service
		if (resource.scheme === Schemas.untitled) {
			const model = await this.textFileService.untitled.resolve({ untitledResource: resource });
			if (this.ensureResolvedModel(model, key)) {
				return model;
			}
		}

		// File or remote file: go through text file service
		if (this.fileService.hasProvider(resource)) {
			const model = await this.textFileService.files.resolve(resource, { reason: TextFileResolveReason.REFERENCE });
			if (this.ensureResolvedModel(model, key)) {
				return model;
			}
		}

		// Virtual documents
		if (this.providers.has(resource.scheme)) {
			await this.resolveTextModelContent(key);

			const model = this.instantiationService.createInstance(TextResourceEditorModel, resource);
			if (this.ensureResolvedModel(model, key)) {
				return model;
			}
		}

		// Either unknown schema, or not yet registered, try to activate
		if (!skipActivateProvider) {
			await this.fileService.activateProvider(resource.scheme);

			return this.doCreateReferencedObject(key, true);
		}

		throw new Error(`Unable to resolve resource ${key}`);
	}

	private ensureResolvedModel(model: ITextEditorModel, key: string): model is IResolvedTextEditorModel {
		if (isResolvedTextEditorModel(model)) {
			return true;
		}

		throw new Error(`Unable to resolve resource ${key}`);
	}

	protected destroyReferencedObject(key: string, modelPromise: Promise<ITextEditorModel>): void {

		// untitled and inMemory are bound to a different lifecycle
		const resource = URI.parse(key);
		if (resource.scheme === Schemas.untitled || resource.scheme === Schemas.inMemory) {
			return;
		}

		// Track as being disposed before waiting for model to load
		// to handle the case that the reference is acquired again
		this.modelsToDispose.add(key);

		(async () => {
			try {
				const model = await modelPromise;

				if (!this.modelsToDispose.has(key)) {
					// return if model has been acquired again meanwhile
					return;
				}

				if (model instanceof TextFileEditorModel) {
					// text file models have conditions that prevent them
					// from dispose, so we have to wait until we can dispose
					await this.textFileService.files.canDispose(model);
				}

				if (!this.modelsToDispose.has(key)) {
					// return if model has been acquired again meanwhile
					return;
				}

				// Finally we can dispose the model
				model.dispose();
			} catch (error) {
				// ignore
			} finally {
				this.modelsToDispose.delete(key); // Untrack as being disposed
			}
		})();
	}

	registerTextModelContentProvider(scheme: string, provider: ITextModelContentProvider): IDisposable {
		let providers = this.providers.get(scheme);
		if (!providers) {
			providers = [];
			this.providers.set(scheme, providers);
		}

		providers.unshift(provider);

		return toDisposable(() => {
			const providersForScheme = this.providers.get(scheme);
			if (!providersForScheme) {
				return;
			}

			const index = providersForScheme.indexOf(provider);
			if (index === -1) {
				return;
			}

			providersForScheme.splice(index, 1);

			if (providersForScheme.length === 0) {
				this.providers.delete(scheme);
			}
		});
	}

	hasTextModelContentProvider(scheme: string): boolean {
		return this.providers.get(scheme) !== undefined;
	}

	private async resolveTextModelContent(key: string): Promise<ITextModel> {
		const resource = URI.parse(key);
		const providersForScheme = this.providers.get(resource.scheme) || [];

		for (const provider of providersForScheme) {
			const value = await provider.provideTextContent(resource);
			if (value) {
				return value;
			}
		}

		throw new Error(`Unable to resolve text model content for resource ${key}`);
	}
}

export class TextModelResolverService extends Disposable implements ITextModelService {

	declare readonly _serviceBrand: undefined;

	private _resourceModelCollection: ResourceModelCollection & ReferenceCollection<Promise<IResolvedTextEditorModel>> /* TS Fail */ | undefined = undefined;
	private get resourceModelCollection() {
		if (!this._resourceModelCollection) {
			this._resourceModelCollection = this.instantiationService.createInstance(ResourceModelCollection);
		}

		return this._resourceModelCollection;
	}

	private _asyncModelCollection: AsyncReferenceCollection<IResolvedTextEditorModel> | undefined = undefined;
	private get asyncModelCollection() {
		if (!this._asyncModelCollection) {
			this._asyncModelCollection = new AsyncReferenceCollection(this.resourceModelCollection);
		}

		return this._asyncModelCollection;
	}

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IFileService private readonly fileService: IFileService,
		@IUndoRedoService private readonly undoRedoService: IUndoRedoService,
		@IModelService private readonly modelService: IModelService,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService,
	) {
		super();

		this._register(new ModelUndoRedoParticipant(this.modelService, this, this.undoRedoService));
	}

	async createModelReference(resource: URI): Promise<IReference<IResolvedTextEditorModel>> {

		// From this moment on, only operate on the canonical resource
		// to ensure we reduce the chance of resolving the same resource
		// with different resource forms (e.g. path casing on Windows)
		resource = this.uriIdentityService.asCanonicalUri(resource);

		return await this.asyncModelCollection.acquire(resource.toString());
	}

	registerTextModelContentProvider(scheme: string, provider: ITextModelContentProvider): IDisposable {
		return this.resourceModelCollection.registerTextModelContentProvider(scheme, provider);
	}

	canHandleResource(resource: URI): boolean {
		if (this.fileService.hasProvider(resource) || resource.scheme === Schemas.untitled || resource.scheme === Schemas.inMemory) {
			return true; // we handle file://, untitled:// and inMemory:// automatically
		}

		return this.resourceModelCollection.hasTextModelContentProvider(resource.scheme);
	}
}

registerSingleton(ITextModelService, TextModelResolverService, InstantiationType.Delayed);
