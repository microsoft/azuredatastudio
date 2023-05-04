/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Severity from 'vs/base/common/severity';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ErrorMessageDialog } from 'sql/workbench/services/errorMessage/browser/errorMessageDialog';
import { Link } from 'vs/platform/opener/browser/link';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { TelemetryView } from 'sql/platform/telemetry/common/telemetryKeys';
import { NOTIFY_TENANTINFO_LINK, NOTIFY_TENANTINFO_SHOWN } from 'sql/workbench/contrib/welcome/notifications/constants';

export class NotifyTenantInfoDialog extends ErrorMessageDialog {
	constructor(
		@IThemeService themeService: IThemeService,
		@IClipboardService clipboardService: IClipboardService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IOpenerService openerService: IOpenerService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IStorageService private _storageService: IStorageService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
	) {
		super(themeService, clipboardService, layoutService, telemetryService, contextKeyService, logService, textResourcePropertiesService, openerService);
	}

	public override open(): void {
		if (this._storageService.get(NOTIFY_TENANTINFO_SHOWN, StorageScope.APPLICATION)) {
			return;
		}

		this._storageService.store(NOTIFY_TENANTINFO_SHOWN, true, StorageScope.APPLICATION, StorageTarget.MACHINE);

		if (!this._connectionManagementService.getConnections()?.some(conn => conn.providerName === mssqlProviderName && conn.authenticationType === 'AzureMFA')) {
			return;
		}

		super.open(TelemetryView.NotifyTenantInfoDialog, Severity.Info,
			localize('notifyTenantInfo.title', 'Important Update'),
			localize('notifyTenantInfo.message', `Azure Data Studio has made design changes in the way access tokens are fetched from Azure Active Directory and you will not be asked to select 'Azure AD Tenant' information when connecting to Azure SQL instances. Tenant information will now be retrieved from the server during login.`, '\n\n'));
	}

	protected override updateDialogBody(): void {
		super.updateDialogBody();
		let moreInfoLink = DOM.append(this.getBody()!, DOM.$('.more-info'));
		this._instantiationService.createInstance(Link, moreInfoLink,
			{
				label: localize('notifyTenantInfo.moreInfoLink', 'More information'),
				href: NOTIFY_TENANTINFO_LINK
			}, undefined);
	}
}
