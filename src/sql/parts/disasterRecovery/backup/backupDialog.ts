/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Modal } from 'sql/workbench/browser/modal/modal';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { BackupModule } from 'sql/parts/disasterRecovery/backup/backup.module';
import { BACKUP_SELECTOR } from 'sql/parts/disasterRecovery/backup/backup.component';
import { attachModalDialogStyler } from 'sql/platform/theme/common/styler';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import * as TelemetryKeys from 'sql/common/telemetryKeys';

import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { Builder } from 'sql/base/browser/builder';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { bootstrapAngular } from 'sql/services/bootstrap/bootstrapService';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';

export class BackupDialog extends Modal {
	private _bodyBuilder: Builder;
	private _backupTitle: string;
	private _uniqueSelector: string;
	private _moduleRef: any;

	constructor(
		@IThemeService themeService: IThemeService,
		@IPartService partService: IPartService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IClipboardService clipboardService: IClipboardService
	) {
		super('', TelemetryKeys.Backup, partService, telemetryService, clipboardService, themeService, contextKeyService, { isAngular: true, hasErrors: true });
	}

	protected renderBody(container: HTMLElement) {
		new Builder(container).div({ 'class': 'backup-dialog' }, (builder) => {
			this._bodyBuilder = builder;
		});
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);

		// Add angular component template to dialog body
		this.bootstrapAngular(this._bodyBuilder.getHTMLElement());
	}

	/**
	 * Get the bootstrap params and perform the bootstrap
	 */
	private bootstrapAngular(bodyContainer: HTMLElement) {
		this._uniqueSelector = bootstrapAngular(this._instantiationService,
			BackupModule,
			bodyContainer,
			BACKUP_SELECTOR,
			undefined,
			undefined,
			(moduleRef) => this._moduleRef = moduleRef);
	}

	public hideError() {
		this.showError('');
	}

	public showError(err: string) {
		this.showError(err);
	}

	/* Overwrite escape key behavior */
	protected onClose() {
		this.close();
	}

	/**
	 * Clean up the module and DOM element and close the dialog
	 */
	public close() {
		this.hide();
	}

	public dispose(): void {
		super.dispose();
		if (this._moduleRef) {
			this._moduleRef.destroy();
		}
	}

	/**
	 * Open the dialog
	 */
	public open(connection: IConnectionProfile) {
		this._backupTitle = 'Backup database - ' + connection.serverName + ':' + connection.databaseName;
		this.title = this._backupTitle;
		this.show();
	}

	protected layout(height?: number): void {
		// Nothing currently laid out in this class
	}

}