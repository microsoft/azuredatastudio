/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlMainContext, MainThreadExtensionManagementShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { Disposable } from 'vs/base/common/lifecycle';
import { IExtensionManagementService, ILocalExtension } from 'vs/platform/extensionManagement/common/extensionManagement';
import { URI } from 'vs/base/common/uri';
import { IConfigurationService, ConfigurationTarget } from 'vs/platform/configuration/common/configuration';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';
import { ILogService } from 'vs/platform/log/common/log';

@extHostNamedCustomer(SqlMainContext.MainThreadExtensionManagement)
export class MainThreadExtensionManagement extends Disposable implements MainThreadExtensionManagementShape {

	private _obsoleteExtensionApiUsageNotificationShown: boolean = false;

	constructor(
		extHostContext: IExtHostContext,
		@IExtensionManagementService private _extensionService: IExtensionManagementService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@INotificationService private _notificationService: INotificationService,
		@ILogService private readonly logService: ILogService
	) {
		super();
	}

	public $install(vsixPath: string): Thenable<string> {
		return this._extensionService.install(URI.file(vsixPath)).then((value: ILocalExtension) => { return undefined; }, (reason: any) => { return reason ? reason.toString() : undefined; });
	}

	public $showObsoleteExtensionApiUsageNotification(message: string): void {
		this.logService.warn(message);

		if (this._obsoleteExtensionApiUsageNotificationShown) {
			return;
		}

		let enableObsoleteAPINotification = this._configurationService.getValue('workbench')['enableObsoleteApiUsageNotification'];
		if (enableObsoleteAPINotification !== undefined && !enableObsoleteAPINotification) {
			return;
		}

		this._notificationService.prompt(Severity.Warning,
			localize('workbench.generalObsoleteApiNotification', "Some of the loaded extensions are using obsolete APIs, please find the detailed information in the Console tab of Developer Tools window"),
			[{
				label: localize('dontShowAgain', "Don't Show Again"),
				run: () => {
					this._configurationService.updateValue('workbench.enableObsoleteApiUsageNotification', false, ConfigurationTarget.USER);
				},
				isSecondary: true
			}]);
		this._obsoleteExtensionApiUsageNotificationShown = true;
	}
}
