/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Modal } from 'sql/workbench/browser/modal/modal';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { BackupModule } from 'sql/workbench/contrib/backup/browser/backup.module';
import { BACKUP_SELECTOR } from 'sql/workbench/contrib/backup/browser/backup.component';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';

import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { bootstrapAngular } from 'sql/workbench/services/bootstrap/browser/bootstrapService';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { append, $ } from 'vs/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';

export class BackupDialog extends Modal {
	private _body: HTMLElement;
	private _backupTitle: string;
	private _moduleRef: any;

	constructor(
		@IThemeService themeService: IThemeService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super('', TelemetryKeys.Backup, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { isAngular: true, hasErrors: true });
	}

	protected renderBody(container: HTMLElement) {
		this._body = append(container, $('.backup-dialog'));
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);

		// Add angular component template to dialog body
		this.bootstrapAngular(this._body);
	}

	/**
	 * Get the bootstrap params and perform the bootstrap
	 */
	private bootstrapAngular(bodyContainer: HTMLElement) {
		this._instantiationService.invokeFunction(bootstrapAngular,
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
