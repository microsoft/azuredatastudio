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
import { IWindowService } from 'vs/platform/windows/common/windows';

@extHostNamedCustomer(SqlMainContext.MainThreadExtensionManagement)
export class MainThreadExtensionManagement extends Disposable implements MainThreadExtensionManagementShape {

	private _obsoleteExtensionApiUsageNotificationShown: boolean = false;

	constructor(
		extHostContext: IExtHostContext,
		@IExtensionManagementService private _extensionService: IExtensionManagementService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@INotificationService private _notificationService: INotificationService,
		@IWindowService protected readonly _windowService: IWindowService
	) {
		super();
	}

	public $install(vsixPath: string): Thenable<string> {
		return this._extensionService.install(URI.file(vsixPath)).then((value: ILocalExtension) => { return undefined; }, (reason: any) => { return reason ? reason.toString() : undefined; });
	}

	public $showObsoleteExtensionApiUsageNotification(message: string): void {
		console.warn(message);

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
			}, {
				label: localize('devTools', "Open Developer Tools"),
				run: () => this._windowService.openDevTools()
			}]);
		this._obsoleteExtensionApiUsageNotificationShown = true;
	}
}
