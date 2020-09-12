/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import 'vs/css!./initialSetupWizard';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { RawContextKey, IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { buttonBackground, buttonForeground, buttonSecondaryBackground, foreground, inputBackground, textLinkActiveForeground } from 'vs/platform/theme/common/colorRegistry';
import { Color } from 'vs/base/common/color';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { KeyCode } from 'vs/base/common/keyCodes';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { Button } from 'sql/base/browser/ui/button/button';
import { ConfigurationTarget, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { buttonSecondary, buttonSecondaryBorder, buttonSecondaryHoverColor } from 'sql/platform/theme/common/colorRegistry';
const intialSetupWizardKey = 'workbench.initialSetup';

const $ = dom.$;
interface InitialSetupWizardData {
	key: string;
	order: string;
	header: string;
	subHeader: string;
	body: string;
	docs?: string;
	step: string;
	elmClass: string;
	id: string;
	btnId: string;
	btnText: string;
	subjectImage?: string;
	popupImage: string;
	interaction?: string;
	interactionLabel?: string;
	name?: string;
}

const initialSetupWizardData: InitialSetupWizardData[] = [
	{
		key: 'preview_features',
		order: '1',
		header: localize('initialSetupWizard.setupHeader', "Azure Data Studio Setup"),
		subHeader: localize('initialSetupWizard.subheaderPreviewFeatures', "Opt in to use preview features"),
		body: localize('initialSetupWizard.previewFeaturesBody', "Azure Data Studio releases continuously. To access new features and user experiences as soon as they’re released, we recommend that you opt in. "),
		docs: 'https://aka.ms/ads-preview-features',
		step: localize('initialSetupWizard.one', "1"),
		elmClass: 'ads-initial-setup-wizard-preview-features',
		id: 'ads-initial-setup-wizard-preview-features',
		btnId: 'ads-initial-setup-wizard-preview-features-btn',
		btnText: localize('initialSetupWizard.next', "Next"),
		popupImage: './../../gettingStarted/media/enablePreviewFeatures.svg',
		interaction: 'checkbox',
		interactionLabel: 'Opt in (recommended)',
		name: 'previewFeatures'
	},
	{
		key: 'azure_account',
		order: '2',
		header: localize('initialSetupWizard.setupHeader', "Azure Data Studio Setup"),
		subHeader: localize('initialSetupWizard.subheaderAzureAccount', "Sign into your Azure Account (optional)"),
		body: localize('initialSetupWizard.azureAccountBody', "Azure Data Studio is a multi-database tool with built-in support for both on-premises and cloud data platforms. You can optionally add an Azure account to seamlessly browse, connect to, and query your Azure SQL resources in Azure Data Studio. Feel free to complete this step later. "),
		step: localize('initialSetupWizard.two', "2"),
		elmClass: 'ads-initial-setup-wizard-azure-account',
		id: 'ads-initial-setup-wizard-azure-account',
		btnId: 'ads-initial-setup-wizard-done-btn',
		btnText: localize('initialSetupWizard.done', "Done"),
		popupImage: './../../gettingStarted/media/addAzureAccount.svg',
		interaction: 'button',
		interactionLabel: 'Add account',
	}
];

const IS_OVERLAY_VISIBLE = new RawContextKey<boolean>('interfaceOverviewVisible', false);
let gettingStartedSetupWizard: GettingStartedSetupWizard;

export class GettingStartedSetupWizardAction extends Action {
	public static readonly ID = 'workbench.action.createInitialSetupWizard';
	public static readonly LABEL = localize('initialSetupWizard', "Initial Setup Wizard");

	constructor(
		id: string,
		label: string,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(id, label);
	}

	public run(): Promise<void> {
		if (!gettingStartedSetupWizard) {
			gettingStartedSetupWizard = this.instantiationService.createInstance(GettingStartedSetupWizard);
		}
		gettingStartedSetupWizard.create();
		return Promise.resolve();
	}
}

export class HideGettingStartedSetupWizardAction extends Action {
	public static readonly ID = 'workbench.action.hideGettingStartedSetupWizard';
	public static readonly LABEL = localize('hideGettingStartedSetupWizard', "Hide Initial Setup Wizard");

	constructor(
		id: string,
		label: string
	) {
		super(id, label);
	}

	public run(): Promise<void> {
		if (gettingStartedSetupWizard) {
			gettingStartedSetupWizard.hide();
		}
		return Promise.resolve();
	}
}

export class GettingStartedSetupWizard implements IWorkbenchContribution {
	private _overlayVisible: IContextKey<boolean>;
	private _container!: HTMLElement;
	private _overlay!: HTMLElement;
	private static ENABLE_PREVIEW_FEATURES_SHOWN = 'workbench.enablePreviewFeaturesShown';

	constructor(
		@ILayoutService private readonly layoutService: ILayoutService,
		@IStorageService private readonly storageService: IStorageService,
		@IContextKeyService private readonly _contextKeyService: IContextKeyService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		this._overlayVisible = IS_OVERLAY_VISIBLE.bindTo(this._contextKeyService);
	}

	public create(): void {
		const offset = this.layoutService.offset?.top ?? 0;
		const initialSetupElements = [];
		this._container = dom.append(this.layoutService.container, $('.ads-initial-setup-wizard'));
		this._container.style.top = `${offset}px`;
		this._container.style.height = `calc(100% - ${offset}px)`;
		this._container.tabIndex = -1;

		this._overlay = dom.append($('.ads-initial-setup-wizard'), $('.ads-initial-setup-wizard-overlay'));
		this._overlay.style.top = `${offset}px`;
		this._overlay.style.height = `calc(100% - ${offset}px)`;
		this._overlay.tabIndex = -1;

		this._container.addEventListener('keydown', (e) => {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Escape)) {
				this.hide();
			}
		});

		initialSetupWizardData.forEach(({ order, header, subHeader, body, docs, step, elmClass, id, btnText, popupImage, interaction, interactionLabel, name }, i): void => {
			const flexClasses: string[] = ['flex', 'column'];
			const gif: string = require.toUrl(popupImage);

			const container: HTMLDivElement = document.createElement('div');
			container.classList.add('ads-initial-setup-wizard-popup');
			container.setAttribute('data-order', order);
			container.classList.add('ads-initial-setup-wizard-element');
			container.classList.add('ads-initial-setup-wizard-hide');
			container.id = id;

			const btnContainer: HTMLDivElement = document.createElement('div');
			btnContainer.classList.add('ads-initial-setup-wizard-btn-container');

			const navContainer: HTMLDivElement = document.createElement('div');
			navContainer.classList.add('ads-initial-setup-wizard-nav-container');

			const nextBtnContainer: HTMLDivElement = document.createElement('div');
			nextBtnContainer.classList.add('ads-initial-setup-wizard-next-btn-container');

			const flexContainer: HTMLDivElement = document.createElement('div');
			flexContainer.classList.add(...flexClasses);

			const headerTag: HTMLHeadingElement = document.createElement('h1');
			headerTag.innerText = header;

			const subHeaderTag: HTMLHeadingElement = document.createElement('h2');
			subHeaderTag.innerText = subHeader;

			const bodyTag: HTMLParagraphElement = document.createElement('p');
			bodyTag.innerText = body;

			const hrTag: HTMLHRElement = document.createElement('hr');
			hrTag.classList.add('ads-initial-setup-wizard-hr');

			const stepText: HTMLParagraphElement = document.createElement('p');
			stepText.classList.add('ads-initial-setup-wizard-step');
			stepText.innerText = `${step} of ${initialSetupWizardData.length}`;


			const contentContainer: HTMLDivElement = document.createElement('div');
			contentContainer.classList.add('ads-initial-setup-wizard-popup-content-container');

			const textContainer: HTMLDivElement = document.createElement('div');
			textContainer.classList.add('ads-initial-setup-wizard-text-container');

			const img: HTMLImageElement = document.createElement('img');
			img.src = require.toUrl(gif);
			img.classList.add('ads-initial-setup-wizard-img');


			flexContainer.appendChild(img);
			flexContainer.appendChild(contentContainer);
			navContainer.appendChild(stepText);
			textContainer.appendChild(headerTag);
			textContainer.appendChild(subHeaderTag);
			textContainer.appendChild(bodyTag);

			const nextButton: Button = new Button(nextBtnContainer);
			nextButton.label = btnText;

			if (docs) {
				const linkIconClasses = ['icon-link', 'themed-icon-alt'];
				const span: HTMLSpanElement = document.createElement('span');
				const linkTag: HTMLAnchorElement = document.createElement('a');
				span.classList.add(...linkIconClasses);
				linkTag.classList.add('ads-initial-setup-wizard-docs-link');
				linkTag.href = docs;
				linkTag.innerText = localize('initialSetupWizard.learnMore', "Learn more");
				linkTag.appendChild(span);
				bodyTag.appendChild(linkTag);
			}

			if (i !== 0) {
				const previousBtnContainer: HTMLDivElement = document.createElement('div');
				const previousButton: Button = new Button(previousBtnContainer);
				previousBtnContainer.classList.add('ads-initial-setup-wizard-previous-btn-container');
				previousBtnContainer.classList.add('btn-secondary');
				previousButton.label = localize('initialSetupWizard.previous', "Previous");
				btnContainer.appendChild(previousBtnContainer);
			}

			btnContainer.appendChild(nextBtnContainer);
			navContainer.appendChild(btnContainer);

			if (interaction === 'checkbox') {
				const interactionContainer: HTMLDivElement = document.createElement('div');
				const label: HTMLLabelElement = document.createElement('label');
				const checkbox: HTMLInputElement = document.createElement('input');
				const span: HTMLSpanElement = document.createElement('span');
				const p: HTMLParagraphElement = document.createElement('p');

				p.innerText = interactionLabel;
				checkbox.setAttribute('type', 'checkbox');
				checkbox.setAttribute('name', name);

				interactionContainer.classList.add('ads-initial-setup-wizard-checkbox-container');
				label.classList.add('ads-initial-setup-wizard-switch');
				checkbox.classList.add('ads-initial-setup-wizard-checkbox');
				span.classList.add('ads-initial-setup-wizard-slider');
				span.classList.add('round');

				label.appendChild(checkbox);
				label.appendChild(span);

				interactionContainer.appendChild(label);
				interactionContainer.appendChild(p);
				textContainer.appendChild(interactionContainer);

				checkbox.checked = true;

				dom.addStandardDisposableListener(interactionContainer, 'keydown', event => {
					if (event.equals(KeyCode.Enter)) {
						if (checkbox.checked) {
							checkbox.checked = false;
						} else {
							checkbox.checked = true;
						}
					}
				});
			}
			if (interaction === 'button') {
				const interactionContainer: HTMLDivElement = document.createElement('div');
				interactionContainer.classList.add('ads-initial-setup-wizard-add-account');
				interactionContainer.classList.add('ads-initial-setup-wizard-interaction-container');
				const button: Button = new Button(interactionContainer);
				button.label = interactionLabel;
				button.onDidClick(() => {
					// add account
				});
				textContainer.appendChild(interactionContainer);
			}

			contentContainer.appendChild(textContainer);
			contentContainer.appendChild(hrTag);
			contentContainer.appendChild(navContainer);
			container.style.position = 'absolute';
			container.appendChild(flexContainer);
			this._container.append(container, $(`.${elmClass}`));
			initialSetupElements.push(container);
		});
		this.buildInteractions();
	}

	private wizardNextEvent(popups: NodeListOf<Element>, popupsLength: number, i: number): void {
		if (i === (popupsLength - 1)) {
			this.hide();
			return;
		}
		let next: number = i + 1;
		const h1: HTMLElement = popups[next].querySelector('.ads-initial-setup-wizard-popup-content-container h1');
		popups[i].classList.add('ads-initial-setup-wizard-hide');
		popups[i].classList.remove('ads-initial-setup-wizard-show');
		popups[i].classList.remove('ads-initial-setup-animate');
		popups[next].classList.add('ads-initial-setup-wizard-show');
		popups[next].classList.remove('ads-initial-setup-wizard-hide');
		h1.focus();
	}

	private wizardPrevEvent(popups: NodeListOf<Element>, popupsLength: number, i: number): void {
		let last: number = i - 1;
		const h1: HTMLElement = popups[last].querySelector('.ads-initial-setup-wizard-popup-content-container h1');
		popups[i].classList.add('ads-initial-setup-wizard-hide');
		popups[i].classList.remove('ads-initial-setup-wizard-show');
		popups[last].classList.add('ads-initial-setup-wizard-show');
		popups[last].classList.remove('ads-initial-setup-wizard-hide');
		h1.focus();
	}


	private buildInteractions(): void {
		const popups = document.querySelectorAll('.ads-initial-setup-wizard-popup') as NodeListOf<Element>;
		const menuBarItems = document.querySelectorAll('.menubar-menu-button') as NodeListOf<HTMLElement>;
		const context: this = this;
		menuBarItems.forEach((elm) => {
			elm.style.pointerEvents = 'none';
		});
		popups.forEach(function (elm, i) {
			const nextBtn = elm.querySelector('.ads-initial-setup-wizard-next-btn-container .monaco-button') as HTMLElement;
			const previousBtn = elm.querySelector('.ads-initial-setup-wizard-previous-btn-container .monaco-button') as HTMLElement;
			const popupsLength: number = popups.length;

			dom.addStandardDisposableListener(nextBtn, 'keydown', event => {
				if (event.equals(KeyCode.Enter)) {
					context.wizardNextEvent(popups, popupsLength, i);
				}
				if (event.equals(KeyCode.Tab)) {
					event.preventDefault();
				}
			});

			dom.addStandardDisposableListener(nextBtn, 'click', event => {
				context.wizardNextEvent(popups, popupsLength, i);
			});

			if (previousBtn) {

				dom.addStandardDisposableListener(previousBtn, 'keydown', event => {
					if (event.equals(KeyCode.Enter)) {
						context.wizardPrevEvent(popups, popupsLength, i);
					}
				});

				dom.addStandardDisposableListener(previousBtn, 'click', event => {
					context.wizardPrevEvent(popups, popupsLength, i);
				});
			}
		});
		this.show();
	}

	public show(): void {
		if (this._overlay.style.display !== 'block') {

			const firstSetupElement = document.querySelector('.ads-initial-setup-wizard-element') as HTMLDivElement;
			const setupWizard = document.querySelector('.ads-initial-setup-wizard') as HTMLElement;

			setTimeout(() => {
				setupWizard.classList.add('ads-initial-setup-wizard--open');
				firstSetupElement.classList.add('ads-initial-setup-animate');
				firstSetupElement.classList.add('ads-initial-setup-wizard-show');
			}, 1000);


			this._overlay.focus();
		}
	}

	public hide(): void {
		const menuBarItems = document.querySelectorAll('.menubar-menu-button') as NodeListOf<HTMLElement>;
		const previewFeaturesOptIn = document.querySelector(`input[name='previewFeatures']`) as HTMLInputElement;
		const setupWizaredContainer = document.querySelector('.ads-initial-setup-wizard') as HTMLDivElement;
		if (previewFeaturesOptIn.checked) {
			this.configurationService.updateValue('workbench.enablePreviewFeatures', true).catch(e => onUnexpectedError(e));
			this.storageService.store(GettingStartedSetupWizard.ENABLE_PREVIEW_FEATURES_SHOWN, true, StorageScope.GLOBAL);
		}
		menuBarItems.forEach(function (elm) {
			elm.style.pointerEvents = 'auto';
		});
		initialSetupWizardData.forEach(function ({ id }) {
			document.querySelector(`#${id}`).remove();
		});
		setupWizaredContainer.remove();
		if (this._overlay.style.display !== 'none') {
			this._overlay.style.display = 'none';
			this._overlayVisible.reset();
		}
		this.configurationService.updateValue(intialSetupWizardKey, 'notInitialSetup', ConfigurationTarget.USER);
	}
}

Registry.as<IWorkbenchActionRegistry>(Extensions.WorkbenchActions)
	.registerWorkbenchAction(SyncActionDescriptor.create(GettingStartedSetupWizardAction, GettingStartedSetupWizardAction.ID, GettingStartedSetupWizardAction.LABEL), 'Help: Show Initial Setup Wizard', localize('help', "Help"));

Registry.as<IWorkbenchActionRegistry>(Extensions.WorkbenchActions)
	.registerWorkbenchAction(SyncActionDescriptor.create(HideGettingStartedSetupWizardAction, HideGettingStartedSetupWizardAction.ID, HideGettingStartedSetupWizardAction.LABEL, { primary: KeyCode.Escape }, IS_OVERLAY_VISIBLE), 'Help: Hide Initial Setup Wizard', localize('help', "Help"));

registerThemingParticipant((theme, collector) => {
	const bodyTag = theme.getColor(buttonForeground);
	if (bodyTag) {
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard p { color: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard .ads-initial-setup-wizard-popup  .ads-initial-setup-wizard-btn { color: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard .ads-initial-setup-wizard-popup .ads-initial-setup-wizard-btn-container .ads-initial-setup-wizard-btn-primary-inverse { background: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench .welcomePage .modal-content { color: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard .ads-initial-setup-wizard-popup { background: ${bodyTag}; }`);
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard .ads-initial-setup-wizard-slider:before { background: ${bodyTag}; }`);
	}
	const popupBackground = theme.getColor(buttonBackground);
	if (popupBackground) {
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard .ads-initial-setup-wizard-popup .ads-initial-setup-wizard-btn-container .ads-initial-setup-wizard-btn-primary-inverse { color: ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard .ads-initial-setup-wizard-popup h1  { color: ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard .ads-initial-setup-wizard-popup h2  { color: ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard input:checked + .ads-initial-setup-wizard-slider  { background-color: ${popupBackground}; }`);
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard input:focus + .ads-initial-setup-wizard-slider { box-shadow: 0 0 1px ${popupBackground}; }`);
	}
	const tileBackgroundColor = theme.getColor(inputBackground);
	if (tileBackgroundColor) {
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard .ads-initial-setup-wizard-popup .btn-secondary .monaco-button { background-color: ${tileBackgroundColor} !important;  }`);
	}
	const buttonSecondaryBackgroundColor = theme.getColor(buttonSecondaryBackground);
	if (buttonSecondaryBackgroundColor) {
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard .ads-initial-setup-wizard-popup .btn-secondary { background-color: ${buttonSecondaryBackgroundColor}}`);
	}
	const buttonSecondaryBorderColor = theme.getColor(buttonSecondaryBorder);
	if (buttonSecondaryBorderColor) {
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard .ads-initial-setup-wizard-popup .btn-secondary .monaco-button { border: 1px solid ${buttonSecondaryBorderColor}}`);
	}
	const buttonSecondaryColor = theme.getColor(buttonSecondary);
	if (buttonSecondaryColor) {
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard .ads-initial-setup-wizard-popup .btn-secondary .monaco-button { color: ${buttonSecondaryColor} !important}`);
	}
	const buttonSecondaryHover = theme.getColor(buttonSecondaryHoverColor);
	if (buttonSecondaryColor) {
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard .ads-initial-setup-wizard-popup .btn-secondary:hover:not(.disabled) { color: ${buttonSecondaryHover};}`);
	}
	const foregroundColor = theme.getColor(foreground);
	if (foregroundColor) {
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard .ads-initial-setup-wizard-popup p  { color: ${foregroundColor}; }`);
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard .ads-initial-setup-wizard-popup .ads-initial-setup-wizard-slider { background: ${foregroundColor}; }`);
	}
	const backgroundColor = Color.fromHex(theme.type === 'light' ? '#FFFFFF85' : '#00000085');
	if (backgroundColor) {
		collector.addRule(`.monaco-workbench > .welcomeOverlay { background: ${backgroundColor}; }`);
	}
	const activeLink = theme.getColor(textLinkActiveForeground);
	if (activeLink) {
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard .ads-initial-setup-wizard-popup .ads-initial-setup-wizard-docs-link  { color: ${activeLink}; }`);
		collector.addRule(`.monaco-workbench > .ads-initial-setup-wizard .ads-initial-setup-wizard-popup .themed-icon-alt { background-color: ${activeLink}; }`);
	}
});
