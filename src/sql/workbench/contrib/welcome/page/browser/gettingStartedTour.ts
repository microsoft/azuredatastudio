/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import 'vs/css!./gettingStartedTour';
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
import { Button } from 'sql/base/browser/ui/button/button';

const $ = dom.$;
interface TourData {
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

const tourData: TourData[] = [
	{ key: 'connections', order: '1', header: localize('GuidedTour.connections', "Connections"), body: localize('GuidedTour.makeConnections', "Connect, query, and manage your connections from SQL Server, Azure, and more."), step: localize('GuidedTour.one', "1"), elmClass: 'overview-tour-connections', id: 'overview-tour-connections', btnId: 'overview-tour-connections-btn', btnText: localize('GuidedTour.next', "Next"), docs: 'https://aka.ms/ads-connections-quickstart', elementToAppendTo: '.action-label.dataExplorer', arrow: 'arrow-left', popupImage: './../../gettingStarted/media/connections.png' },
	{ key: 'jupyer_books', order: '2', header: localize('GuidedTour.notebooks', "Notebooks"), body: localize('GuidedTour.gettingStartedNotebooks', "Get started creating your own notebook or collection of notebooks in a single place."), step: localize('GuidedTour.two', "2"), elmClass: 'overview-tour-jupyterBooks', id: 'overview-tour-jupyterBooks', btnId: 'overview-tour-jupyter-btn', btnText: localize('GuidedTour.next', "Next"), docs: 'https://aka.ms/ads-notebooks', elementToAppendTo: '.action-label.book', arrow: 'arrow-left', popupImage: './../../gettingStarted/media/notebooks.png' },
	{ key: 'extensions', order: '3', header: localize('GuidedTour.extensions', "Extensions"), body: localize('GuidedTour.addExtensions', "Extend the functionality of Azure Data Studio by installing extensions developed by us/Microsoft as well as the third-party community (you!)."), step: localize('GuidedTour.three', "3"), elmClass: 'overview-tour-extensions', id: 'overview-tour-extensions', btnId: 'overview-tour-extensions-btn', btnText: localize('GuidedTour.next', "Next"), docs: 'https://aka.ms/ads-extensions', elementToAppendTo: '.action-label.codicon-extensions', arrow: 'arrow-left', popupImage: './../../gettingStarted/media/extensions.png' },
	{ key: 'settings', order: '4', header: localize('GuidedTour.settings', "Settings"), body: localize('GuidedTour.makeConnesetSettings', "Customize Azure Data Studio based on your preferences. You can configure Settings like autosave and tab size, personalize your Keyboard Shortcuts, and switch to a Color Theme of your liking."), step: localize('GuidedTour.four', "4"), elmClass: 'overview-tour-settings', id: 'overview-tour-settings', btnId: 'overview-tour-settings-btn', btnText: localize('GuidedTour.next', "Next"), elementToAppendTo: '.codicon-settings-gear', arrow: 'arrow-bottom-left', popupImage: '../../gettingStarted/media/settings.png' },
	{ key: 'welcome_page', order: '5', header: localize('GuidedTour.welcomePage', "Welcome Page"), body: localize('GuidedTour.discoverWelcomePage', "Discover top features, recently opened files, and recommended extensions on the Welcome page. For more information on how to get started in Azure Data Studio, check out our videos and documentation."), step: localize('GuidedTour.five', "5"), elmClass: 'overview-tour-home', id: 'overview-tour-home', btnId: 'overview-tour-home-btn', btnText: localize('GuidedTour.finish', "Finish"), elementToAppendTo: 'center', arrow: 'none', popupImage: '../../gettingStarted/media/welcome.png' },
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
		this._overlay = dom.append(this.layoutService.container, $('.ads-tour'));
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

		tourData.forEach(({ key, order, header, body, step, elmClass, id, btnId, btnText, docs, elementToAppendTo, arrow, popupImage }, i): void => {
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
			if (docs) {
				const docsLink = document.createElement('a');
				docsLink.classList.add('ads-tour-docs-link');
				docsLink.innerText = localize('GuidedTour.readMore', "Read more");
				docsLink.href = docs;
				docsLink.target = '_blank';
				btnContainer.appendChild(docsLink);
			}
			const textContainer = document.createElement('div');
			headerTag.tabIndex = 2;
			bodyTag.tabIndex = 3;
			const exitButton = document.createElement('div');
			exitButton.classList.add('ads-tour-btn-exit');
			exitButton.innerText = 'x';
			const img = document.createElement('img');
			const gif = require.toUrl(popupImage);
			img.src = require.toUrl(gif);
			img.classList.add('ads-tour-img');
			flexContainer.classList.add(...flexClasses);
			container.classList.add('ads-tour-popup');
			container.setAttribute('data-order', order);
			btnContainer.classList.add('ads-tour-btn-container');
			textContainer.classList.add('ads-tour-popup-text-container');
			container.classList.add('ads-tour-element');
			container.id = id;
			if (i !== 0) {
				container.classList.add('ads-tour-hide');
			} else {
				container.classList.add('ads-tour-show');
			}
			headerTag.innerText = header;
			bodyTag.innerText = body;
			stepText.innerText = `${step} of ${tourData.length}`;
			let button = new Button(btnContainer);
			button.icon = '';
			button.label = btnText;
			btnContainer.appendChild(stepText);
			flexContainer.appendChild(img);
			flexContainer.appendChild(textContainer);
			textContainer.appendChild(headerTag);
			textContainer.appendChild(bodyTag);
			textContainer.appendChild(btnContainer);
			container.appendChild(exitButton);
			container.style.position = 'absolute';
			container.appendChild(flexContainer);
			if (key === 'settings') {
				container.style.top = (positionVertical - 330) + 'px';
				container.style.left = positionHorizontal + 'px';
			}
			else if (elementToAppendTo === 'center') {
				container.style.margin = 'auto';
				container.style.left = '0px';
				container.style.right = '0px';
				container.style.bottom = '0px';
				container.style.top = '0px';
			} else {
				container.style.top = (positionVertical) + 'px';
				container.style.left = positionHorizontal + 'px';
			}
			container.classList.add(arrow);
			this._overlay.append(container, $(`.${elmClass}`));
			tourElements.push(container);
		});
		this.buildInteractions();
	}

	private findWithAttr(array: TourData[], attr: string, value: string): number {
		for (let i = 0; i < array.length; i += 1) {
			if (array[i][attr] === value) {
				return i;
			}
		}
		return -1;
	}

	private tourEvents(popups: NodeListOf<Element>, popupsLength: number, i: number): void {
		if (i === (popupsLength - 1)) {
			this.hide();
			return;
		}
		let next = i + 1;
		const h1: HTMLElement = popups[next].querySelector('.ads-tour-popup-text-container h1');
		const popupId = popups[next].getAttribute('id');
		const popupItem = this.findWithAttr(tourData, 'id', popupId);
		let elementClassToAppendTo = tourData[popupItem].elementToAppendTo;
		let tourItem = document.querySelector(`#${tourData[popupItem].elmClass}`) as HTMLElement;
		let positionVertical;
		let positionHorizontal;
		let subjectElement = tourItem as HTMLElement;
		if (elementClassToAppendTo !== 'center') {
			subjectElement = document.querySelector(elementClassToAppendTo) as HTMLElement;
			const subjectElementPosition = subjectElement.getBoundingClientRect();
			positionHorizontal = Math.round((subjectElementPosition.left + 70));
			positionVertical = Math.round((subjectElementPosition.top - 22));
			subjectElement.style.pointerEvents = 'none';
		}
		if (elementClassToAppendTo === '.codicon-settings-gear') {
			tourItem.style.top = (positionVertical - 330) + 'px';
			tourItem.style.left = positionHorizontal + 'px';
		}
		else if (elementClassToAppendTo === 'center') {
			tourItem.style.margin = 'auto';
			tourItem.style.left = '0px';
			tourItem.style.right = '0px';
			tourItem.style.bottom = '0px';
			tourItem.style.top = '0px';
		} else {
			tourItem.style.top = (positionVertical) + 'px';
			tourItem.style.left = positionHorizontal + 'px';
		}
		popups[i].classList.add('ads-tour-hide');
		popups[i].classList.remove('ads-tour-show');
		popups[next].classList.add('ads-tour-show');
		popups[next].classList.remove('ads-tour-hide');
		h1.focus();
	}


	private buildInteractions(): void {
		const popups = document.querySelectorAll('.ads-tour-popup') as NodeListOf<Element>;
		const menuBarItems = document.querySelectorAll('.menubar-menu-button') as NodeListOf<HTMLElement>;
		const context = this;
		menuBarItems.forEach((elm) => {
			elm.style.pointerEvents = 'none';
		});
		popups.forEach(function (elm, i) {
			const btn = elm.querySelector('.ads-tour-popup-text-container .monaco-button') as HTMLElement;
			btn.tabIndex = 4;
			btn.focus();
			const exitButton = elm.querySelector('.ads-tour-btn-exit');
			const popupsLength = popups.length;
			exitButton.addEventListener('click', function () {
				context.hide();
				return;
			});
			btn.id = 'ads-tour-btn-' + popups[i];
			btn.addEventListener('keydown', (e: KeyboardEvent) => {
				context.tourEvents(popups, popupsLength, i);
			});
			btn.addEventListener('click', function () {
				context.tourEvents(popups, popupsLength, i);
			});
		});
		this.show();
	}

	public show(): void {
		if (this._overlay.style.display !== 'block') {
			const firstTourElement = document.querySelector('.ads-tour-element');
			firstTourElement.classList.add('ads-tour-show');
			this._overlay.style.display = 'block';
			const workbench = document.querySelector('.monaco-workbench') as HTMLElement;
			dom.addClass(workbench, 'blur-background');
			this._overlayVisible.set(true);
			this._overlay.focus();
		}
	}

	public hide(): void {
		const menuBarItems = document.querySelectorAll('.menubar-menu-button') as NodeListOf<HTMLElement>;
		menuBarItems.forEach(function (elm) {
			elm.style.pointerEvents = 'auto';
		});
		tourData.forEach(function ({ id }) {
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
	.registerWorkbenchAction(SyncActionDescriptor.create(GuidedTourAction, GuidedTourAction.ID, GuidedTourAction.LABEL), 'Help: Show Getting Started Guided Tour', localize('help', "Help"));

Registry.as<IWorkbenchActionRegistry>(Extensions.WorkbenchActions)
	.registerWorkbenchAction(SyncActionDescriptor.create(HideGuidedTourAction, HideGuidedTourAction.ID, HideGuidedTourAction.LABEL, { primary: KeyCode.Escape }, IS_OVERLAY_VISIBLE), 'Help: Hide Getting Started Guided Tour', localize('help', "Help"));

registerThemingParticipant((theme, collector) => {
	const bodyTag = theme.getColor(buttonForeground);
	if (bodyTag) {
		collector.addRule(`.monaco-workbench > .ads-tour p { color: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench > .ads-tour .ads-tour-popup  .ads-tour-btn { color: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench > .ads-tour .ads-tour-popup p, .monaco-workbench > .ads-tour .ads-tour-popup h1  { color: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench > .ads-tour .ads-tour-popup .ads-tour-btn-container .ads-tour-docs-link  { color: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench > .ads-tour .ads-tour-popup .ads-tour-btn-container .ads-tour-btn-primary-inverse { background: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench .activitybar>.content :not(.monaco-menu)>.monaco-action-bar .action-label.activity-workbench-view-extension-books-explorer.subject-element-focused, .monaco-workbench .activitybar>.content :not(.monaco-menu)>.monaco-action-bar .action-label.codicon.dataExplorer.subject-element-focused { background: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench .activitybar>.content :not(.monaco-menu)>.monaco-action-bar .action-label.codicon.subject-element-focused { color: ${bodyTag} !important; }`);
		collector.addRule(`.monaco-workbench .welcomePage .btn-remove-tour { color: ${bodyTag} !important; }`);
		collector.addRule(`.monaco-workbench .welcomePage .guided-tour-banner p { color: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench .welcomePage .guided-tour-banner .ads-tour-btn-start { border: 1px solid ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench .welcomePage .guided-tour-banner .ads-tour-btn-start { background: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench .welcomePage .guided-tour-banner .diamond-icon { background: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench .welcomePage .modal-content { color: ${bodyTag}; }`);
	}
	const popupBackground = theme.getColor(buttonBackground);
	if (popupBackground) {
		collector.addRule(`.monaco-workbench > .ads-tour .ads-tour-popup .ads-tour-btn-container .ads-tour-btn-primary-inverse { color: ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads-tour .ads-tour-popup { background: ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads-tour .ads-tour-popup { color: ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads-tour .ads-tour-popup.arrow-left:after { border-right: 10px solid ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads-tour .ads-tour-popup.arrow-bottom-left:after  { border-right: 10px solid ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads-tour .ads-tour-popup.arrow-center-left:after  { border-right: 10px solid ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads-tour .ads-tour-popup.arrow-top:after { border-right: 10px solid ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads-tour .ads-tour-popup.arrow-right:after { border-right: 10px solid ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads-tour .ads-tour-popup.arrow-bottom:after { border-right: 10px solid ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench .welcomePage .guided-tour-banner { background: ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench .welcomePage .guided-tour-banner .ads-tour-btn-start { color: ${popupBackground} !important; }`);
	}
	const backgroundColor = Color.fromHex(theme.type === 'light' ? '#FFFFFF85' : '#00000085');
	if (backgroundColor) {
		collector.addRule(`.monaco-workbench > .welcomeOverlay { background: ${backgroundColor}; }`);
	}
});
