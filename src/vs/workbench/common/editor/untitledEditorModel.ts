/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEncodingSupport } from 'vs/workbench/common/editor';
import { BaseTextEditorModel } from 'vs/workbench/common/editor/textEditorModel';
import { URI } from 'vs/base/common/uri';
import { PLAINTEXT_MODE_ID } from 'vs/editor/common/modes/modesRegistry';
import { CONTENT_CHANGE_EVENT_BUFFER_DELAY } from 'vs/platform/files/common/files';
import { IModeService, ILanguageSelection } from 'vs/editor/common/services/modeService';
import { IModelService } from 'vs/editor/common/services/modelService';
import { Event, Emitter } from 'vs/base/common/event';
import { RunOnceScheduler } from 'vs/base/common/async';
import { IBackupFileService } from 'vs/workbench/services/backup/common/backup';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/resourceConfiguration';
import { ITextBufferFactory } from 'vs/editor/common/model';
import { createTextBufferFactory } from 'vs/editor/common/model/textModel';
import { IResolvedTextEditorModel } from 'vs/editor/common/services/resolverService';

export class UntitledEditorModel extends BaseTextEditorModel implements IEncodingSupport {

	static DEFAULT_CONTENT_CHANGE_BUFFER_DELAY = CONTENT_CHANGE_EVENT_BUFFER_DELAY;

	private readonly _onDidChangeContent: Emitter<void> = this._register(new Emitter<void>());
	get onDidChangeContent(): Event<void> { return this._onDidChangeContent.event; }

	private readonly _onDidChangeDirty: Emitter<void> = this._register(new Emitter<void>());
	get onDidChangeDirty(): Event<void> { return this._onDidChangeDirty.event; }

	private readonly _onDidChangeEncoding: Emitter<void> = this._register(new Emitter<void>());
	get onDidChangeEncoding(): Event<void> { return this._onDidChangeEncoding.event; }

	private dirty: boolean = false;
	private versionId: number = 0;
	private readonly contentChangeEventScheduler: RunOnceScheduler;
	private configuredEncoding: string;

	constructor(
		private readonly modeId: string,
		private readonly resource: URI,
		private _hasAssociatedFilePath: boolean,
		private readonly initialValue: string,
		private preferredEncoding: string,
		@IModeService modeService: IModeService,
		@IModelService modelService: IModelService,
		@IBackupFileService private readonly backupFileService: IBackupFileService,
		@ITextResourceConfigurationService private readonly configurationService: ITextResourceConfigurationService
	) {
		super(modelService, modeService);

		this.contentChangeEventScheduler = this._register(new RunOnceScheduler(() => this._onDidChangeContent.fire(), UntitledEditorModel.DEFAULT_CONTENT_CHANGE_BUFFER_DELAY));

		this.registerListeners();
	}

	get hasAssociatedFilePath(): boolean {
		return this._hasAssociatedFilePath;
	}

	protected getOrCreateMode(modeService: IModeService, modeId: string, firstLineText?: string): ILanguageSelection {
		if (!modeId || modeId === PLAINTEXT_MODE_ID) {
			return modeService.createByFilepathOrFirstLine(this.resource.fsPath, firstLineText); // lookup mode via resource path if the provided modeId is unspecific
		}

		return super.getOrCreateMode(modeService, modeId, firstLineText);
	}

	private registerListeners(): void {

		// Config Changes
		this._register(this.configurationService.onDidChangeConfiguration(e => this.onConfigurationChange()));
	}

	private onConfigurationChange(): void {
		const configuredEncoding = this.configurationService.getValue<string>(this.resource, 'files.encoding');

		if (this.configuredEncoding !== configuredEncoding) {
			this.configuredEncoding = configuredEncoding;

			if (!this.preferredEncoding) {
				this._onDidChangeEncoding.fire(); // do not fire event if we have a preferred encoding set
			}
		}
	}

	getVersionId(): number {
		return this.versionId;
	}

	getModeId(): string | null {
		if (this.textEditorModel) {
			return this.textEditorModel.getLanguageIdentifier().language;
		}

		return this.modeId;
	}

	getEncoding(): string {
		return this.preferredEncoding || this.configuredEncoding;
	}

	setEncoding(encoding: string): void {
		const oldEncoding = this.getEncoding();
		this.preferredEncoding = encoding;

		// Emit if it changed
		if (oldEncoding !== this.preferredEncoding) {
			this._onDidChangeEncoding.fire();
		}
	}

	isDirty(): boolean {
		return this.dirty;
	}

	// {{SQL CARBON EDIT}}
	// make property public
	public setDirty(dirty: boolean): void {
		if (this.dirty === dirty) {
			return;
		}

		this.dirty = dirty;
		this._onDidChangeDirty.fire();
	}

	getResource(): URI {
		return this.resource;
	}

	revert(): void {
		this.setDirty(false);

		// Handle content change event buffered
		this.contentChangeEventScheduler.schedule();
	}

	load(): Promise<UntitledEditorModel & IResolvedTextEditorModel> {

		// Check for backups first
		return this.backupFileService.loadBackupResource(this.resource).then((backupResource) => {
			if (backupResource) {
				return this.backupFileService.resolveBackupContent(backupResource);
			}

			return undefined;
		}).then(backupTextBufferFactory => {
			const hasBackup = !!backupTextBufferFactory;

			// untitled associated to file path are dirty right away as well as untitled with content
			this.setDirty(this._hasAssociatedFilePath || hasBackup);

			let untitledContents: ITextBufferFactory;
			if (backupTextBufferFactory) {
				untitledContents = backupTextBufferFactory;
			} else {
				untitledContents = createTextBufferFactory(this.initialValue || '');
			}

			// Create text editor model if not yet done
			if (!this.textEditorModel) {
				this.createTextEditorModel(untitledContents, this.resource, this.modeId);
			}

			// Otherwise update
			else {
				this.updateTextEditorModel(untitledContents);
			}

			// Encoding
			this.configuredEncoding = this.configurationService.getValue<string>(this.resource, 'files.encoding');

			// We know for a fact there is a text editor model here
			const textEditorModel = this.textEditorModel!;

			// Listen to content changes
			this._register(textEditorModel.onDidChangeContent(() => this.onModelContentChanged()));

			// Listen to mode changes
			this._register(textEditorModel.onDidChangeLanguage(() => this.onConfigurationChange())); // mode change can have impact on config

			return this as UntitledEditorModel & IResolvedTextEditorModel;
		});
	}

	private onModelContentChanged(): void {
		if (!this.isResolved()) {
			return;
		}

		this.versionId++;

		// mark the untitled editor as non-dirty once its content becomes empty and we do
		// not have an associated path set. we never want dirty indicator in that case.
		if (!this._hasAssociatedFilePath && this.textEditorModel && this.textEditorModel.getLineCount() === 1 && this.textEditorModel.getLineContent(1) === '') {
			this.setDirty(false);
		}

		// turn dirty otherwise
		else {
			this.setDirty(true);
		}

		// Handle content change event buffered
		this.contentChangeEventScheduler.schedule();
	}

	isReadonly(): boolean {
		return false;
	}
}
