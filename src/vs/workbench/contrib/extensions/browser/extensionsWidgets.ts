/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/extensionsWidgets';
import * as semver from 'vs/base/common/semver/semver';
import { Disposable, toDisposable, DisposableStore, MutableDisposable, IDisposable } from 'vs/base/common/lifecycle';
import { IExtension, IExtensionsWorkbenchService, IExtensionContainer, ExtensionState, ExtensionEditorTab } from 'vs/workbench/contrib/extensions/common/extensions';
import { append, $, reset, addDisposableListener, EventType, finalHandler } from 'vs/base/browser/dom';
import * as platform from 'vs/base/common/platform';
import { localize } from 'vs/nls';
import { EnablementState, IExtensionManagementServerService } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { IExtensionIgnoredRecommendationsService, IExtensionRecommendationsService } from 'vs/workbench/services/extensionRecommendations/common/extensionRecommendations';
import { ILabelService } from 'vs/platform/label/common/label';
import { extensionButtonProminentBackground, ExtensionStatusAction } from 'vs/workbench/contrib/extensions/browser/extensionsActions';
import { IThemeService, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { ThemeIcon } from 'vs/base/common/themables';
import { EXTENSION_BADGE_REMOTE_BACKGROUND, EXTENSION_BADGE_REMOTE_FOREGROUND } from 'vs/workbench/common/theme';
import { Emitter, Event } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CountBadge } from 'vs/base/browser/ui/countBadge/countBadge';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IUserDataSyncEnablementService } from 'vs/platform/userDataSync/common/userDataSync';
import { activationTimeIcon, errorIcon, infoIcon, installCountIcon, preReleaseIcon, ratingIcon, remoteIcon, sponsorIcon, starEmptyIcon, starFullIcon, starHalfIcon, syncIgnoredIcon, verifiedPublisherIcon, warningIcon } from 'vs/workbench/contrib/extensions/browser/extensionsIcons';
import { registerColor, textLinkForeground } from 'vs/platform/theme/common/colorRegistry';
import { IHoverService } from 'vs/workbench/services/hover/browser/hover';
import { HoverPosition } from 'vs/base/browser/ui/hover/hoverWidget';
import { MarkdownString } from 'vs/base/common/htmlContent';
import { URI } from 'vs/base/common/uri';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { areSameExtensions } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import Severity from 'vs/base/common/severity';
import { setupCustomHover } from 'vs/base/browser/ui/iconLabel/iconLabelHover';
import { Color } from 'vs/base/common/color';
import { renderMarkdown } from 'vs/base/browser/markdownRenderer';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { onUnexpectedError } from 'vs/base/common/errors';
import { renderIcon } from 'vs/base/browser/ui/iconLabel/iconLabels';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { defaultCountBadgeStyles } from 'vs/platform/theme/browser/defaultStyles';

export abstract class ExtensionWidget extends Disposable implements IExtensionContainer {
	private _extension: IExtension | null = null;
	get extension(): IExtension | null { return this._extension; }
	set extension(extension: IExtension | null) { this._extension = extension; this.update(); }
	update(): void { this.render(); }
	abstract render(): void;
}

export function onClick(element: HTMLElement, callback: () => void): IDisposable {
	const disposables: DisposableStore = new DisposableStore();
	disposables.add(addDisposableListener(element, EventType.CLICK, finalHandler(callback)));
	disposables.add(addDisposableListener(element, EventType.KEY_UP, e => {
		const keyboardEvent = new StandardKeyboardEvent(e);
		if (keyboardEvent.equals(KeyCode.Space) || keyboardEvent.equals(KeyCode.Enter)) {
			e.preventDefault();
			e.stopPropagation();
			callback();
		}
	}));
	return disposables;
}

export class InstallCountWidget extends ExtensionWidget {

	constructor(
		private container: HTMLElement,
		private small: boolean,
	) {
		super();
		container.classList.add('extension-install-count');
		this.render();
	}

	render(): void {
		this.container.innerText = '';

		if (!this.extension) {
			return;
		}

		if (this.small && this.extension.state === ExtensionState.Installed) {
			return;
		}

		const installLabel = InstallCountWidget.getInstallLabel(this.extension, this.small);
		if (!installLabel) {
			return;
		}

		append(this.container, $('span' + ThemeIcon.asCSSSelector(installCountIcon)));
		const count = append(this.container, $('span.count'));
		count.textContent = installLabel;
	}

	static getInstallLabel(extension: IExtension, small: boolean): string | undefined {
		const installCount = extension.installCount;

		if (installCount === undefined) {
			return undefined;
		}

		let installLabel: string;

		if (small) {
			if (installCount > 1000000) {
				installLabel = `${Math.floor(installCount / 100000) / 10}M`;
			} else if (installCount > 1000) {
				installLabel = `${Math.floor(installCount / 1000)}K`;
			} else {
				installLabel = String(installCount);
			}
		}
		else {
			installLabel = installCount.toLocaleString(platform.language);
		}

		return installLabel;
	}
}

export class RatingsWidget extends ExtensionWidget {

	constructor(
		private container: HTMLElement,
		private small: boolean
	) {
		super();
		container.classList.add('extension-ratings');

		if (this.small) {
			container.classList.add('small');
		}

		this.render();
	}

	render(): void {
		this.container.innerText = '';
		this.container.title = '';

		if (!this.extension) {
			return;
		}

		if (this.small && this.extension.state === ExtensionState.Installed) {
			return;
		}

		if (this.extension.rating === undefined) {
			return;
		}

		if (this.small && !this.extension.ratingCount) {
			return;
		}

		const rating = Math.round(this.extension.rating * 2) / 2;
		this.container.title = localize('ratedLabel', "Average rating: {0} out of 5", rating);
		if (this.small) {
			append(this.container, $('span' + ThemeIcon.asCSSSelector(starFullIcon)));

			const count = append(this.container, $('span.count'));
			count.textContent = String(rating);
		} else {
			for (let i = 1; i <= 5; i++) {
				if (rating >= i) {
					append(this.container, $('span' + ThemeIcon.asCSSSelector(starFullIcon)));
				} else if (rating >= i - 0.5) {
					append(this.container, $('span' + ThemeIcon.asCSSSelector(starHalfIcon)));
				} else {
					append(this.container, $('span' + ThemeIcon.asCSSSelector(starEmptyIcon)));
				}
			}
			if (this.extension.ratingCount) {
				const ratingCountElemet = append(this.container, $('span', undefined, ` (${this.extension.ratingCount})`));
				ratingCountElemet.style.paddingLeft = '1px';
			}
		}
	}
}

export class VerifiedPublisherWidget extends ExtensionWidget {

	private disposables = this._register(new DisposableStore());

	constructor(
		private container: HTMLElement,
		private small: boolean,
		@IOpenerService private readonly openerService: IOpenerService,
	) {
		super();
		this.render();
	}

	render(): void {
		reset(this.container);
		this.disposables.clear();
		if (!this.extension?.publisherDomain?.verified) {
			return;
		}

		const publisherDomainLink = URI.parse(this.extension.publisherDomain.link);
		const verifiedPublisher = append(this.container, $('span.extension-verified-publisher.clickable'));
		append(verifiedPublisher, renderIcon(verifiedPublisherIcon));

		if (!this.small) {
			verifiedPublisher.tabIndex = 0;
			verifiedPublisher.title = this.extension.publisherDomain.link;
			verifiedPublisher.setAttribute('role', 'link');

			append(verifiedPublisher, $('span.extension-verified-publisher-domain', undefined, publisherDomainLink.authority.startsWith('www.') ? publisherDomainLink.authority.substring(4) : publisherDomainLink.authority));
			this.disposables.add(onClick(verifiedPublisher, () => this.openerService.open(publisherDomainLink)));
		}

	}
}

export class SponsorWidget extends ExtensionWidget {

	private disposables = this._register(new DisposableStore());

	constructor(
		private container: HTMLElement,
		@IOpenerService private readonly openerService: IOpenerService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
	) {
		super();
		this.render();
	}

	render(): void {
		reset(this.container);
		this.disposables.clear();
		if (!this.extension?.publisherSponsorLink) {
			return;
		}

		const sponsor = append(this.container, $('span.sponsor.clickable', { tabIndex: 0, title: this.extension?.publisherSponsorLink }));
		sponsor.setAttribute('role', 'link'); // #132645
		const sponsorIconElement = renderIcon(sponsorIcon);
		const label = $('span', undefined, localize('sponsor', "Sponsor"));
		append(sponsor, sponsorIconElement, label);
		this.disposables.add(onClick(sponsor, () => {
			type SponsorExtensionClassification = {
				owner: 'sandy081';
				comment: 'Reporting when sponosor extension action is executed';
				'extensionId': { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Id of the extension to be sponsored' };
			};
			type SponsorExtensionEvent = {
				'extensionId': string;
			};
			this.telemetryService.publicLog2<SponsorExtensionEvent, SponsorExtensionClassification>('extensionsAction.sponsorExtension', { extensionId: this.extension!.identifier.id });
			this.openerService.open(this.extension!.publisherSponsorLink!);
		}));
	}
}

export class RecommendationWidget extends ExtensionWidget {

	private element?: HTMLElement;
	private readonly disposables = this._register(new DisposableStore());

	constructor(
		private parent: HTMLElement,
		@IExtensionRecommendationsService private readonly extensionRecommendationsService: IExtensionRecommendationsService
	) {
		super();
		this.render();
		this._register(toDisposable(() => this.clear()));
		this._register(this.extensionRecommendationsService.onDidChangeRecommendations(() => this.render()));
	}

	private clear(): void {
		if (this.element) {
			this.parent.removeChild(this.element);
		}
		this.element = undefined;
		this.disposables.clear();
	}

	render(): void {
		this.clear();
		if (!this.extension || this.extension.state === ExtensionState.Installed || this.extension.deprecationInfo) {
			return;
		}
		const extRecommendations = this.extensionRecommendationsService.getAllRecommendationsWithReason();
		if (extRecommendations[this.extension.identifier.id.toLowerCase()]) {
			this.element = append(this.parent, $('div.extension-bookmark'));
			const recommendation = append(this.element, $('.recommendation'));
			append(recommendation, $('span' + ThemeIcon.asCSSSelector(ratingIcon)));
		}
	}

}

export class PreReleaseBookmarkWidget extends ExtensionWidget {

	private element?: HTMLElement;
	private readonly disposables = this._register(new DisposableStore());

	constructor(
		private parent: HTMLElement,
	) {
		super();
		this.render();
		this._register(toDisposable(() => this.clear()));
	}

	private clear(): void {
		if (this.element) {
			this.parent.removeChild(this.element);
		}
		this.element = undefined;
		this.disposables.clear();
	}

	render(): void {
		this.clear();
		if (!this.extension) {
			return;
		}
		if (!this.extension.hasPreReleaseVersion) {
			return;
		}
		if (this.extension.state === ExtensionState.Installed && !this.extension.local?.isPreReleaseVersion) {
			return;
		}
		this.element = append(this.parent, $('div.extension-bookmark'));
		const preRelease = append(this.element, $('.pre-release'));
		append(preRelease, $('span' + ThemeIcon.asCSSSelector(preReleaseIcon)));
	}

}

export class RemoteBadgeWidget extends ExtensionWidget {

	private readonly remoteBadge = this._register(new MutableDisposable<RemoteBadge>());

	private element: HTMLElement;

	constructor(
		parent: HTMLElement,
		private readonly tooltip: boolean,
		@IExtensionManagementServerService private readonly extensionManagementServerService: IExtensionManagementServerService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super();
		this.element = append(parent, $('.extension-remote-badge-container'));
		this.render();
		this._register(toDisposable(() => this.clear()));
	}

	private clear(): void {
		if (this.remoteBadge.value) {
			this.element.removeChild(this.remoteBadge.value.element);
		}
		this.remoteBadge.clear();
	}

	render(): void {
		this.clear();
		if (!this.extension || !this.extension.local || !this.extension.server || !(this.extensionManagementServerService.localExtensionManagementServer && this.extensionManagementServerService.remoteExtensionManagementServer) || this.extension.server !== this.extensionManagementServerService.remoteExtensionManagementServer) {
			return;
		}
		this.remoteBadge.value = this.instantiationService.createInstance(RemoteBadge, this.tooltip);
		append(this.element, this.remoteBadge.value.element);
	}
}

class RemoteBadge extends Disposable {

	readonly element: HTMLElement;

	constructor(
		private readonly tooltip: boolean,
		@ILabelService private readonly labelService: ILabelService,
		@IThemeService private readonly themeService: IThemeService,
		@IExtensionManagementServerService private readonly extensionManagementServerService: IExtensionManagementServerService
	) {
		super();
		this.element = $('div.extension-badge.extension-remote-badge');
		this.render();
	}

	private render(): void {
		append(this.element, $('span' + ThemeIcon.asCSSSelector(remoteIcon)));

		const applyBadgeStyle = () => {
			if (!this.element) {
				return;
			}
			const bgColor = this.themeService.getColorTheme().getColor(EXTENSION_BADGE_REMOTE_BACKGROUND);
			const fgColor = this.themeService.getColorTheme().getColor(EXTENSION_BADGE_REMOTE_FOREGROUND);
			this.element.style.backgroundColor = bgColor ? bgColor.toString() : '';
			this.element.style.color = fgColor ? fgColor.toString() : '';
		};
		applyBadgeStyle();
		this._register(this.themeService.onDidColorThemeChange(() => applyBadgeStyle()));

		if (this.tooltip) {
			const updateTitle = () => {
				if (this.element && this.extensionManagementServerService.remoteExtensionManagementServer) {
					this.element.title = localize('remote extension title', "Extension in {0}", this.extensionManagementServerService.remoteExtensionManagementServer.label);
				}
			};
			this._register(this.labelService.onDidChangeFormatters(() => updateTitle()));
			updateTitle();
		}
	}
}

export class ExtensionPackCountWidget extends ExtensionWidget {

	private element: HTMLElement | undefined;

	constructor(
		private readonly parent: HTMLElement,
	) {
		super();
		this.render();
		this._register(toDisposable(() => this.clear()));
	}

	private clear(): void {
		this.element?.remove();
	}

	render(): void {
		this.clear();
		if (!this.extension || !(this.extension.categories?.some(category => category.toLowerCase() === 'extension packs')) || !this.extension.extensionPack.length) {
			return;
		}
		this.element = append(this.parent, $('.extension-badge.extension-pack-badge'));
		const countBadge = new CountBadge(this.element, {}, defaultCountBadgeStyles);
		countBadge.setCount(this.extension.extensionPack.length);
	}
}

export class SyncIgnoredWidget extends ExtensionWidget {

	constructor(
		private readonly container: HTMLElement,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IExtensionsWorkbenchService private readonly extensionsWorkbenchService: IExtensionsWorkbenchService,
		@IUserDataSyncEnablementService private readonly userDataSyncEnablementService: IUserDataSyncEnablementService,
	) {
		super();
		this._register(Event.filter(this.configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('settingsSync.ignoredExtensions'))(() => this.render()));
		this._register(userDataSyncEnablementService.onDidChangeEnablement(() => this.update()));
		this.render();
	}

	render(): void {
		this.container.innerText = '';

		if (this.extension && this.extension.state === ExtensionState.Installed && this.userDataSyncEnablementService.isEnabled() && this.extensionsWorkbenchService.isExtensionIgnoredToSync(this.extension)) {
			const element = append(this.container, $('span.extension-sync-ignored' + ThemeIcon.asCSSSelector(syncIgnoredIcon)));
			element.title = localize('syncingore.label', "This extension is ignored during sync.");
			element.classList.add(...ThemeIcon.asClassNameArray(syncIgnoredIcon));
		}
	}
}

export class ExtensionActivationStatusWidget extends ExtensionWidget {

	constructor(
		private readonly container: HTMLElement,
		private readonly small: boolean,
		@IExtensionService extensionService: IExtensionService,
		@IExtensionsWorkbenchService private readonly extensionsWorkbenchService: IExtensionsWorkbenchService,
	) {
		super();
		this._register(extensionService.onDidChangeExtensionsStatus(extensions => {
			if (this.extension && extensions.some(e => areSameExtensions({ id: e.value }, this.extension!.identifier))) {
				this.update();
			}
		}));
	}

	render(): void {
		this.container.innerText = '';

		if (!this.extension) {
			return;
		}

		const extensionStatus = this.extensionsWorkbenchService.getExtensionStatus(this.extension);
		if (!extensionStatus || !extensionStatus.activationTimes) {
			return;
		}

		const activationTime = extensionStatus.activationTimes.codeLoadingTime + extensionStatus.activationTimes.activateCallTime;
		if (this.small) {
			append(this.container, $('span' + ThemeIcon.asCSSSelector(activationTimeIcon)));
			const activationTimeElement = append(this.container, $('span.activationTime'));
			activationTimeElement.textContent = `${activationTime}ms`;
		} else {
			const activationTimeElement = append(this.container, $('span.activationTime'));
			activationTimeElement.textContent = `${localize('activation', "Activation time")}${extensionStatus.activationTimes.activationReason.startup ? ` (${localize('startup', "Startup")})` : ''} : ${activationTime}ms`;
		}

	}

}

export type ExtensionHoverOptions = {
	position: () => HoverPosition;
	readonly target: HTMLElement;
};

export class ExtensionHoverWidget extends ExtensionWidget {

	private readonly hover = this._register(new MutableDisposable<IDisposable>());

	constructor(
		private readonly options: ExtensionHoverOptions,
		private readonly extensionStatusAction: ExtensionStatusAction,
		@IExtensionsWorkbenchService private readonly extensionsWorkbenchService: IExtensionsWorkbenchService,
		@IHoverService private readonly hoverService: IHoverService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IExtensionRecommendationsService private readonly extensionRecommendationsService: IExtensionRecommendationsService,
		@IThemeService private readonly themeService: IThemeService,
	) {
		super();
	}

	render(): void {
		this.hover.value = undefined;
		if (this.extension) {
			this.hover.value = setupCustomHover({
				delay: this.configurationService.getValue<number>('workbench.hover.delay'),
				showHover: (options) => {
					return this.hoverService.showHover({
						...options,
						hoverPosition: this.options.position(),
						forcePosition: true,
						additionalClasses: ['extension-hover']
					});
				},
				placement: 'element'
			}, this.options.target, { markdown: () => Promise.resolve(this.getHoverMarkdown()), markdownNotSupportedFallback: undefined });
		}
	}

	private getHoverMarkdown(): MarkdownString | undefined {
		if (!this.extension) {
			return undefined;
		}
		const markdown = new MarkdownString('', { isTrusted: true, supportThemeIcons: true });

		markdown.appendMarkdown(`**${this.extension.displayName}**`);
		if (semver.valid(this.extension.version)) {
			markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">**&nbsp;_v${this.extension.version}_**&nbsp;</span>`);
		}
		if (this.extension.state === ExtensionState.Installed ? this.extension.local?.isPreReleaseVersion : this.extension.gallery?.properties.isPreReleaseVersion) {
			const extensionPreReleaseIcon = this.themeService.getColorTheme().getColor(extensionPreReleaseIconColor);
			markdown.appendMarkdown(`**&nbsp;**&nbsp;<span style="color:#ffffff;background-color:${extensionPreReleaseIcon ? Color.Format.CSS.formatHex(extensionPreReleaseIcon) : '#ffffff'};">&nbsp;$(${preReleaseIcon.id})&nbsp;${localize('pre-release-label', "Pre-Release")}&nbsp;</span>`);
		}
		markdown.appendText(`\n`);

		if (this.extension.state === ExtensionState.Installed) {
			let addSeparator = false;
			const installLabel = InstallCountWidget.getInstallLabel(this.extension, true);
			if (installLabel) {
				if (addSeparator) {
					markdown.appendText(`  |  `);
				}
				markdown.appendMarkdown(`$(${installCountIcon.id}) ${installLabel}`);
				addSeparator = true;
			}
			if (this.extension.rating) {
				if (addSeparator) {
					markdown.appendText(`  |  `);
				}
				const rating = Math.round(this.extension.rating * 2) / 2;
				markdown.appendMarkdown(`$(${starFullIcon.id}) [${rating}](${this.extension.url}&ssr=false#review-details)`);
				addSeparator = true;
			}
			if (this.extension.publisherSponsorLink) {
				if (addSeparator) {
					markdown.appendText(`  |  `);
				}
				markdown.appendMarkdown(`$(${sponsorIcon.id}) [${localize('sponsor', "Sponsor")}](${this.extension.publisherSponsorLink})`);
				addSeparator = true;
			}
			if (addSeparator) {
				markdown.appendText(`\n`);
			}
		}

		if (this.extension.description) {
			markdown.appendMarkdown(`${this.extension.description}`);
			markdown.appendText(`\n`);
		}

		if (this.extension.publisherDomain?.verified) {
			const bgColor = this.themeService.getColorTheme().getColor(extensionVerifiedPublisherIconColor);
			const publisherVerifiedTooltip = localize('publisher verified tooltip', "This publisher has verified ownership of {0}", `[${URI.parse(this.extension.publisherDomain.link).authority}](${this.extension.publisherDomain.link})`);
			markdown.appendMarkdown(`<span style="color:${bgColor ? Color.Format.CSS.formatHex(bgColor) : '#ffffff'};">$(${verifiedPublisherIcon.id})</span>&nbsp;${publisherVerifiedTooltip}`);
			markdown.appendText(`\n`);
		}

		if (this.extension.outdated) {
			markdown.appendMarkdown(localize('updateRequired', "Latest version:"));
			markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">**&nbsp;_v${this.extension.latestVersion}_**&nbsp;</span>`);
			markdown.appendText(`\n`);
		}

		const preReleaseMessage = ExtensionHoverWidget.getPreReleaseMessage(this.extension);
		const extensionRuntimeStatus = this.extensionsWorkbenchService.getExtensionStatus(this.extension);
		const extensionStatus = this.extensionStatusAction.status;
		const reloadRequiredMessage = this.extension.reloadRequiredStatus;
		const recommendationMessage = this.getRecommendationMessage(this.extension);

		if (extensionRuntimeStatus || extensionStatus || reloadRequiredMessage || recommendationMessage || preReleaseMessage) {

			markdown.appendMarkdown(`---`);
			markdown.appendText(`\n`);

			if (extensionRuntimeStatus) {
				if (extensionRuntimeStatus.activationTimes) {
					const activationTime = extensionRuntimeStatus.activationTimes.codeLoadingTime + extensionRuntimeStatus.activationTimes.activateCallTime;
					markdown.appendMarkdown(`${localize('activation', "Activation time")}${extensionRuntimeStatus.activationTimes.activationReason.startup ? ` (${localize('startup', "Startup")})` : ''}: \`${activationTime}ms\``);
					markdown.appendText(`\n`);
				}
				if (extensionRuntimeStatus.runtimeErrors.length || extensionRuntimeStatus.messages.length) {
					const hasErrors = extensionRuntimeStatus.runtimeErrors.length || extensionRuntimeStatus.messages.some(message => message.type === Severity.Error);
					const hasWarnings = extensionRuntimeStatus.messages.some(message => message.type === Severity.Warning);
					const errorsLink = extensionRuntimeStatus.runtimeErrors.length ? `[${extensionRuntimeStatus.runtimeErrors.length === 1 ? localize('uncaught error', '1 uncaught error') : localize('uncaught errors', '{0} uncaught errors', extensionRuntimeStatus.runtimeErrors.length)}](${URI.parse(`command:extension.open?${encodeURIComponent(JSON.stringify([this.extension.identifier.id, ExtensionEditorTab.RuntimeStatus]))}`)})` : undefined;
					const messageLink = extensionRuntimeStatus.messages.length ? `[${extensionRuntimeStatus.messages.length === 1 ? localize('message', '1 message') : localize('messages', '{0} messages', extensionRuntimeStatus.messages.length)}](${URI.parse(`command:extension.open?${encodeURIComponent(JSON.stringify([this.extension.identifier.id, ExtensionEditorTab.RuntimeStatus]))}`)})` : undefined;
					markdown.appendMarkdown(`$(${hasErrors ? errorIcon.id : hasWarnings ? warningIcon.id : infoIcon.id}) This extension has reported `);
					if (errorsLink && messageLink) {
						markdown.appendMarkdown(`${errorsLink} and ${messageLink}`);
					} else {
						markdown.appendMarkdown(`${errorsLink || messageLink}`);
					}
					markdown.appendText(`\n`);
				}
			}

			if (extensionStatus) {
				if (extensionStatus.icon) {
					markdown.appendMarkdown(`$(${extensionStatus.icon.id})&nbsp;`);
				}
				markdown.appendMarkdown(extensionStatus.message.value);
				if (this.extension.enablementState === EnablementState.DisabledByExtensionDependency && this.extension.local) {
					markdown.appendMarkdown(`&nbsp;[${localize('dependencies', "Show Dependencies")}](${URI.parse(`command:extension.open?${encodeURIComponent(JSON.stringify([this.extension.identifier.id, ExtensionEditorTab.Dependencies]))}`)})`);
				}
				markdown.appendText(`\n`);
			}

			if (reloadRequiredMessage) {
				markdown.appendMarkdown(`$(${infoIcon.id})&nbsp;`);
				markdown.appendMarkdown(`${reloadRequiredMessage}`);
				markdown.appendText(`\n`);
			}

			if (preReleaseMessage) {
				const extensionPreReleaseIcon = this.themeService.getColorTheme().getColor(extensionPreReleaseIconColor);
				markdown.appendMarkdown(`<span style="color:${extensionPreReleaseIcon ? Color.Format.CSS.formatHex(extensionPreReleaseIcon) : '#ffffff'};">$(${preReleaseIcon.id})</span>&nbsp;${preReleaseMessage}`);
				markdown.appendText(`\n`);
			}

			if (recommendationMessage) {
				markdown.appendMarkdown(recommendationMessage);
				markdown.appendText(`\n`);
			}
		}

		return markdown;
	}

	private getRecommendationMessage(extension: IExtension): string | undefined {
		if (extension.state === ExtensionState.Installed) {
			return undefined;
		}
		if (extension.deprecationInfo) {
			return undefined;
		}
		const recommendation = this.extensionRecommendationsService.getAllRecommendationsWithReason()[extension.identifier.id.toLowerCase()];
		if (!recommendation?.reasonText) {
			return undefined;
		}
		const bgColor = this.themeService.getColorTheme().getColor(extensionButtonProminentBackground);
		return `<span style="color:${bgColor ? Color.Format.CSS.formatHex(bgColor) : '#ffffff'};">$(${starEmptyIcon.id})</span>&nbsp;${recommendation.reasonText}`;
	}

	static getPreReleaseMessage(extension: IExtension): string | undefined {
		if (!extension.hasPreReleaseVersion) {
			return undefined;
		}
		if (extension.isBuiltin) {
			return undefined;
		}
		if (extension.local?.isPreReleaseVersion || extension.gallery?.properties.isPreReleaseVersion) {
			return undefined;
		}
		const preReleaseVersionLink = `[${localize('Show prerelease version', "Pre-Release version")}](${URI.parse(`command:workbench.extensions.action.showPreReleaseVersion?${encodeURIComponent(JSON.stringify([extension.identifier.id]))}`)})`;
		return localize('has prerelease', "This extension has a {0} available", preReleaseVersionLink);
	}

}

export class ExtensionStatusWidget extends ExtensionWidget {

	private readonly renderDisposables = this._register(new DisposableStore());

	private readonly _onDidRender = this._register(new Emitter<void>());
	readonly onDidRender: Event<void> = this._onDidRender.event;

	constructor(
		private readonly container: HTMLElement,
		private readonly extensionStatusAction: ExtensionStatusAction,
		@IOpenerService private readonly openerService: IOpenerService,
	) {
		super();
		this.render();
		this._register(extensionStatusAction.onDidChangeStatus(() => this.render()));
	}

	render(): void {
		reset(this.container);
		const extensionStatus = this.extensionStatusAction.status;
		if (extensionStatus) {
			const markdown = new MarkdownString('', { isTrusted: true, supportThemeIcons: true });
			if (extensionStatus.icon) {
				markdown.appendMarkdown(`$(${extensionStatus.icon.id})&nbsp;`);
			}
			markdown.appendMarkdown(extensionStatus.message.value);
			const rendered = this.renderDisposables.add(renderMarkdown(markdown, {
				actionHandler: {
					callback: (content) => {
						this.openerService.open(content, { allowCommands: true }).catch(onUnexpectedError);
					},
					disposables: this.renderDisposables
				}
			}));
			append(this.container, rendered.element);
		}
		this._onDidRender.fire();
	}
}

export class ExtensionRecommendationWidget extends ExtensionWidget {

	private readonly _onDidRender = this._register(new Emitter<void>());
	readonly onDidRender: Event<void> = this._onDidRender.event;

	constructor(
		private readonly container: HTMLElement,
		@IExtensionRecommendationsService private readonly extensionRecommendationsService: IExtensionRecommendationsService,
		@IExtensionIgnoredRecommendationsService private readonly extensionIgnoredRecommendationsService: IExtensionIgnoredRecommendationsService,
	) {
		super();
		this.render();
		this._register(this.extensionRecommendationsService.onDidChangeRecommendations(() => this.render()));
	}

	render(): void {
		reset(this.container);
		const recommendationStatus = this.getRecommendationStatus();
		if (recommendationStatus) {
			if (recommendationStatus.icon) {
				append(this.container, $(`div${ThemeIcon.asCSSSelector(recommendationStatus.icon)}`));
			}
			append(this.container, $(`div.recommendation-text`, undefined, recommendationStatus.message));
		}
		this._onDidRender.fire();
	}

	private getRecommendationStatus(): { icon: ThemeIcon | undefined; message: string } | undefined {
		if (!this.extension
			|| this.extension.deprecationInfo
			|| this.extension.state === ExtensionState.Installed
		) {
			return undefined;
		}
		const extRecommendations = this.extensionRecommendationsService.getAllRecommendationsWithReason();
		if (extRecommendations[this.extension.identifier.id.toLowerCase()]) {
			const reasonText = extRecommendations[this.extension.identifier.id.toLowerCase()].reasonText;
			if (reasonText) {
				return { icon: starEmptyIcon, message: reasonText };
			}
		} else if (this.extensionIgnoredRecommendationsService.globalIgnoredRecommendations.indexOf(this.extension.identifier.id.toLowerCase()) !== -1) {
			return { icon: undefined, message: localize('recommendationHasBeenIgnored', "You have chosen not to receive recommendations for this extension.") };
		}
		return undefined;
	}
}

export const extensionRatingIconColor = registerColor('extensionIcon.starForeground', { light: '#DF6100', dark: '#FF8E00', hcDark: '#FF8E00', hcLight: textLinkForeground }, localize('extensionIconStarForeground', "The icon color for extension ratings."), true);
export const extensionVerifiedPublisherIconColor = registerColor('extensionIcon.verifiedForeground', { dark: textLinkForeground, light: textLinkForeground, hcDark: textLinkForeground, hcLight: textLinkForeground }, localize('extensionIconVerifiedForeground', "The icon color for extension verified publisher."), true);
export const extensionPreReleaseIconColor = registerColor('extensionIcon.preReleaseForeground', { dark: '#1d9271', light: '#1d9271', hcDark: '#1d9271', hcLight: textLinkForeground }, localize('extensionPreReleaseForeground', "The icon color for pre-release extension."), true);
export const extensionSponsorIconColor = registerColor('extensionIcon.sponsorForeground', { light: '#B51E78', dark: '#D758B3', hcDark: null, hcLight: '#B51E78' }, localize('extensionIcon.sponsorForeground', "The icon color for extension sponsor."), true);

registerThemingParticipant((theme, collector) => {
	const extensionRatingIcon = theme.getColor(extensionRatingIconColor);
	if (extensionRatingIcon) {
		collector.addRule(`.extension-ratings .codicon-extensions-star-full, .extension-ratings .codicon-extensions-star-half { color: ${extensionRatingIcon}; }`);
		collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(starFullIcon)} { color: ${extensionRatingIcon}; }`);
	}

	const extensionVerifiedPublisherIcon = theme.getColor(extensionVerifiedPublisherIconColor);
	if (extensionVerifiedPublisherIcon) {
		collector.addRule(`${ThemeIcon.asCSSSelector(verifiedPublisherIcon)} { color: ${extensionVerifiedPublisherIcon}; }`);
	}

	collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(sponsorIcon)} { color: var(--vscode-extensionIcon-sponsorForeground); }`);
	collector.addRule(`.extension-editor > .header > .details > .subtitle .sponsor ${ThemeIcon.asCSSSelector(sponsorIcon)} { color: var(--vscode-extensionIcon-sponsorForeground); }`);
});
