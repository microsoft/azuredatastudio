/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionDialogWidget } from 'sql/workbench/services/connection/browser/connectionDialogWidget';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';

export class TestConnectionDialogWidget extends ConnectionDialogWidget {
	constructor(
		providerDisplayNameOptions: string[],
		selectedProviderType: string,
		providerNameToDisplayNameMap: { [providerDisplayName: string]: string },
		@IInstantiationService _instantiationService: IInstantiationService,
		@IConnectionManagementService _connectionManagementService: IConnectionManagementService,
		@IContextMenuService _contextMenuService: IContextMenuService,
		@IContextViewService _contextViewService: IContextViewService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IThemeService themeService: IThemeService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IConfigurationService configurationService: IConfigurationService,
		@ICapabilitiesService capabilitiesService: ICapabilitiesService
	) {
		super(providerDisplayNameOptions, selectedProviderType, providerNameToDisplayNameMap, _instantiationService, _connectionManagementService, _contextMenuService, _contextViewService, themeService, layoutService, telemetryService, contextKeyService, clipboardService, logService, textResourcePropertiesService, configurationService, capabilitiesService);
	}
}
