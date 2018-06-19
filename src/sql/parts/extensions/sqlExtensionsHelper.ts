/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!vs/workbench/parts/extensions/electron-browser/media/extensionEditor';


import { IExtensionManifest } from 'vs/platform/extensionManagement/common/extensionManagement';
import { Color } from 'vs/base/common/color';
import { append, $, addClass, removeClass, finalHandler, join, toggleClass } from 'vs/base/browser/dom';
import { IInsightTypeContrib } from 'sql/parts/dashboard/widgets/insights/interfaces';
import { IDashboardTabContrib } from 'sql/parts/dashboard/common/dashboardTab.contribution';
import { localize } from 'vs/nls';

class ContributionReader {
	constructor(private manifest: IExtensionManifest) { }

	public dashboardInsights(): IInsightTypeContrib[] {
		let contributes = this.manifest.contributes;
		if (contributes) {
			let insights: IInsightTypeContrib | IInsightTypeContrib[] = contributes['dashboard.insights'];
			if (insights) {
				if (!Array.isArray(insights)) {
					return [insights];
				}
				return insights;
			}
		}
		return undefined;
	}

	public dashboardTabs(): IDashboardTabContrib[] {
		let contributes = this.manifest.contributes;
		if (contributes) {
			let tabs: IDashboardTabContrib | IDashboardTabContrib[] = contributes['dashboard.tabs'];
			if (tabs) {
				if (!Array.isArray(tabs)) {
					return [tabs];
				}
				return tabs;
			}
		}
		return undefined;
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
		$('summary', null, localize('tabs', "Dashboard Tabs ({0})", tabs.length)),
		$('table', null,
			$('tr', null,
				$('th', null, localize('tabId', "Id")),
				$('th', null, localize('tabTitle', "Title")),
				$('th', null, localize('tabDescription', "Description"))
			),
			...tabs.map(tab => $('tr', null,
				$('td', null, $('code', null, tab.id)),
				$('td', null, tab.title ? tab.title : tab.id),
				$('td', null, tab.description),
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
		$('summary', null, localize('insights', "Dashboard Insights ({0})", insights.length)),
		$('table', null,
			$('tr', null,
				$('th', null, localize('insightId', "Id")),
				$('th', null, localize('name', "Name")),
				$('th', null, localize('insight condition', "When"))
			),
			...insights.map(insight => $('tr', null,
				$('td', null, $('code', null, insight.id)),
				$('td', null, insight.contrib.name ? insight.contrib.name : insight.id),
				$('td', null, insight.contrib.when),
			))
		)
	);

	append(container, details);
	return true;
}

