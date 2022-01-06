/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/extensionsWidgets';
import { Disposable, toDisposable, DisposableStore, MutableDisposable, IDisposable } from 'vs/base/common/lifecycle';
import { IExtension, IExtensionsWorkbenchService, IExtensionContainer, ExtensionState, ExtensionEditorTab } from 'vs/workbench/contrib/extensions/common/extensions';
import { append, $ } from 'vs/base/browser/dom';
import * as platform from 'vs/base/common/platform';
import { localize } from 'vs/nls';
import { EnablementState, IExtensionManagementServerService } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { IExtensionRecommendationsService } from 'vs/workbench/services/extensionRecommendations/common/extensionRecommendations';
import { ILabelService } from 'vs/platform/label/common/label';
import { extensionButtonProminentBackground, extensionButtonProminentForeground, ExtensionStatusAction, ReloadAction } from 'vs/workbench/contrib/extensions/browser/extensionsActions';
import { IThemeService, ThemeIcon, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { EXTENSION_BADGE_REMOTE_BACKGROUND, EXTENSION_BADGE_REMOTE_FOREGROUND } from 'vs/workbench/common/theme';
import { Event } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CountBadge } from 'vs/base/browser/ui/countBadge/countBadge';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IUserDataAutoSyncEnablementService } from 'vs/platform/userDataSync/common/userDataSync';
import { activationTimeIcon, errorIcon, infoIcon, installCountIcon, ratingIcon, remoteIcon, starEmptyIcon, starFullIcon, starHalfIcon, syncIgnoredIcon, warningIcon } from 'vs/workbench/contrib/extensions/browser/extensionsIcons';
import { registerColor } from 'vs/platform/theme/common/colorRegistry';
import { IHoverService } from 'vs/workbench/services/hover/browser/hover';
import { HoverPosition } from 'vs/base/browser/ui/hover/hoverWidget';
import { MarkdownString } from 'vs/base/common/htmlContent';
import { URI } from 'vs/base/common/uri';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { areSameExtensions } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import Severity from 'vs/base/common/severity';
import { setupCustomHover } from 'vs/base/browser/ui/iconLabel/iconLabelHover';
import { Color } from 'vs/base/common/color';

export abstract class ExtensionWidget extends Disposable implements IExtensionContainer {
	private _extension: IExtension | null = null;
	get extension(): IExtension | null { return this._extension; }
	set extension(extension: IExtension | null) { this._extension = extension; this.update(); }
	update(): void { this.render(); }
	abstract render(): void;
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
			installLabel = installCount.toLocaleString(platform.locale);
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
		if (!this.extension) {
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
		if (this.element) {
			this.element.remove();
		}
	}

	render(): void {
		this.clear();
		if (!this.extension || !(this.extension.categories?.some(category => category.toLowerCase() === 'extension packs')) || !this.extension.extensionPack.length) {
			return;
		}
		this.element = append(this.parent, $('.extension-badge.extension-pack-badge'));
		const countBadge = new CountBadge(this.element);
		countBadge.setCount(this.extension.extensionPack.length);
	}
}

export class SyncIgnoredWidget extends ExtensionWidget {

	private element: HTMLElement;

	constructor(
		container: HTMLElement,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IExtensionsWorkbenchService private readonly extensionsWorkbenchService: IExtensionsWorkbenchService,
		@IUserDataAutoSyncEnablementService private readonly userDataAutoSyncEnablementService: IUserDataAutoSyncEnablementService,
	) {
		super();
		this.element = append(container, $('span.extension-sync-ignored' + ThemeIcon.asCSSSelector(syncIgnoredIcon)));
		this.element.title = localize('syncingore.label', "This extension is ignored during sync.");
		this.element.classList.add(...ThemeIcon.asClassNameArray(syncIgnoredIcon));
		this.element.classList.add('hide');
		this._register(Event.filter(this.configurationService.onDidChangeConfiguration, e => e.affectedKeys.includes('settingsSync.ignoredExtensions'))(() => this.render()));
		this._register(userDataAutoSyncEnablementService.onDidChangeEnablement(() => this.update()));
		this.render();
	}

	render(): void {
		this.element.classList.toggle('hide', !(this.extension && this.extension.state === ExtensionState.Installed && this.userDataAutoSyncEnablementService.isEnabled() && this.extensionsWorkbenchService.isExtensionIgnoredToSync(this.extension)));
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
		private readonly reloadAction: ReloadAction,
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

		markdown.appendMarkdown(`**${this.extension.displayName}**&nbsp;_v${this.extension.version}_`);
		markdown.appendText(`\n`);

		if (this.extension.description) {
			markdown.appendMarkdown(`${this.extension.description}`);
			markdown.appendText(`\n`);
		}

		const extensionRuntimeStatus = this.extensionsWorkbenchService.getExtensionStatus(this.extension);
		const extensionStatus = this.extensionStatusAction.status;
		const reloadRequiredMessage = this.reloadAction.enabled ? this.reloadAction.tooltip : '';
		const recommendationMessage = this.getRecommendationMessage(this.extension);

		if (extensionRuntimeStatus || extensionStatus || reloadRequiredMessage || recommendationMessage) {

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

			if (recommendationMessage) {
				markdown.appendMarkdown(recommendationMessage);
				markdown.appendText(`\n`);
			}
		}

		return markdown;
	}

	private getRecommendationMessage(extension: IExtension): string | undefined {
		const recommendation = this.extensionRecommendationsService.getAllRecommendationsWithReason()[extension.identifier.id.toLowerCase()];
		if (recommendation?.reasonText) {
			const bgColor = this.themeService.getColorTheme().getColor(extensionButtonProminentBackground);
			return `<span style="color:${bgColor ? Color.Format.CSS.formatHex(bgColor) : '#ffffff'};">$(${starEmptyIcon.id})</span>&nbsp;${recommendation.reasonText}`;
		}
		return undefined;
	}

}

// Rating icon
export const extensionRatingIconColor = registerColor('extensionIcon.starForeground', { light: '#DF6100', dark: '#FF8E00', hc: '#FF8E00' }, localize('extensionIconStarForeground', "The icon color for extension ratings."), true);

registerThemingParticipant((theme, collector) => {
	const extensionRatingIcon = theme.getColor(extensionRatingIconColor);
	if (extensionRatingIcon) {
		collector.addRule(`.extension-ratings .codicon-extensions-star-full, .extension-ratings .codicon-extensions-star-half { color: ${extensionRatingIcon}; }`);
	}

	const fgColor = theme.getColor(extensionButtonProminentForeground);
	if (fgColor) {
		collector.addRule(`.extension-bookmark .recommendation { color: ${fgColor}; }`);
	}

	const bgColor = theme.getColor(extensionButtonProminentBackground);
	if (bgColor) {
		collector.addRule(`.extension-bookmark .recommendation { border-top-color: ${bgColor}; }`);
		collector.addRule(`.monaco-workbench .extension-editor > .header > .details > .recommendation .codicon { color: ${bgColor}; }`);
	}
});
