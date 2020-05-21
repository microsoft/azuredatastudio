/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import 'vs/css!./welcomeTour';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { Disposable } from 'vs/base/common/lifecycle';
import { RawContextKey, IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { buttonBackground, buttonForeground } from 'vs/platform/theme/common/colorRegistry';
import { Color } from 'vs/base/common/color';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { KeyCode } from 'vs/base/common/keyCodes';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';


const $ = dom.$;

interface TourCopy {
	key: string;
	order: string;
	header: string;
	body: string;
	step: string;
	elmClass: string;
	id: string;
	btnId: string;
	btnText: string;
	docs?: string;
	elementToAppendTo: string;
	command?: string;
	subjectImage?: string;
	arrow: string;
	popupImage: string;
}

const tourCopy: TourCopy[] = [
	{ key: 'connections', order: '1', header: 'Connections', body: 'Connect, query, and manage your connections from SQL Server, Azure, and more.', step: '1', elmClass: 'overview_tour_connections', id: 'overview_tour_connections', btnId: 'overview_tour_connections_btn', btnText: 'Next', docs: 'https://aka.ms/ads-connections-quickstart', elementToAppendTo: '.action-label.dataExplorer', arrow: 'arrow_left', popupImage: './../../welcome/welcomeTour/media/connections.png' },
	{ key: 'jupyer_books', order: '2', header: 'Notebooks', body: 'Get started creating your own notebook or collection of notebooks in a single place.', step: '2', elmClass: 'overview_tour_jupyterBooks', id: 'overview_tour_jupyterBooks', btnId: 'overview_tour_jupyter_btn', btnText: 'Next', docs: 'https://aka.ms/ads-notebooks', elementToAppendTo: '.action-label.activity-workbench-view-extension-books-explorer', arrow: 'arrow_left', popupImage: './../../welcome/welcomeTour/media/notebooks.png' },
	{ key: 'extensions', order: '3', header: 'Extensions', body: 'Extend the functionality of Azure Data Studio by installing extensions developed by us/Microsoft as well as the third-party community (you!).', step: '3', elmClass: 'overview_tour_extensions', id: 'overview_tour_extensions', btnId: 'overview_tour_extensions_btn', btnText: 'Next', docs: 'https://aka.ms/ads-extensions', elementToAppendTo: '.action-label.codicon-extensions', arrow: 'arrow_left', popupImage: './../../welcome/welcomeTour/media/extensions.png' },
	{ key: 'settings', order: '4', header: 'Settings', body: 'Customize Azure Data Studio based on your preferences. You can configure Settings like autosave and tab size, personalize your Keyboard Shortcuts, and switch to a Color Theme of your liking.', step: '4', elmClass: 'overview_tour_connections', id: 'overview_tour_connections', btnId: 'overview_tour_connections_btn', btnText: 'Next', elementToAppendTo: '.codicon-settings-gear', arrow: 'arrow_bottom_left', popupImage: './../../welcome/welcomeTour/media/settings.png' },
	{ key: 'welcome_page', order: '5', header: 'Welcome Page', body: 'Discover top features, recently opened files, and recommended extensions on the Welcome page. For more information on how to get started in Azure Data Studio, check out our videos and documentation.', step: '5', elmClass: 'overview_tour_connections', id: 'overview_tour_connections', btnId: 'overview_tour_connections_btn', btnText: 'Exit', elementToAppendTo: 'center', arrow: 'none', popupImage: './../../welcome/welcomeTour/media/welcome.png' },
];

const IS_OVERLAY_VISIBLE = new RawContextKey<boolean>('interfaceOverviewVisible', false);

let guidedTour: GuidedTour;

export class GuidedTourAction extends Action {

	public static readonly ID = 'workbench.action.createGuidedTour';
	public static readonly LABEL = localize('guidedTour', "User Welcome Tour");

	constructor(
		id: string,
		label: string,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(id, label);
	}

	public run(): Promise<void> {
		if (!guidedTour) {
			guidedTour = this.instantiationService.createInstance(GuidedTour);
		}
		guidedTour.create();
		return Promise.resolve();
	}
}

export class HideGuidedTourAction extends Action {

	public static readonly ID = 'workbench.action.hideGuidedTour';
	public static readonly LABEL = localize('hideGuidedTour', "Hide Welcome Tour");

	constructor(
		id: string,
		label: string
	) {
		super(id, label);
	}

	public run(): Promise<void> {
		if (guidedTour) {
			guidedTour.hide();
		}
		return Promise.resolve();
	}
}

export class GuidedTour extends Disposable {

	private _overlayVisible: IContextKey<boolean>;
	private _overlay!: HTMLElement;

	constructor(
		@ILayoutService private readonly layoutService: ILayoutService,
		@IContextKeyService private readonly _contextKeyService: IContextKeyService,
	) {
		super();
		this._overlayVisible = IS_OVERLAY_VISIBLE.bindTo(this._contextKeyService);
	}

	public create(): void {
		const offset = this.layoutService.offset?.top ?? 0;
		const tourElements = [];
		this._overlay = dom.append(this.layoutService.container, $('.ads_tour'));
		this._overlay.style.top = `${offset}px`;
		this._overlay.style.height = `calc(100% - ${offset}px)`;
		this._overlay.style.display = 'none';
		this._overlay.tabIndex = -1;

		this._overlay.addEventListener('keydown', (e) => {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Escape)) {
				this.hide();
			}
		});

		this._overlay.addEventListener('keydown', (e) => {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter)) {
				const currentPopup = document.querySelector('.popup.show');
				const order = parseInt(currentPopup.getAttribute('data-order'));
				const nextPopup = document.querySelector(`.popup[data-order="${order + 1}"]`);
				if (order !== tourCopy.length) {
					currentPopup.classList.remove('show');
					currentPopup.classList.add('hide');
					nextPopup.classList.add('show');
					nextPopup.classList.remove('hide');
				} else {
					this.hide();
				}
			}
		});

		tourCopy.forEach(({ key, order, header, body, step, elmClass, id, btnId, btnText, docs, elementToAppendTo, arrow, popupImage }, i) => {
			const container = document.createElement('div');
			let positionVertical;
			let positionHorizontal;
			let subjectElement;
			if (elementToAppendTo !== 'center') {
				subjectElement = document.querySelector(elementToAppendTo) as HTMLElement;
				const subjectElementPosition = subjectElement.getBoundingClientRect();
				positionHorizontal = Math.round((subjectElementPosition.left + 70));
				positionVertical = Math.round((subjectElementPosition.top - 22));
				subjectElement.style.pointerEvents = 'none';
			}
			const flexClasses = ['flex', 'column'];
			const btnContainer = document.createElement('div');
			const flexContainer = document.createElement('div');
			const headerTag = document.createElement('h1');
			const bodyTag = document.createElement('p');
			const stepText = document.createElement('p');
			const btn: any = document.createElement('a');
			if (docs) {
				const docsLink = document.createElement('a');
				docsLink.classList.add('docs_link');
				docsLink.innerText = 'Read more';
				docsLink.href = docs;
				docsLink.target = '_blank';
				btnContainer.appendChild(docsLink);

			}
			const textContainer = document.createElement('div');
			headerTag.tabIndex = 0;
			bodyTag.tabIndex = 0;
			bodyTag.tabIndex = 0;
			btn.tabIndex = 0;
			const exitButton = document.createElement('div');
			exitButton.classList.add('btn_exit');
			exitButton.innerText = 'x';
			const img = document.createElement('img');
			const gif = require.toUrl(popupImage);
			img.src = require.toUrl(gif);
			img.classList.add('img');
			flexContainer.classList.add(...flexClasses);
			container.classList.add('popup');
			container.setAttribute('data-order', order);
			btnContainer.classList.add('tour_btn_container');
			textContainer.classList.add('popup_text_container');
			container.classList.add('tour_element');
			container.id = id;
			if (i !== 0) {
				container.classList.add('hide');
			} else {
				container.classList.add('show');
			}
			const buttonClasses = ['btn', 'btn_primary', 'btn_primary_inverse', 'overview_tour_btn_next'];
			btn.classList.add(...buttonClasses);
			headerTag.innerText = header;
			bodyTag.innerText = body;
			btn.innerText = btnText;

			stepText.innerText = `${step} of 5`;
			btnContainer.appendChild(btn);
			btnContainer.appendChild(stepText);
			flexContainer.appendChild(img);
			flexContainer.appendChild(textContainer);
			textContainer.appendChild(headerTag);
			textContainer.appendChild(bodyTag);
			textContainer.appendChild(btnContainer);
			container.appendChild(exitButton);
			container.style.position = 'absolute';
			container.appendChild(flexContainer);
			container.classList.add(arrow);
			if (elementToAppendTo === '.codicon-settings-gear') {
				container.style.top = (positionVertical - 310) + 'px';
				container.style.left = positionHorizontal + 'px';

			} else if (elementToAppendTo === 'center') {
				container.style.margin = 'auto';
				container.style.left = '0px';
				container.style.right = '0px';
				container.style.bottom = '0px';
				container.style.top = '0px';
			} else {
				container.style.top = (positionVertical) + 'px';
				container.style.left = positionHorizontal + 'px';
			}
			this._overlay.append(container, $(`.${elmClass}`));
			tourElements.push(container);
		});
		this.buildInteractions();
	}


	private buildInteractions() {
		const popups = document.querySelectorAll('.popup') as NodeListOf<Element>;
		const menuBarItems = document.querySelectorAll('.menubar-menu-button') as NodeListOf<HTMLElement>;
		const context = this;
		menuBarItems.forEach((elm) => {
			elm.style.pointerEvents = 'none';
		});
		popups.forEach(function (elm, i) {
			const btn = elm.querySelector('.overview_tour_btn_next');
			const exitButton = elm.querySelector('.btn_exit');
			const popupsLength = popups.length;

			exitButton.addEventListener('click', function () {
				context.hide();
				return;
			});
			btn.id = 'btn_' + popups[i];
			btn.addEventListener('click', function () {
				if (i === (popupsLength - 1)) {
					context.hide();
					return;
				}
				// const subjectImage = document.querySelector(`${tourCopy[i].elementToAppendTo}`);
				// subjectImage.classList.add('subject_element_focused');
				let next = i + 1;
				popups[i].classList.add('hide');
				popups[i].classList.remove('show');
				popups[next].classList.add('show');
				popups[next].classList.remove('hide');
				const nextBtn: HTMLElement = popups[next].querySelector('.overview_tour_btn_next');
				nextBtn.focus();
			});

		});
		this.show();
	}


	public show() {
		if (this._overlay.style.display !== 'block') {
			const firstTourElement = document.querySelector('.tour_element');
			firstTourElement.classList.add('show');
			this._overlay.style.display = 'block';
			const workbench = document.querySelector('.monaco-workbench') as HTMLElement;
			dom.addClass(workbench, 'blur-background');
			this._overlayVisible.set(true);
			this._overlay.focus();
		}
	}

	public hide() {
		const menuBarItems = document.querySelectorAll('.menubar-menu-button') as NodeListOf<HTMLElement>;
		menuBarItems.forEach(function (elm) {
			elm.style.pointerEvents = 'auto';
		});
		tourCopy.forEach(function ({ id }) {
			document.querySelector(`#${id}`).remove();
		});
		if (this._overlay.style.display !== 'none') {
			this._overlay.style.display = 'none';
			const workbench = document.querySelector('.monaco-workbench') as HTMLElement;
			dom.removeClass(workbench, 'blur-background');
			this._overlayVisible.reset();
		}
	}
}

Registry.as<IWorkbenchActionRegistry>(Extensions.WorkbenchActions)
	.registerWorkbenchAction(SyncActionDescriptor.create(GuidedTourAction, GuidedTourAction.ID, GuidedTourAction.LABEL), 'Help: Getting Started Guided Tour', localize('help', "Help"));

Registry.as<IWorkbenchActionRegistry>(Extensions.WorkbenchActions)
	.registerWorkbenchAction(SyncActionDescriptor.create(HideGuidedTourAction, HideGuidedTourAction.ID, HideGuidedTourAction.LABEL, { primary: KeyCode.Escape }, IS_OVERLAY_VISIBLE), 'Help: Hide Getting Started Guided Tour', localize('help', "Help"));


// theming
registerThemingParticipant((theme, collector) => {
	const bodyTag = theme.getColor(buttonForeground);
	if (bodyTag) {
		collector.addRule(`.monaco-workbench > .ads_tour p { color: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench > .ads_tour .popup { color: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench > .ads_tour .popup  .btn { color: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench > .ads_tour .popup p, .monaco-workbench > .ads_tour .popup h1  { color: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench > .ads_tour .popup .tour_btn_container .docs_link  { color: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench > .ads_tour .popup .tour_btn_container .btn_primary_inverse { background: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench .activitybar>.content :not(.monaco-menu)>.monaco-action-bar .action-label.activity-workbench-view-extension-books-explorer.subject_element_focused, .monaco-workbench .activitybar>.content :not(.monaco-menu)>.monaco-action-bar .action-label.codicon.dataExplorer.subject_element_focused { background: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench .activitybar>.content :not(.monaco-menu)>.monaco-action-bar .action-label.codicon.subject_element_focused { color: ${bodyTag} !important; }`);
		collector.addRule(`.monaco-workbench .welcomePage.btn_remove_tour { background: ${bodyTag} !important; }`);
		collector.addRule(`.monaco-workbench .welcomePage .guided_tour_banner p { color: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench .welcomePage .guided_tour_banner .btn_start { border: 1px solid ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench .welcomePage .guided_tour_banner .btn_start { background: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench .welcomePage .guided_tour_banner .diamond_icon { background: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench .welcomePage .modal_content { color: ${bodyTag}; }`);

	}

	const popupBackground = theme.getColor(buttonBackground);
	if (popupBackground) {
		collector.addRule(`.monaco-workbench > .ads_tour .popup .tour_btn_container .btn_primary_inverse { color: ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads_tour .popup { background: ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads_tour .popup.arrow_left:after { border-right: 10px solid ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads_tour .popup.arrow_bottom_left:after  { border-right: 10px solid ${popupBackground}; }`);

		collector.addRule(`.monaco-workbench > .ads_tour .popup.arrow_top:after { border-right: 10px solid ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads_tour .popup.arrow_right:after { border-right: 10px solid ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads_tour .popup.arrow_bottom:after { border-right: 10px solid ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench .welcomePage .guided_tour_banner { background: ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench .welcomePage .guided_tour_banner .btn_start { color: ${popupBackground}; }`);



	}
	const backgroundColor = Color.fromHex(theme.type === 'light' ? '#FFFFFF85' : '#00000085');
	if (backgroundColor) {
		collector.addRule(`.monaco-workbench > .welcomeOverlay { background: ${backgroundColor}; }`);
	}
});
