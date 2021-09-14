/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { dirname, basename } from 'vs/base/common/path';
import { IEditorOptions } from 'vs/editor/common/config/editorOptions';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { AbstractTextResourceEditor } from 'vs/workbench/browser/parts/editor/textResourceEditor';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { TextResourceEditorInput } from 'vs/workbench/common/editor/textResourceEditorInput';
import { URI } from 'vs/base/common/uri';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { LOG_SCHEME } from 'vs/workbench/contrib/output/common/output';
import { IFileOutputChannelDescriptor } from 'vs/workbench/services/output/common/output';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { IFileService } from 'vs/platform/files/common/files';
import { ILabelService } from 'vs/platform/label/common/label';

export class LogViewerInput extends TextResourceEditorInput {

	static override readonly ID = 'workbench.editorinputs.output';

	override get typeId(): string {
		return LogViewerInput.ID;
	}

	constructor(
		outputChannelDescriptor: IFileOutputChannelDescriptor,
		@ITextModelService textModelResolverService: ITextModelService,
		@ITextFileService textFileService: ITextFileService,
		@IEditorService editorService: IEditorService,
		@IFileService fileService: IFileService,
		@ILabelService labelService: ILabelService
	) {
		super(
			URI.from({ scheme: LOG_SCHEME, path: outputChannelDescriptor.id }),
			basename(outputChannelDescriptor.file.path),
			dirname(outputChannelDescriptor.file.path),
			undefined,
			undefined,
			textModelResolverService,
			textFileService,
			editorService,
			fileService,
			labelService
		);
	}
}

export class LogViewer extends AbstractTextResourceEditor {

	static readonly LOG_VIEWER_EDITOR_ID = 'workbench.editors.logViewer';

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@ITextResourceConfigurationService textResourceConfigurationService: ITextResourceConfigurationService,
		@IThemeService themeService: IThemeService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService,
		@IEditorService editorService: IEditorService
	) {
		super(LogViewer.LOG_VIEWER_EDITOR_ID, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorGroupService, editorService);
	}

	protected override getConfigurationOverrides(): IEditorOptions {
		const options = super.getConfigurationOverrides();
		options.wordWrap = 'off'; // all log viewers do not wrap
		options.folding = false;
		options.scrollBeyondLastLine = false;
		options.renderValidationDecorations = 'editable';
		return options;
	}

	protected getAriaLabel(): string {
		return localize('logViewerAriaLabel', "Log viewer");
	}
}
