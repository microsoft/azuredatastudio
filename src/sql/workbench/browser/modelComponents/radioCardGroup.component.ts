/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ChangeDetectorRef, Component, ElementRef, forwardRef, Inject, Input, OnDestroy, QueryList, ViewChildren } from '@angular/core';
import * as azdata from 'azdata';
import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { createIconCssClass } from 'sql/workbench/browser/modelComponents/iconUtils';
import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import 'vs/css!./media/card';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';

@Component({
	templateUrl: decodeURI(require.toUrl('./radioCardGroup.component.html'))

})
export default class RadioCardGroup extends ComponentBase implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	@ViewChildren('cardDiv') cardElements: QueryList<ElementRef>;

	private focusedCardId: string | undefined;
	private iconClasses: { [key: string]: string } = {};

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
		Object.keys(this.iconClasses).forEach((key) => {
			DOM.removeCSSRulesContainingSelector(this.iconClasses[key]);
		});
		this.baseDestroy();
	}

	onKeyDown(event: KeyboardEvent): void {
		if (!this.enabled || this.cards.length === 0) {
			return;
		}

		let e = new StandardKeyboardEvent(event);
		if (e.keyCode === KeyCode.Enter || e.keyCode === KeyCode.Space) {
			if (this.focusedCardId && !this.selectedCardId) {
				this.selectCard(this.focusedCardId);
			}
			DOM.EventHelper.stop(e, true);
		}
		else if (e.keyCode === KeyCode.LeftArrow || e.keyCode === KeyCode.UpArrow) {
			if (this.focusedCardId) {
				this.selectCard(this.findPreviousCard(this.focusedCardId));
			}
			DOM.EventHelper.stop(e, true);
		} else if (e.keyCode === KeyCode.RightArrow || e.keyCode === KeyCode.DownArrow) {
			if (this.focusedCardId) {
				this.selectCard(this.findNextCard(this.focusedCardId));
			}
			DOM.EventHelper.stop(e, true);
		}
	}

	private getCardById(cardId: string): azdata.RadioCard {
		const filteredCards = this.cards.filter(c => { return c.id === cardId; });
		if (filteredCards.length === 1) {
			return filteredCards[0];
		} else {
			throw new Error(`There should be one and only one matching card for the giving card id, actual number: ${filteredCards.length}, card id: ${cardId}.`);
		}
	}

	private findPreviousCard(cardId: string): string {
		const currentIndex = this.cards.indexOf(this.getCardById(cardId));
		const previousCardIndex = currentIndex === 0 ? this.cards.length - 1 : currentIndex - 1;
		return this.cards[previousCardIndex].id;
	}

	private findNextCard(cardId: string): string {
		const currentIndex = this.cards.indexOf(this.getCardById(cardId));
		const nextCardIndex = currentIndex === this.cards.length - 1 ? 0 : currentIndex + 1;
		return this.cards[nextCardIndex].id;
	}

	public get cards(): azdata.RadioCard[] {
		return this.getPropertyOrDefault<azdata.RadioCardGroupComponentProperties, azdata.RadioCard[]>((props) => props.cards, []);
	}

	public get cardWidth(): string | undefined {
		return this.getPropertyOrDefault<azdata.RadioCardGroupComponentProperties, string | undefined>((props) => props.cardWidth, undefined);
	}

	public get cardHeight(): string | undefined {
		return this.getPropertyOrDefault<azdata.RadioCardGroupComponentProperties, string | undefined>((props) => props.cardHeight, undefined);
	}

	public get iconWidth(): string | undefined {
		return this.getPropertyOrDefault<azdata.RadioCardGroupComponentProperties, string | undefined>((props) => props.iconWidth, undefined);
	}

	public get iconHeight(): string | undefined {
		return this.getPropertyOrDefault<azdata.RadioCardGroupComponentProperties, string | undefined>((props) => props.iconHeight, undefined);
	}

	public get selectedCardId(): string | undefined {
		return this.getPropertyOrDefault<azdata.RadioCardGroupComponentProperties, string | undefined>((props) => props.selectedCardId, undefined);
	}

	public getIconClass(cardId: string): string {
		if (!this.iconClasses[cardId]) {
			this.iconClasses[cardId] = `cardIcon icon ${createIconCssClass(this.getCardById(cardId).icon)}`;
		}
		return this.iconClasses[cardId];
	}

	public setProperties(properties: { [key: string]: any }) {
		super.setProperties(properties);
		// This is the entry point for the extension to set the selectedCardId
		if (this.selectedCardId) {
			this.selectCard(this.selectedCardId);
		}
	}

	public selectCard(cardId: string): void {
		if (!this.enabled || this.cards.length === 0) {
			return;
		}
		const cardElement = this.getCardElement(cardId);
		cardElement.nativeElement.focus();
		this.setPropertyFromUI<azdata.RadioCardGroupComponentProperties, string | undefined>((props, value) => props.selectedCardId = value, cardId);
		this._changeRef.detectChanges();
		this.fireEvent({
			eventType: ComponentEventType.onDidChange,
			args: cardId
		});
	}

	public getCardElement(cardId: string): ElementRef {
		const card = this.getCardById(cardId);
		return this.cardElements.toArray()[this.cards.indexOf(card)];
	}

	public getTabIndex(cardId: string): number {
		if (!this.enabled) {
			return -1;
		}
		else if (!this.selectedCardId) {
			return this.cards.indexOf(this.getCardById(cardId)) === 0 ? 0 : -1;
		} else {
			return cardId === this.selectedCardId ? 0 : -1;
		}
	}

	public isCardSelected(cardId: string): boolean {
		return cardId === this.selectedCardId;
	}

	public onCardFocus(cardId: string): void {
		this.focusedCardId = cardId;
	}

	public onCardBlur(cardId: string): void {
		this.focusedCardId = undefined;
	}
}
