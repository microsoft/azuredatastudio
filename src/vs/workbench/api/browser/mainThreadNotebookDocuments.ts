/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore, dispose } from 'vs/base/common/lifecycle';
import { ResourceMap } from 'vs/base/common/map';
import { URI, UriComponents } from 'vs/base/common/uri';
import { BoundModelReferenceCollection } from 'vs/workbench/api/browser/mainThreadDocuments';
import { NotebookCellTextModel } from 'vs/workbench/contrib/notebook/common/model/notebookCellTextModel';
import { NotebookTextModel } from 'vs/workbench/contrib/notebook/common/model/notebookTextModel';
import { IImmediateCellEditOperation, IMainCellDto, NotebookCellsChangeType, NotebookDataDto } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { INotebookEditorModelResolverService } from 'vs/workbench/contrib/notebook/common/notebookEditorModelResolverService';
import { INotebookService } from 'vs/workbench/contrib/notebook/common/notebookService';
import { IUriIdentityService } from 'vs/workbench/services/uriIdentity/common/uriIdentity';
import { ExtHostContext, ExtHostNotebookDocumentsShape, IExtHostContext, MainThreadNotebookDocumentsShape } from '../common/extHost.protocol';
import { MainThreadNotebooksAndEditors } from 'vs/workbench/api/browser/mainThreadNotebookDocumentsAndEditors';
import { onUnexpectedError } from 'vs/base/common/errors';
import { Schemas } from 'vs/base/common/network';
import { NotebookProviderInfo } from 'vs/workbench/contrib/notebook/common/notebookProvider';

export class MainThreadNotebookDocuments implements MainThreadNotebookDocumentsShape {

	private readonly _disposables = new DisposableStore();

	private readonly _proxy: ExtHostNotebookDocumentsShape;
	private readonly _documentEventListenersMapping = new ResourceMap<DisposableStore>();
	private readonly _modelReferenceCollection: BoundModelReferenceCollection;

	constructor(
		extHostContext: IExtHostContext,
		notebooksAndEditors: MainThreadNotebooksAndEditors,
		@INotebookService private readonly _notebookService: INotebookService,
		@INotebookEditorModelResolverService private readonly _notebookEditorModelResolverService: INotebookEditorModelResolverService,
		@IUriIdentityService private readonly _uriIdentityService: IUriIdentityService
	) {
		this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostNotebookDocuments);
		this._modelReferenceCollection = new BoundModelReferenceCollection(this._uriIdentityService.extUri);

		notebooksAndEditors.onDidAddNotebooks(this._handleNotebooksAdded, this, this._disposables);
		notebooksAndEditors.onDidRemoveNotebooks(this._handleNotebooksRemoved, this, this._disposables);

		// forward dirty and save events
		this._disposables.add(this._notebookEditorModelResolverService.onDidChangeDirty(model => this._proxy.$acceptDirtyStateChanged(model.resource, model.isDirty())));
		this._disposables.add(this._notebookEditorModelResolverService.onDidSaveNotebook(e => this._proxy.$acceptModelSaved(e)));
	}

	dispose(): void {
		this._disposables.dispose();
		this._modelReferenceCollection.dispose();
		dispose(this._documentEventListenersMapping.values());
	}

	private _handleNotebooksAdded(notebooks: readonly NotebookTextModel[]): void {

		for (const textModel of notebooks) {
			const disposableStore = new DisposableStore();
			disposableStore.add(textModel.onDidChangeContent(event => {
				const dto = event.rawEvents.map(e => {
					const data =
						e.kind === NotebookCellsChangeType.ModelChange || e.kind === NotebookCellsChangeType.Initialize
							? {
								kind: e.kind,
								versionId: event.versionId,
								changes: e.changes.map(diff => [diff[0], diff[1], diff[2].map(cell => MainThreadNotebookDocuments._cellToDto(cell as NotebookCellTextModel))] as [number, number, IMainCellDto[]])
							}
							: (
								e.kind === NotebookCellsChangeType.Move
									? {
										kind: e.kind,
										index: e.index,
										length: e.length,
										newIdx: e.newIdx,
										versionId: event.versionId,
										cells: e.cells.map(cell => MainThreadNotebookDocuments._cellToDto(cell as NotebookCellTextModel))
									}
									: e
							);

					return data;
				});

				// using the model resolver service to know if the model is dirty or not.
				// assuming this is the first listener it can mean that at first the model
				// is marked as dirty and that another event is fired
				this._proxy.$acceptModelChanged(
					textModel.uri,
					{ rawEvents: dto, versionId: event.versionId },
					this._notebookEditorModelResolverService.isDirty(textModel.uri)
				);

				const hasDocumentMetadataChangeEvent = event.rawEvents.find(e => e.kind === NotebookCellsChangeType.ChangeDocumentMetadata);
				if (hasDocumentMetadataChangeEvent) {
					this._proxy.$acceptDocumentPropertiesChanged(textModel.uri, { metadata: textModel.metadata });
				}
			}));

			this._documentEventListenersMapping.set(textModel.uri, disposableStore);
		}
	}

	private _handleNotebooksRemoved(uris: URI[]): void {
		for (const uri of uris) {
			this._documentEventListenersMapping.get(uri)?.dispose();
			this._documentEventListenersMapping.delete(uri);
		}
	}

	private static _cellToDto(cell: NotebookCellTextModel): IMainCellDto {
		return {
			handle: cell.handle,
			uri: cell.uri,
			source: cell.textBuffer.getLinesContent(),
			eol: cell.textBuffer.getEOL(),
			language: cell.language,
			cellKind: cell.cellKind,
			outputs: cell.outputs,
			metadata: cell.metadata,
			internalMetadata: cell.internalMetadata,
		};
	}

	async $tryCreateNotebook(options: { viewType: string, content?: NotebookDataDto }): Promise<UriComponents> {

		const info = this._notebookService.getContributedNotebookType(options.viewType);
		if (!info) {
			throw new Error('UNKNOWN view type: ' + options.viewType);
		}

		// find a free URI for the untitled case
		const suffix = NotebookProviderInfo.possibleFileEnding(info.selectors) ?? '';
		let uri: URI;
		for (let counter = 1; ; counter++) {
			let candidate = URI.from({ scheme: Schemas.untitled, path: `Untitled-${counter}${suffix}`, query: options.viewType });
			if (!this._notebookService.getNotebookTextModel(candidate)) {
				uri = candidate;
				break;
			}
		}

		const ref = await this._notebookEditorModelResolverService.resolve(uri, options.viewType);

		// untitled notebooks are disposed when they get saved. we should not hold a reference
		// to such a disposed notebook and therefore dispose the reference as well
		ref.object.notebook.onWillDispose(() => {
			ref.dispose();
		});

		// untitled notebooks are dirty by default
		this._proxy.$acceptDirtyStateChanged(uri, true);

		// apply content changes... slightly HACKY -> this triggers a change event
		if (options.content) {
			ref.object.notebook.reset(
				options.content.cells,
				options.content.metadata,
				ref.object.notebook.transientOptions
			);
		}
		return uri;
	}

	async $tryOpenNotebook(uriComponents: UriComponents): Promise<URI> {
		const uri = URI.revive(uriComponents);
		const ref = await this._notebookEditorModelResolverService.resolve(uri, undefined);
		this._modelReferenceCollection.add(uri, ref);
		return uri;
	}

	async $trySaveNotebook(uriComponents: UriComponents) {
		const uri = URI.revive(uriComponents);

		const ref = await this._notebookEditorModelResolverService.resolve(uri);
		const saveResult = await ref.object.save();
		ref.dispose();
		return saveResult;
	}

	async $applyEdits(resource: UriComponents, cellEdits: IImmediateCellEditOperation[], computeUndoRedo = true): Promise<void> {
		const textModel = this._notebookService.getNotebookTextModel(URI.from(resource));
		if (!textModel) {
			throw new Error(`Can't apply edits to unknown notebook model: ${URI.revive(resource).toString()}`);
		}

		try {
			textModel.applyEdits(cellEdits, true, undefined, () => undefined, undefined, computeUndoRedo);
		} catch (e) {
			// Clearing outputs at the same time as the EH calling append/replaceOutputItems is an expected race, and it should be a no-op.
			// And any other failure should not throw back to the extension.
			onUnexpectedError(e);
		}
	}
}
