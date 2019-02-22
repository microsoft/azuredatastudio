/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardHomeContainer';

import { Component, forwardRef, Input, ChangeDetectorRef, Inject, ViewChild, ContentChild } from '@angular/core';

import { DashboardWidgetContainer } from 'sql/parts/dashboard/containers/dashboardWidgetContainer.component';
import { WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { AngularEventType, IAngularEventingService } from 'sql/platform/angularEventing/common/angularEventingService';
import { DashboardWidgetWrapper } from 'sql/parts/dashboard/contents/dashboardWidgetWrapper.component';
import { ScrollableDirective } from 'sql/base/browser/ui/scrollable/scrollable.directive';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';

import { ConfigurationTarget, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ScrollbarVisibility } from 'vs/editor/common/standalone/standaloneEnums';

@Component({
	selector: 'dashboard-home-container',
	providers: [{ provide: TabChild, useExisting: forwardRef(() => DashboardHomeContainer) }],
	template: `
		<div class="fullsize" style="display: flex; flex-direction: column">
			<div scrollable [horizontalScroll]="ScrollbarVisibility.Hidden" [verticalScroll]="ScrollbarVisibility.Auto">
				<dashboard-widget-wrapper #propertiesClass *ngIf="properties" [collapsable]="true" [_config]="properties"
					style="padding-left: 10px; padding-right: 10px; display: block; flex: 0" [style.height.px]="_propertiesClass?.collapsed ? '30' : '90'">
				</dashboard-widget-wrapper>
				<widget-content style="flex: 1" [scrollContent]="false" [widgets]="widgets" [originalConfig]="tab.originalConfig" [context]="tab.context">
				</widget-content>
			</div>
		</div>
	`
})
export class DashboardHomeContainer extends DashboardWidgetContainer {
	@Input() private properties: WidgetConfig;
	@ViewChild('propertiesClass') private _propertiesClass: DashboardWidgetWrapper;
	@ContentChild(ScrollableDirective) private _scrollable;

	private ScrollbarVisibility = ScrollbarVisibility;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => CommonServiceInterface)) protected dashboardService: DashboardServiceInterface,
		@Inject(IConfigurationService) private _configurationService: IConfigurationService,
		@Inject(IAngularEventingService) private angularEventingService: IAngularEventingService
	) {
		super(_cd);
	}

	ngAfterContentInit() {
		let collapsedVal = this.dashboardService.getSettings<string>(`${this.properties.context}.properties`);
		if (collapsedVal === 'collapsed') {
			this._propertiesClass.collapsed = true;
		}
		this.angularEventingService.onAngularEvent(this.dashboardService.getUnderlyingUri(), event => {
			if (event.event === AngularEventType.COLLAPSE_WIDGET && this._propertiesClass && event.payload === this._propertiesClass.guid) {
				this._propertiesClass.collapsed = !this._propertiesClass.collapsed;
				this._cd.detectChanges();
				this._configurationService.updateValue(`dashboard.${this.properties.context}.properties`,
					this._propertiesClass.collapsed ? 'collapsed' : true, ConfigurationTarget.USER);
			}
		});
	}

	public layout() {
		super.layout();
		if (this._scrollable) {
			this._scrollable.layout();
		}
	}
}
