/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnInit, Inject, forwardRef, ChangeDetectorRef, ElementRef } from '@angular/core';

import { DashboardPage } from 'sql/workbench/contrib/dashboard/browser/core/dashboardPage.component';
import { BreadcrumbClass } from 'sql/workbench/contrib/dashboard/browser/services/breadcrumb.service';
import { IBreadcrumbService } from 'sql/base/browser/ui/breadcrumb/interfaces';
import { DashboardServiceInterface } from 'sql/workbench/contrib/dashboard/browser/services/dashboardServiceInterface.service';
import { WidgetConfig } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { IAngularEventingService } from 'sql/platform/angularEventing/browser/angularEventingService';

import * as colors from 'vs/platform/theme/common/colorRegistry';
import * as nls from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ILogService } from 'vs/platform/log/common/log';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { RefreshWidgetAction, EditDashboardAction, BackupToolbarAction, RestoreToolbarAction, ManageExtensionsToolbarAction, NewQueryAction, NewNotebookToolbarAction } from 'sql/workbench/contrib/dashboard/browser/core/actions';
import { Taskbar, ITaskbarContent } from 'sql/base/browser/ui/taskbar/taskbar';
import { showBackup } from 'sql/workbench/contrib/backup/browser/backupActions';
import { ICommandService } from 'vs/platform/commands/common/commands';

export class DatabaseDashboardPage extends DashboardPage implements OnInit {
	protected propertiesWidget: WidgetConfig = {
		name: nls.localize('databasePageName', "DATABASE DASHBOARD"),
		widget: {
			'properties-widget': undefined
		},
		context: 'database',
		background_color: colors.editorBackground,
		border: 'none',
		fontSize: '14px',
		padding: '5px 0 0 0',
		provider: undefined,
		edition: undefined
	};

	protected readonly context = 'database';
	protected _backupAction: BackupToolbarAction;

	constructor(
		@Inject(forwardRef(() => IBreadcrumbService)) private _breadcrumbService: IBreadcrumbService,
		@Inject(forwardRef(() => CommonServiceInterface)) dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(INotificationService) notificationService: INotificationService,
		@Inject(IAngularEventingService) angularEventingService: IAngularEventingService,
		@Inject(IConfigurationService) configurationService: IConfigurationService,
		@Inject(ILogService) logService: ILogService,
		@Inject(IInstantiationService) _instantiationService: IInstantiationService,
		@Inject(ICommandService) commandService: ICommandService,
	) {
		super(dashboardService, el, _cd, notificationService, angularEventingService, configurationService, logService, _instantiationService, commandService);
		this._register(dashboardService.onUpdatePage(() => {
			this.refresh(true);
			this._cd.detectChanges();
		}));
	}

	ngOnInit() {
		this.init();
		this._breadcrumbService.setBreadcrumbs(BreadcrumbClass.DatabasePage);
	}

	protected createTaskbar(parentElement: HTMLElement): void {
		// Create QueryTaskbar
		let taskbarContainer = DOM.append(parentElement, DOM.$('div'));
		this.taskbar = this._register(new Taskbar(taskbarContainer));
		this._backupAction = new BackupToolbarAction(this.backup, this, 'backup');
		this._restoreAction = new RestoreToolbarAction(this.restore, this, 'restore');
		this._newQueryAction = new NewQueryAction(this.newQuery, this, 'new-query-toolbar');
		this._newNotebookAction = new NewNotebookToolbarAction(this.newNotebook, this);
		this._editAction = new EditDashboardAction(this.enableEdit, this, 'edit-toolbar');
		this._refreshAction = new RefreshWidgetAction(this.refresh, this, 'refresh-toolbar');
		this._manageExtensionsAction = new ManageExtensionsToolbarAction(this.manageExtensions, this, 'manage-extensions-toolbar');
		this.setTaskbarContent();
	}

	protected setTaskbarContent(): void {
		// Create HTML Elements for the taskbar
		let separator = Taskbar.createTaskbarSeparator();

		// Set the content in the order we desire
		let content: ITaskbarContent[] = [
			{ action: this._newQueryAction },
			{ action: this._newNotebookAction },
			{ element: separator },
			{ action: this._refreshAction },
			{ action: this._editAction },
			{ action: this._manageExtensionsAction }
		];

		if (!this.serverInfo.isCloud && this.serverInfo.engineEditionId !== 11) {
			content.unshift({ action: this._restoreAction });
			content.unshift({ action: this._backupAction });
		}

		this.taskbar.setContent(content);
	}

	public backup(): void {
		console.error('clicked backup');
		this._instantiationService.invokeFunction(showBackup, this.connectionManagementService.connectionInfo.connectionProfile);
	}
}
