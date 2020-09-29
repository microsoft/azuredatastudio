/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ChangeDetectorRef, Component, ElementRef, forwardRef, Inject, Input, OnDestroy, QueryList, ViewChildren } from '@angular/core';
import * as azdata from 'azdata';
import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';

import 'vs/css!./media/listView';

import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { deepClone } from 'vs/base/common/objects';

@Component({
	templateUrl: decodeURI(require.toUrl('./listView.component.html'))
})

export default class ListViewComponent extends ComponentBase<azdata.ListViewComponentProperties> implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	@ViewChildren('optionDiv') optionElements: QueryList<ElementRef>;

	private focusedOptionId: string | undefined;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
	) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	setLayout(layout: any): void {
		this.layout();
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	onKeyDown(event: KeyboardEvent): void {
		if (!this.enabled || this.options.length === 0) {
			return;
		}
		let e = new StandardKeyboardEvent(event);
		if (e.keyCode === KeyCode.Enter || e.keyCode === KeyCode.Space) {
			if (this.focusedOptionId) {
				this.selectOption(this.focusedOptionId);
			}
			DOM.EventHelper.stop(e, true);
		}
		else if (e.keyCode === KeyCode.LeftArrow || e.keyCode === KeyCode.UpArrow) {
			if (this.focusedOptionId) {
				this.focusOption(this.findPreviousOption(this.focusedOptionId));
			}
			DOM.EventHelper.stop(e, true);
		} else if (e.keyCode === KeyCode.RightArrow || e.keyCode === KeyCode.DownArrow) {
			if (this.focusedOptionId) {
				this.focusOption(this.findNextOption(this.focusedOptionId));
			}
			DOM.EventHelper.stop(e, true);
		}
	}

	private getOptionById(optionId: string): azdata.ListViewOption {
		const filteredOptions = this.options.filter(o => { return o.id === optionId; });
		if (filteredOptions.length === 1) {
			return filteredOptions[0];
		} else {
			throw new Error(`There should be one and only one matching option for the giving option id, actual number: ${filteredOptions.length}, option id: ${optionId}.`);
		}
	}

	private findPreviousOption(optionId: string): string {
		const currentIndex = this.options.indexOf(this.getOptionById(optionId));
		const previousOptionIndex = currentIndex === 0 ? this.options.length - 1 : currentIndex - 1;
		return this.options[previousOptionIndex].id;
	}

	private findNextOption(optionId: string): string {
		const currentIndex = this.options.indexOf(this.getOptionById(optionId));
		const nextOptionIndex = currentIndex === this.options.length - 1 ? 0 : currentIndex + 1;
		return this.options[nextOptionIndex].id;
	}

	public get options(): azdata.ListViewOption[] {
		return this.getProperties().options ?? [];
	}

	public get width(): string | number | undefined {
		return this.getProperties().width ?? undefined;
	}

	public get height(): string | number | undefined {
		return this.getProperties().height ?? undefined;
	}

	public get styles(): azdata.CssStyles | undefined {
		return this.getProperties().CSSStyles ?? undefined;
	}

	public get title(): azdata.ListViewTitle {
		return this.getProperties().title ?? undefined;
	}

	public get selectedOptionId(): string | undefined {
		return this.getProperties().selectedOptionId ?? undefined;
	}

	public setProperties(properties: { [key: string]: any }) {
		super.setProperties(properties);
		// This is the entry point for the extension to set the selectedCardId
		if (this.selectedOptionId) {
			this.selectOption(this.selectedOptionId);
		}
	}

	public selectOption(optionId: string): void {
		if (!this.enabled || this.options.length === 0) {
			return;
		}
		const optionElement = this.getOptionElement(optionId);
		optionElement.nativeElement.focus();
		this.setPropertyFromUI<string | undefined>((props, value) => props.selectedOptionId = value, optionId);
		this._changeRef.detectChanges();
		this.fireEvent({
			eventType: ComponentEventType.onDidClick,
			args: {
				option: deepClone(this.getOptionById(optionId))
			}
		});
	}

	public getOptionElement(optionId: string): ElementRef {
		const option = this.getOptionById(optionId);
		return this.optionElements.toArray()[this.options.indexOf(option)];
	}

	public getTabIndex(optionId: string): number {
		if (!this.enabled) {
			return -1;
		}
		else if (!this.selectedOptionId) {
			return this.options.indexOf(this.getOptionById(optionId)) === 0 ? 0 : -1;
		} else {
			return optionId === this.selectedOptionId ? 0 : -1;
		}
	}

	public isOptionSelected(optionId: string): boolean {
		return optionId === this.selectedOptionId;
	}

	public onOptionFocus(optionId: string): void {
		this.focusedOptionId = optionId;
	}

	public onOptionBlur(optionId: string): void {
		this.focusedOptionId = undefined;
	}

	public focusOption(optionId: string): void {
		if (!this.enabled || this.options.length === 0) {
			return;
		}
		this.focusedOptionId = optionId;
		const optionElement = this.getOptionElement(optionId);
		optionElement.nativeElement.focus();
		this._changeRef.detectChanges();
	}


}
