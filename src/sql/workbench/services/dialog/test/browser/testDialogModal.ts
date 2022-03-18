/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { DialogModal } from 'sql/workbench/services/dialog/browser/dialogModal';
import { Dialog } from 'sql/workbench/services/dialog/common/dialogTypes';

export class TestDialogModal extends DialogModal {

	constructor(
		@ILayoutService layoutService: ILayoutService,
		@IWorkbenchThemeService themeService: IWorkbenchThemeService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IInstantiationService instantiationService: IInstantiationService) {
		// For now just hardcode the dialog since current uses just care about the title property
		super(<Dialog>{ title: 'TestDialogModal' }, '', {}, layoutService, themeService, telemetryService, contextKeyService, clipboardService, logService, textResourcePropertiesService, instantiationService);
	}
}
