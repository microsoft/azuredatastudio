/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardWidgetContainer';

import { Component, Inject, Input, forwardRef, ViewChild, ElementRef, ViewChildren, QueryList, OnDestroy, ChangeDetectorRef, EventEmitter, OnChanges, AfterContentInit } from '@angular/core';
import { NgGridConfig, NgGrid, NgGridItem } from 'angular2-grid';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { TabConfig, WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { DashboardWidgetWrapper } from 'sql/parts/dashboard/contents/dashboardWidgetWrapper.component';
import { subscriptionToDisposable } from 'sql/base/common/lifecycle';
import { DashboardTab } from 'sql/parts/dashboard/common/interfaces';
import { WidgetContent } from 'sql/parts/dashboard/contents/widgetContent.component';

import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { ConfigurationTarget } from 'vs/platform/configuration/common/configuration';
import * as objects from 'vs/base/common/objects';
import Event, { Emitter } from 'vs/base/common/event';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { getContentHeight, addDisposableListener, EventType } from 'vs/base/browser/dom';

@Component({
	selector: 'dashboard-widget-container',
	providers: [{ provide: DashboardTab, useExisting: forwardRef(() => DashboardWidgetContainer) }],
	template: `
		<div class="scroll-container" #scrollContainer>
			<div class="scrollable" #scrollable>
				<widget-content [widgets]="widgets" [originalConfig]="tab.originalConfig" [context]="tab.context">
				</widget-content>
			</div>
		</div>
	`
})
export class DashboardWidgetContainer extends DashboardTab implements OnDestroy, OnChanges, AfterContentInit {
	@Input() private tab: TabConfig;
	private widgets: WidgetConfig[];
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	private _scrollableElement: ScrollableElement;

	@ViewChild(WidgetContent) private _widgetContent: WidgetContent;

	@ViewChild('scrollable', { read: ElementRef }) private _scrollable: ElementRef;
	@ViewChild('scrollContainer', { read: ElementRef }) private _scrollContainer: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) protected _cd: ChangeDetectorRef
	) {
		super();
	}

	ngOnChanges() {
		if (this.tab.container) {
			this.widgets = Object.values(this.tab.container)[0];
			this._cd.detectChanges();
		}
	}

	ngAfterContentInit(): void {
		this._register(this._widgetContent.onResize(() => {
			this._onResize.fire();
		}));
	}

	ngAfterViewInit() {
		let container = this._scrollContainer.nativeElement as HTMLElement;
		let scrollable = this._scrollable.nativeElement as HTMLElement;
		container.removeChild(scrollable);

		this._scrollableElement = new ScrollableElement(scrollable, {
			horizontal: ScrollbarVisibility.Hidden,
			vertical: ScrollbarVisibility.Auto,
			useShadows: false
		});

		this._scrollableElement.onScroll(e => {
			scrollable.style.bottom = e.scrollTop + 'px';
		});

		container.appendChild(this._scrollableElement.getDomNode());
		let initalHeight = getContentHeight(scrollable);
		this._scrollableElement.setScrollDimensions({
			scrollHeight: getContentHeight(scrollable),
			height: getContentHeight(container)
		});

		this._register(addDisposableListener(window, EventType.RESIZE, () => {
			// Todo: Need to set timeout because we have to make sure that the grids have already rearraged before the getContentHeight gets called.
			setTimeout(() => {
				this._scrollableElement.setScrollDimensions({
					scrollHeight: getContentHeight(scrollable),
					height: getContentHeight(container)
				});
			}, 100);
		}));

		// unforunately because of angular rendering behavior we need to do a double check to make sure nothing changed after this point
		setTimeout(() => {
			let currentheight = getContentHeight(scrollable);
			if (initalHeight !== currentheight) {
				this._scrollableElement.setScrollDimensions({
					scrollHeight: currentheight,
					height: getContentHeight(container)
				});
			}
		}, 200);
	}

	ngOnDestroy() {
		this.dispose();
	}

	public get id(): string {
		return this.tab.id;
	}

	public get editable(): boolean {
		return this.tab.editable;
	}

	public layout() {
		let container = this._scrollContainer.nativeElement as HTMLElement;
		let scrollable = this._scrollable.nativeElement as HTMLElement;
		this._scrollableElement.setScrollDimensions({
			scrollHeight: getContentHeight(scrollable),
			height: getContentHeight(container)
		});
		this._widgetContent.layout();
	}

	public refresh(): void {
		this._widgetContent.layout();
	}

	public enableEdit(): void {
		this._widgetContent.enableEdit();
	}
}
