/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionDialogService } from 'sql/workbench/services/connection/browser/connectionDialogService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { ILogService } from 'vs/platform/log/common/log';

export class MockConnectionDialogService extends ConnectionDialogService {
	constructor(
		@IInstantiationService _instantiationService: IInstantiationService,
		@ICapabilitiesService _capabilitiesService: ICapabilitiesService,
		@IErrorMessageService _errorMessageService: IErrorMessageService,
		@IConfigurationService _configurationService: IConfigurationService,
		@IClipboardService _clipboardService: IClipboardService,
		@ICommandService _commandService: ICommandService,
		@ILogService _logService: ILogService,
	) {
		super(_instantiationService, _capabilitiesService, _errorMessageService, _configurationService, _clipboardService, _commandService, _logService);
	}
}
