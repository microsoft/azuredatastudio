/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { append, $ } from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { IExtensionManifest } from 'vs/platform/extensions/common/extensions';
import { IDashboardTabContrib, IExtensionContributions, IInsightTypeContrib } from 'sql/platform/extensions/common/extensions';

class ContributionReader {
	constructor(private manifest: IExtensionManifest) { }

	public dashboardInsights(): IInsightTypeContrib[] {
		let contributes = this.manifest.contributes;
		if (contributes) {
			let insights = (contributes as IExtensionContributions)['dashboard.insights'];
			if (insights) {
				if (!Array.isArray(insights)) {
					return [insights];
				}
				return insights;
			}
		}
		return [];
	}

	public dashboardTabs(): IDashboardTabContrib[] {
		let contributes = this.manifest.contributes;
		if (contributes) {
			let tabs = (contributes as IExtensionContributions)['dashboard.tabs'];
			if (tabs) {
				if (!Array.isArray(tabs)) {
					return [tabs];
				}
				return tabs;
			}
		}
		return [];
	}
}

export function renderDashboardContributions(container: HTMLElement, manifest: IExtensionManifest, onDetailsToggle: Function): boolean {
	let contributionReader = new ContributionReader(manifest);
	renderDashboardTabs(onDetailsToggle, contributionReader, container);
	renderDashboardInsights(onDetailsToggle, contributionReader, container);
	return true;
}

function renderDashboardTabs(onDetailsToggle: Function, contributionReader: ContributionReader, container: HTMLElement): boolean {
	let tabs = contributionReader.dashboardTabs();

	if (!tabs || !tabs.length) {
		return false;
	}

	const details = $('details', { open: true, ontoggle: onDetailsToggle },
		$('summary', undefined, localize('tabs', "Dashboard Tabs ({0})", tabs.length)),
		$('table', undefined,
			$('tr', undefined,
				$('th', undefined, localize('tabId', "Id")),
				$('th', undefined, localize('tabTitle', "Title")),
				$('th', undefined, localize('tabDescription', "Description"))
			),
			...tabs.map(tab => $('tr', undefined,
				$('td', undefined, $('code', undefined, tab.id)),
				$('td', undefined, tab.title ? tab.title : tab.id),
				$('td', undefined, tab.description ?? ''),
			))
		)
	);

	append(container, details);
	return true;
}

function renderDashboardInsights(onDetailsToggle: Function, contributionReader: ContributionReader, container: HTMLElement): boolean {
	let insights = contributionReader.dashboardInsights();

	if (!insights || !insights.length) {
		return false;
	}

	const details = $('details', { open: true, ontoggle: onDetailsToggle },
		$('summary', undefined, localize('insights', "Dashboard Insights ({0})", insights.length)),
		$('table', undefined,
			$('tr', undefined,
				$('th', undefined, localize('insightId', "Id")),
				$('th', undefined, localize('name', "Name")),
				$('th', undefined, localize('insight condition', "When"))
			),
			...insights.map(insight => $('tr', undefined,
				$('td', undefined, $('code', undefined, insight.id)),
				$('td', undefined, insight.contrib.name ? insight.contrib.name : insight.id),
				$('td', undefined, insight.contrib.when ?? ''),
			))
		)
	);

	append(container, details);
	return true;
}
