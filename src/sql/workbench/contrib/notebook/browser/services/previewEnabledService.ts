/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Inject, Injectable } from '@angular/core';
import { Event, Emitter } from 'vs/base/common/event';
import { IPreviewEnabledService } from 'sql/workbench/services/notebook/common/interfaces';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

@Injectable()
export class PreviewEnabledService implements IPreviewEnabledService {

	private _onPreviewEnabled = new Emitter<void>();
	public readonly onPreviewEnabled: Event<void> = this._onPreviewEnabled.event;

	constructor(
		@Inject(IConfigurationService) private _configurationService: IConfigurationService
	) { }

	previewFeaturesEnabled: boolean = this._configurationService.getValue('workbench.enablePreviewFeatures');

	public fireOnPreviewEnabled(): void {
		if (this.previewFeaturesEnabled === true) {
			this._onPreviewEnabled.fire();
		}
	}
}
