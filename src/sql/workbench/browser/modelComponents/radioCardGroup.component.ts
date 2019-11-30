/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/card';

import {
	Component, Inject, ChangeDetectorRef, forwardRef,
	ElementRef, OnDestroy, Input, ViewChildren, QueryList
} from '@angular/core';

import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/workbench/browser/modelComponents/interfaces';
import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import * as azdata from 'azdata';
import { getIconClass } from 'sql/workbench/browser/modelComponents/iconUtils';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import * as DOM from 'vs/base/browser/dom';

@Component({
	templateUrl: decodeURI(require.toUrl('./radioCardGroup.component.html'))

})
export default class RadioCardGroup extends ComponentBase implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	@ViewChildren('cardDiv') cardElements: QueryList<ElementRef>;

	private selectedCard: azdata.RadioCard;
	private focusedCard: azdata.RadioCard;
	private iconClasses: { [key: string]: string } = {};

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef) {
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
			if (this.focusedCard && !this.selectedCard) {
				this.selectCard(this.focusedCard);
			}
			DOM.EventHelper.stop(e, true);
		}
		else if (e.keyCode === KeyCode.LeftArrow || e.keyCode === KeyCode.UpArrow) {
			if (this.focusedCard) {
				this.selectCard(this.findPreviousCard(this.focusedCard));
			}
			DOM.EventHelper.stop(e, true);
		} else if (e.keyCode === KeyCode.RightArrow || e.keyCode === KeyCode.DownArrow) {
			if (this.focusedCard) {
				this.selectCard(this.findNextCard(this.focusedCard));
			}
			DOM.EventHelper.stop(e, true);
		}
	}

	private findPreviousCard(currentCard: azdata.RadioCard): azdata.RadioCard {
		const currentIndex = this.cards.indexOf(currentCard);
		const previousCardIndex = currentIndex === 0 ? this.cards.length - 1 : currentIndex - 1;
		return this.cards[previousCardIndex];
	}

	private findNextCard(currentCard: azdata.RadioCard): azdata.RadioCard {
		const currentIndex = this.cards.indexOf(currentCard);
		const nextCardIndex = currentIndex === this.cards.length - 1 ? 0 : currentIndex + 1;
		return this.cards[nextCardIndex];
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

	public set selectedCardId(newValue: string | undefined) {
		this.setPropertyFromUI<azdata.RadioCardGroupComponentProperties, string | undefined>((props, value) => props.selectedCardId = value, newValue);
	}

	public getIconClass(card: azdata.RadioCard): string {
		if (!this.iconClasses[card.id]) {
			this.iconClasses[card.id] = `cardIcon icon ${getIconClass(card.icon)}`;
		}
		return this.iconClasses[card.id];
	}

	public setProperties(properties: { [key: string]: any }) {
		super.setProperties(properties);
		if (this.selectedCardId) {
			const filteredCards = this.cards.filter(c => { return c.id === this.selectedCardId; });
			if (filteredCards.length === 1) {
				this.selectCard(filteredCards[0]);
			}
		}
	}

	public selectCard(card: azdata.RadioCard): void {
		if (!this.enabled || this.selectedCard === card || this.cards.indexOf(card) === -1) {
			return;
		}
		this.selectedCard = card;
		this._changeRef.detectChanges();
		const cardElement = this.getCardElement(this.selectedCard);
		cardElement.nativeElement.focus();
		this.selectedCardId = card.id;
		this.fireEvent({
			eventType: ComponentEventType.onDidChange,
			args: this.selectedCard.id
		});
	}

	public getCardElement(card: azdata.RadioCard): ElementRef {
		return this.cardElements.toArray()[this.cards.indexOf(card)];
	}

	public getTabIndex(card: azdata.RadioCard): number {
		if (!this.enabled) {
			return -1;
		}
		else if (!this.selectedCard) {
			return this.cards.indexOf(card) === 0 ? 0 : -1;
		} else {
			return card === this.selectedCard ? 0 : -1;
		}
	}

	public isCardSelected(card: azdata.RadioCard): boolean {
		return card === this.selectedCard;
	}

	public onCardFocus(card: azdata.RadioCard): void {
		this.focusedCard = card;
		this._changeRef.detectChanges();
	}

	public onCardBlur(card: azdata.RadioCard): void {
		this.focusedCard = undefined;
		this._changeRef.detectChanges();
	}
}
