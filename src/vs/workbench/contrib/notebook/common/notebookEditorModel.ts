/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { EditorModel, IRevertOptions } from 'vs/workbench/common/editor';
import { Emitter, Event } from 'vs/base/common/event';
import { INotebookEditorModel, NotebookCellsChangeType, NotebookDocumentBackupData } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { NotebookTextModel } from 'vs/workbench/contrib/notebook/common/model/notebookTextModel';
import { INotebookService } from 'vs/workbench/contrib/notebook/common/notebookService';
import { URI } from 'vs/base/common/uri';
import { IWorkingCopyService, IWorkingCopy, IWorkingCopyBackup, WorkingCopyCapabilities } from 'vs/workbench/services/workingCopy/common/workingCopyService';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { IBackupFileService } from 'vs/workbench/services/backup/common/backup';
import { Schemas } from 'vs/base/common/network';
import { IFileStatWithMetadata, IFileService } from 'vs/platform/files/common/files';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { ILabelService } from 'vs/platform/label/common/label';


export interface INotebookLoadOptions {
	/**
	 * Go to disk bypassing any cache of the model if any.
	 */
	forceReadFromDisk?: boolean;
}


export class NotebookEditorModel extends EditorModel implements INotebookEditorModel {

	private readonly _onDidChangeDirty = this._register(new Emitter<void>());
	private readonly _onDidChangeContent = this._register(new Emitter<void>());

	readonly onDidChangeDirty = this._onDidChangeDirty.event;
	readonly onDidChangeContent = this._onDidChangeContent.event;

	private _notebook!: NotebookTextModel;
	private _lastResolvedFileStat?: IFileStatWithMetadata;

	private readonly _name: string;
	private readonly _workingCopyResource: URI;

	private _dirty = false;

	constructor(
		readonly resource: URI,
		readonly viewType: string,
		@INotebookService private readonly _notebookService: INotebookService,
		@IWorkingCopyService private readonly _workingCopyService: IWorkingCopyService,
		@IBackupFileService private readonly _backupFileService: IBackupFileService,
		@IFileService private readonly _fileService: IFileService,
		@INotificationService private readonly _notificationService: INotificationService,
		@ILabelService labelService: ILabelService,
	) {
		super();

		this._name = labelService.getUriBasenameLabel(resource);

		const that = this;
		this._workingCopyResource = resource.with({ scheme: Schemas.vscodeNotebook });
		const workingCopyAdapter = new class implements IWorkingCopy {
			readonly resource = that._workingCopyResource;
			get name() { return that._name; }
			readonly capabilities = that.isUntitled() ? WorkingCopyCapabilities.Untitled : WorkingCopyCapabilities.None;
			readonly onDidChangeDirty = that.onDidChangeDirty;
			readonly onDidChangeContent = that.onDidChangeContent;
			isDirty(): boolean { return that.isDirty(); }
			backup(): Promise<IWorkingCopyBackup> { return that.backup(); }
			save(): Promise<boolean> { return that.save(); }
			revert(options?: IRevertOptions): Promise<void> { return that.revert(options); }
		};

		this._register(this._workingCopyService.registerWorkingCopy(workingCopyAdapter));
	}

	get lastResolvedFileStat() {
		return this._lastResolvedFileStat;
	}

	get notebook() {
		return this._notebook;
	}

	setDirty(newState: boolean) {
		if (this._dirty !== newState) {
			this._dirty = newState;
			this._onDidChangeDirty.fire();
		}
	}

	async backup(): Promise<IWorkingCopyBackup<NotebookDocumentBackupData>> {
		if (this._notebook.supportBackup) {
			const tokenSource = new CancellationTokenSource();
			const backupId = await this._notebookService.backup(this.viewType, this.resource, tokenSource.token);
			const stats = await this._resolveStats(this.resource);

			return {
				meta: {
					mtime: stats?.mtime || new Date().getTime(),
					name: this._name,
					viewType: this._notebook.viewType,
					backupId: backupId
				}
			};
		} else {
			return {
				meta: {
					mtime: new Date().getTime(),
					name: this._name,
					viewType: this._notebook.viewType
				},
				content: this._notebook.createSnapshot(true)
			};
		}
	}

	async revert(options?: IRevertOptions | undefined): Promise<void> {
		if (options?.soft) {
			await this._backupFileService.discardBackup(this.resource);
			return;
		}

		await this.load({ forceReadFromDisk: true });
		const newStats = await this._resolveStats(this.resource);
		this._lastResolvedFileStat = newStats;

		this.setDirty(false);
		this._onDidChangeDirty.fire();
	}

	async load(options?: INotebookLoadOptions): Promise<NotebookEditorModel> {
		if (options?.forceReadFromDisk) {
			return this._loadFromProvider(true, undefined);
		}

		if (this.isResolved()) {
			return this;
		}

		const backup = await this._backupFileService.resolve<NotebookDocumentBackupData>(this._workingCopyResource);

		if (this.isResolved()) {
			return this; // Make sure meanwhile someone else did not succeed in loading
		}

		return this._loadFromProvider(false, backup?.meta?.backupId);
	}

	private async _loadFromProvider(forceReloadFromDisk: boolean, backupId: string | undefined) {
		this._notebook = await this._notebookService.resolveNotebook(this.viewType!, this.resource, forceReloadFromDisk, backupId);

		const newStats = await this._resolveStats(this.resource);
		this._lastResolvedFileStat = newStats;

		this._register(this._notebook);

		this._register(this._notebook.onDidChangeContent(e => {
			let triggerDirty = false;
			for (let i = 0; i < e.rawEvents.length; i++) {
				if (e.rawEvents[i].kind !== NotebookCellsChangeType.Initialize) {
					this._onDidChangeContent.fire();
					triggerDirty = triggerDirty || !e.rawEvents[i].transient;
				}
			}

			if (triggerDirty) {
				this.setDirty(true);
			}
		}));

		if (forceReloadFromDisk) {
			this.setDirty(false);
		}

		if (backupId) {
			await this._backupFileService.discardBackup(this._workingCopyResource);
			this.setDirty(true);
		}

		return this;
	}

	isResolved(): boolean {
		return !!this._notebook;
	}

	isDirty() {
		return this._dirty;
	}

	isUntitled() {
		return this.resource.scheme === Schemas.untitled;
	}

	private async _assertStat() {
		const stats = await this._resolveStats(this.resource);
		if (this._lastResolvedFileStat && stats && stats.mtime > this._lastResolvedFileStat.mtime) {
			return new Promise<'overwrite' | 'revert' | 'none'>(resolve => {
				const handle = this._notificationService.prompt(
					Severity.Info,
					nls.localize('notebook.staleSaveError', "The contents of the file has changed on disk. Would you like to open the updated version or overwrite the file with your changes?"),
					[{
						label: nls.localize('notebook.staleSaveError.revert', "Revert"),
						run: () => {
							resolve('revert');
						}
					}, {
						label: nls.localize('notebook.staleSaveError.overwrite.', "Overwrite"),
						run: () => {
							resolve('overwrite');
						}
					}],
					{ sticky: true }
				);

				Event.once(handle.onDidClose)(() => {
					resolve('none');
				});
			});
		}

		return 'overwrite';
	}

	async save(): Promise<boolean> {
		const result = await this._assertStat();
		if (result === 'none') {
			return false;
		}

		if (result === 'revert') {
			await this.revert();
			return true;
		}

		const tokenSource = new CancellationTokenSource();
		await this._notebookService.save(this.notebook.viewType, this.notebook.uri, tokenSource.token);
		const newStats = await this._resolveStats(this.resource);
		this._lastResolvedFileStat = newStats;
		this.setDirty(false);
		return true;
	}

	async saveAs(targetResource: URI): Promise<boolean> {
		const result = await this._assertStat();

		if (result === 'none') {
			return false;
		}

		if (result === 'revert') {
			await this.revert();
			return true;
		}

		const tokenSource = new CancellationTokenSource();
		await this._notebookService.saveAs(this.notebook.viewType, this.notebook.uri, targetResource, tokenSource.token);
		const newStats = await this._resolveStats(this.resource);
		this._lastResolvedFileStat = newStats;
		this.setDirty(false);
		return true;
	}

	private async _resolveStats(resource: URI) {
		if (resource.scheme === Schemas.untitled) {
			return undefined;
		}

		try {
			const newStats = await this._fileService.resolve(this.resource, { resolveMetadata: true });
			return newStats;
		} catch (e) {
			return undefined;
		}
	}
}
