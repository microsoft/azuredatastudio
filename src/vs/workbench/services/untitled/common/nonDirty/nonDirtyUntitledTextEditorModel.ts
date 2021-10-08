// {{SQL CARBON EDIT}} This entire file is needed to address #5863
import { bufferToStream, VSBuffer, VSBufferReadableStream } from 'vs/base/common/buffer';
import { assertIsDefined } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import { ITextModel } from 'vs/editor/common/model';
import { createTextBufferFactoryFromStream } from 'vs/editor/common/model/textModel';
import { IModelContentChangedEvent } from 'vs/editor/common/model/textModelEvents';
import { IModelService } from 'vs/editor/common/services/modelService';
import { IModeService } from 'vs/editor/common/services/modeService';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/textResourceConfigurationService';
import { ILabelService } from 'vs/platform/label/common/label';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { UTF8 } from 'vs/workbench/services/textfile/common/encoding';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { UntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';
import { IWorkingCopyBackupService } from 'vs/workbench/services/workingCopy/common/workingCopyBackup';
import { IWorkingCopyService } from 'vs/workbench/services/workingCopy/common/workingCopyService';

export class NonDirtyUntitledTextEditorModel extends UntitledTextEditorModel {
	constructor(
		resource: URI,
		hasAssociatedFilePath: boolean,
		initialValue: string | undefined,
		preferredMode: string | undefined,
		preferredEncoding: string | undefined,
		@IModeService modeService: IModeService,
		@IModelService modelService: IModelService,
		@IWorkingCopyBackupService workingCopyBackupService: IWorkingCopyBackupService,
		@ITextResourceConfigurationService textResourceConfigurationService: ITextResourceConfigurationService,
		@IWorkingCopyService workingCopyService: IWorkingCopyService,
		@ITextFileService textFileService: ITextFileService,
		@ILabelService labelService: ILabelService,
		@IEditorService editorService: IEditorService
	) {
		super(resource, hasAssociatedFilePath, initialValue, preferredMode, preferredEncoding, modeService, modelService, workingCopyBackupService,
			textResourceConfigurationService, workingCopyService, textFileService, labelService, editorService);
	}

	override async resolve(): Promise<void> {
		// Create text editor model if not yet done
		let createdUntitledModel = false;
		let hasBackup = false;
		if (!this.textEditorModel) {
			let untitledContents: VSBufferReadableStream;

			// Check for backups or use initial value or empty
			const backup = await this.workingCopyBackupService.resolve(this);
			if (backup) {
				untitledContents = backup.value;
				hasBackup = true;
			} else {
				untitledContents = bufferToStream(VSBuffer.fromString(this.initialValue || ''));
			}

			// Determine untitled contents based on backup
			// or initial value. We must use text file service
			// to create the text factory to respect encodings
			// accordingly.
			const untitledContentsFactory = await createTextBufferFactoryFromStream(await this.textFileService.getDecodedStream(this.resource, untitledContents, { encoding: UTF8 }));

			this.createTextEditorModel(untitledContentsFactory, this.resource, this.preferredMode);
			createdUntitledModel = true;
		}

		// Otherwise: the untitled model already exists and we must assume
		// that the value of the model was changed by the user. As such we
		// do not update the contents, only the mode if configured.
		else {
			this.updateTextEditorModel(undefined, this.preferredMode);
		}

		// Listen to text model events
		const textEditorModel = assertIsDefined(this.textEditorModel);
		this._register(textEditorModel.onDidChangeContent(e => this.onModelContentChanged(textEditorModel, e)));
		this._register(textEditorModel.onDidChangeLanguage(() => this.onConfigurationChange(true))); // mode change can have impact on config

		// Only adjust name and dirty state etc. if we
		// actually created the untitled model
		if (createdUntitledModel) {

			// Name
			if (hasBackup || this.initialValue) {
				this.updateNameFromFirstLine(textEditorModel);
			}

			this.setDirty(false);

			// If we have initial contents, make sure to emit this
			// as the appropiate events to the outside.
			if (this.initialValue) {
				this._onDidChangeContent.fire();
			}
		}
	}

	protected override onModelContentChanged(textEditorModel: ITextModel, e: IModelContentChangedEvent): void {
		this.setDirty(false);

		// Check for name change if first line changed in the range of 0-FIRST_LINE_NAME_CANDIDATE_MAX_LENGTH columns
		if (e.changes.some(change => (change.range.startLineNumber === 1 || change.range.endLineNumber === 1) && change.range.startColumn <= UntitledTextEditorModel.FIRST_LINE_NAME_CANDIDATE_MAX_LENGTH)) {
			this.updateNameFromFirstLine(textEditorModel);
		}

		// Emit as general content change event
		this._onDidChangeContent.fire();
	}
}
