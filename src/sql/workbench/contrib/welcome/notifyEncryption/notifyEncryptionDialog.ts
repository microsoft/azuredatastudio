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

export class NotifyEncryptionDialog extends ErrorMessageDialog {
	private static NOTIFY_ENCRYPT_SHOWN = 'workbench.notifyEncryptionShown';
	private static NOTIFY_ENCRYPT_LINK = 'https://aka.ms/azuredatastudio-connection';

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
		if (this._storageService.get(NotifyEncryptionDialog.NOTIFY_ENCRYPT_SHOWN, StorageScope.GLOBAL)) {
			return;
		}

		this._storageService.store(NotifyEncryptionDialog.NOTIFY_ENCRYPT_SHOWN, true, StorageScope.GLOBAL, StorageTarget.MACHINE);

		if (!this._connectionManagementService.getConnections()?.some(conn => conn.providerName === mssqlProviderName)) {
			return;
		}

		super.open(TelemetryView.NotifyEncryptionDialog, Severity.Info,
			localize('notifyEncryption.title', 'Important Update'),
			localize('notifyEncryption.message', 'Azure Data Studio now has encryption enabled by default for all SQL Server connections. This may result in your existing connections no longer working unless certain Encryption related connection properties are changed.{0}We recommend you review the link below for more details.', '\n\n'));
	}

	protected override updateDialogBody(): void {
		super.updateDialogBody();
		let moreInfoLink = DOM.append(this.getBody()!, DOM.$('.more-info'));
		this._instantiationService.createInstance(Link, moreInfoLink,
			{
				label: localize('notifyEncryption.moreInfoLink', 'More information'),
				href: NotifyEncryptionDialog.NOTIFY_ENCRYPT_LINK
			}, undefined);
	}
}
