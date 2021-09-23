import 'vs/css!./media/card';
import * as DOM from 'vs/base/browser/dom';
import { IColorTheme, ICssStyleCollector, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { inputBorder, inputValidationInfoBorder } from 'vs/platform/theme/common/colorRegistry';
import { calloutDialogBodyBackground } from 'sql/platform/theme/common/colorRegistry';
import { Widget } from 'vs/base/browser/ui/widget';
import { Event, Emitter } from 'vs/base/common/event';

export class Card extends Widget {
	protected _cardElement: HTMLElement;
	protected _contentWrapper: HTMLElement;
	protected _radioButton: RadioButton;
	protected _radioButtonContainer: HTMLElement;

	protected _selected: boolean = false;
	protected _hasFocus: boolean;
	protected _enabled: boolean = true;

	private _onChange = new Emitter<boolean>();
	public readonly onChange: Event<boolean> = this._onChange.event;

	constructor(container: HTMLElement) {
		super();

		// Contains all the content added to the card via the content property
		this._contentWrapper = DOM.$<HTMLDivElement>('div');

		this._cardElement = DOM.$<HTMLDivElement>('div');
		this._cardElement.appendChild(this._contentWrapper);

		this._radioButton = new RadioButton(true);
		this._radioButtonContainer = this._cardElement.appendChild(this._radioButton.content);

		container.appendChild(this._cardElement);

		this.onclick(this._cardElement, e => this.onclicked());

		this.update();
	}

	private onclicked(): void {
		this.selected = !this.selected; //toggle value
		this.update();
	}

	private update(): void {
		this._radioButton.selected = this.selected;
		this._radioButtonContainer.replaceWith(this._radioButton.content);

		this._cardElement.className = this.cardClass;

		if (this.enabled) {
			this._cardElement.style.cursor = 'pointer';
		} else {
			this._cardElement.style.cursor = 'auto';
		}
	}

	public set selected(selected: boolean) {
		if (this.selected !== selected) {
			this._selected = selected;
			this._onChange.fire(this.selected);
		}
	}

	public get selected(): boolean {
		return this._selected;
	}

	public get cardElement(): HTMLElement {
		return this._cardElement;
	}

	public set content(content: HTMLElement) {
		this._contentWrapper.firstChild?.remove();
		this._contentWrapper.appendChild(content);
	}

	public get content(): HTMLElement {
		return <HTMLElement>this._contentWrapper.firstChild;
	}

	public get showRadioButton(): boolean {
		return this.selected || (this.enabled && this._hasFocus);
	}

	public set enabled(val: boolean) {
		this._enabled = val;
	}

	public get enabled(): boolean {
		return this._enabled;
	}

	protected get cardClass(): string {
		return `selectable-card ${this.selected ? 'selected' : ''}`;
	}

	protected get contentWrapperClass(): string {
		return `selectable-card-content-wrapper`;
	}
}

class RadioButton {
	private readonly SHOWRADIOBUTTON_DEFAULT: boolean = true;
	private readonly SELECTED_DEFAULT: boolean = false;

	private _indicatorContainer: HTMLSpanElement;
	private _indicatorSelection: HTMLDivElement;

	constructor(private _display?: boolean, private _selected?: boolean) {
		this._indicatorContainer = DOM.$<HTMLSpanElement>('span');
		this._indicatorContainer.classList.add('selectable-card-indicator-container');
		this._indicatorContainer.hidden = !this._display ?? !this.SHOWRADIOBUTTON_DEFAULT;

		this._indicatorSelection = DOM.$<HTMLDivElement>('div');
		this._indicatorSelection.classList.add('selectable-card-indicator');
		this._indicatorSelection.hidden = !this._selected ?? !this.SELECTED_DEFAULT;

		this._indicatorContainer.appendChild(this._indicatorSelection);
	}

	public set selected(selected: boolean) {
		this._selected = selected;
		this._indicatorSelection.hidden = !this._selected;
	}

	public get selected(): boolean {
		return this._selected;
	}

	public set display(display: boolean) {
		this._display = display;
	}

	public get display(): boolean {
		return this._display;
	}

	public get content(): HTMLElement {
		return this._indicatorContainer;
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const inputBorderColor = theme.getColor(inputBorder);
	collector.addRule(`
	.selectable-card, .selectable-card .selection-indicator-container {
			border-color: ${inputBorderColor.toString()};
		}
	`);

	const background = theme.getColor(calloutDialogBodyBackground);
	if (background) {
		collector.addRule(`
			.selectable-card .selection-indicator-container {
				background-color: ${background.toString()};
			}
		`);
	}

	const inputActiveOptionBorderColor = theme.getColor(inputValidationInfoBorder);
	if (inputActiveOptionBorderColor) {
		collector.addRule(`
			.selectable-card.selected, .selectable-card.selected .selectable-card-indicator-container {
				border-color: ${inputActiveOptionBorderColor.toString()};
			}
		`);

		collector.addRule(`
		.selectable-card .selectable-card-indicator {
				background: ${inputActiveOptionBorderColor.toString()};
			}
		`);
	}
});
