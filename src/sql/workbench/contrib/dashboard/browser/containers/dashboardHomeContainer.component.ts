/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardHomeContainer';

import { Component, forwardRef, Input, ChangeDetectorRef, Inject, ViewChild, ContentChild, ElementRef } from '@angular/core';

import { DashboardWidgetContainer } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardWidgetContainer.component';
import { WidgetConfig } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { DashboardServiceInterface } from 'sql/workbench/contrib/dashboard/browser/services/dashboardServiceInterface.service';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { AngularEventType, IAngularEventingService } from 'sql/platform/angularEventing/browser/angularEventingService';
import { DashboardWidgetWrapper } from 'sql/workbench/contrib/dashboard/browser/contents/dashboardWidgetWrapper.component';
import { ScrollableDirective } from 'sql/base/browser/ui/scrollable/scrollable.directive';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';

import { ConfigurationTarget, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { DASHBOARD_BORDER } from 'vs/workbench/common/theme';
import { IColorTheme } from 'vs/platform/theme/common/themeService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';

@Component({
	selector: 'dashboard-home-container',
	providers: [{ provide: TabChild, useExisting: forwardRef(() => DashboardHomeContainer) }],
	template: `
		<div class="fullsize" style="display: flex; flex-direction: column">
			<div scrollable [horizontalScroll]="${ScrollbarVisibility.Hidden}" [verticalScroll]="${ScrollbarVisibility.Auto}">
				<div #propertiesContainer style="padding-bottom: 5px">
					<dashboard-widget-wrapper #propertiesClass *ngIf="properties" [collapsable]="true" [bottomCollapse]="true" [toggleMore]="false" [_config]="properties"
						style="padding-left: 10px; padding-right: 10px; display: block; flex: 0;" [style.height.px]="_propertiesClass?.collapsed ? '30' : '90'">
					</dashboard-widget-wrapper>
				</div>
				<widget-content style="flex: 1" [scrollContent]="false" [widgets]="widgets" [originalConfig]="tab.originalConfig" [context]="tab.context">
				</widget-content>
			</div>
		</div>
	`
})
export class DashboardHomeContainer extends DashboardWidgetContainer {
	@Input() private properties: WidgetConfig;
	@ViewChild('propertiesClass') private _propertiesClass: DashboardWidgetWrapper;
	@ViewChild('propertiesContainer') private _propertiesContainer: ElementRef;
	@ContentChild(ScrollableDirective) private _scrollable: ScrollableDirective;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => CommonServiceInterface)) protected dashboardService: DashboardServiceInterface,
		@Inject(IConfigurationService) private _configurationService: IConfigurationService,
		@Inject(IAngularEventingService) private angularEventingService: IAngularEventingService,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService
	) {
		super(_cd);
	}

	ngAfterContentInit() {
		this.updateTheme(this.themeService.getColorTheme());
		this._register(this.themeService.onDidColorThemeChange((event: IColorTheme) => {
			this.updateTheme(event);
		}));

		const collapsedVal = this.dashboardService.getSettings<string>(`${this.properties.context}.properties`);
		if (collapsedVal === 'collapsed') {
			this._propertiesClass.collapsed = true;
		}
		this._register(this.angularEventingService.onAngularEvent(this.dashboardService.getUnderlyingUri())(event => {
			if (event.event === AngularEventType.COLLAPSE_WIDGET && this._propertiesClass && event.payload === this._propertiesClass.guid) {
				this._propertiesClass.collapsed = !this._propertiesClass.collapsed;
				this._cd.detectChanges();
				this._configurationService.updateValue(`dashboard.${this.properties.context}.properties`,
					this._propertiesClass.collapsed ? 'collapsed' : true, ConfigurationTarget.USER);
			}
		}));
	}

	public layout() {
		super.layout();
		if (this._scrollable) {
			this._scrollable.layout();
		}
	}

	private updateTheme(theme: IColorTheme): void {
		const border = theme.getColor(DASHBOARD_BORDER);
		this._propertiesContainer.nativeElement.style.borderBottom = '1px solid ' + border.toString();
	}

	public refresh(): void {
		super.refresh();
		this._propertiesClass.refresh();
	}
}
