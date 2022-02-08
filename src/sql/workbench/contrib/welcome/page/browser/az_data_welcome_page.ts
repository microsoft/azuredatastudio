/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AddServerAction } from 'sql/workbench/services/objectExplorer/browser/connectionTreeAction';
import { escape } from 'vs/base/common/strings';
import { localize } from 'vs/nls';

const previewImgDescription = escape(localize('welcomePage.previewBody', "This feature page is in preview. Preview features introduce new functionalities that are on track to becoming a permanent part the product. They are stable, but need additional accessibility improvements. We welcome your early feedback while they are under development."));

// Note - this content is passed through an HTML sanitizer defined in src\vs\base\browser\dom.ts (safeInnerHtml). If something
// isn't rendering correctly make sure that the tags/attributes and schemas are all listed in the allowed lists.
export default () => `
<div class="welcomePageContainer">
	<div class="welcomePage">
		<div class="ads-homepage splash">
			<div class="gradient">
				<div class="content-container">
					<div class="ads-homepage-section tool-tip">
						<div class="tool-tip-container" id="tool-tip-container-wide">
							<a role="img" tabindex=0 class="ads-welcome-page-link preview-link" aria-label="${previewImgDescription}" title="${previewImgDescription}" id="preview-link-wide" tabindex="0" name="preview"><p>${escape(localize('welcomePage.preview', "Preview"))}</p><i class="icon-info themed-icon"></i></a>
						</div>
					</div>
					<div class="ads-homepage-section section header hero">
						<div class="row start">
							<div class="header-top-nav">
								<div class="flex">
									<div class="caption-container" style="display: flex;">
										<div class="icon"></div>
										<div class="flex flex-d-column title">
											<h1 class="caption flex flex-w-wrap"></h1>
											<div>
												<div id="welcome-page-button-container" class="flex btn-container"></div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row header-bottom-nav-tiles ads-grid">
							<div class="col">
								<a role="button" class="header-bottom-nav-tile-link ads-welcome-page-link" href="command:${AddServerAction.ID}">
									<div class="header-bottom-nav-tile tile tile-connection">
										<h3>${escape(localize('welcomePage.createConnection', "Create a connection"))}</h3>
										<p>${escape(localize('welcomePage.createConnectionBody', "Connect to a database instance through the connection dialog."))}</p>
										<div class="icon connection"></div>
									</div>
								</a>
							</div>
							<div class="col">
								<a role="button" class="header-bottom-nav-tile-link ads-welcome-page-link"
									href="command:workbench.action.files.newUntitledFile">
									<div class="header-bottom-nav-tile tile tile-query">
										<h3>${escape(localize('welcomePage.runQuery', "Run a query"))}</h3>
										<p>${escape(localize('welcomePage.runQueryBody', "Interact with data through a query editor."))}</p>
										<div class="icon query"></div>
									</div>
								</a>
							</div>
							<div class="col">
								<a role="button" class="header-bottom-nav-tile-link ads-welcome-page-link" href="command:notebook.command.new">
									<div class="header-bottom-nav-tile tile tile-notebook">
										<h3>${escape(localize('welcomePage.createNotebook', "Create a notebook"))}</h3>
										<p>${escape(localize('welcomePage.createNotebookBody', "Build a new notebook using a native notebook editor."))}</p>
										<div class="icon notebook"></div>
									</div>
								</a>
							</div>
							<div class="col">
								<a role="button" class="header-bottom-nav-tile-link ads-welcome-page-link" href="command:azdata.resource.deploy">
									<div class="header-bottom-nav-tile tile tile-server">
										<h3>${escape(localize('welcomePage.deployServer', "Deploy a server"))}</h3>
										<p>${escape(localize('welcomePage.deployServerBody', "Create a new instance of a relational data service on the platform of your choice."))}</p>
										<div class="icon server"></div>
									</div>
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="ads-homepage-section middle-section content row content-container">
				<div class="resources-container">
					<h2>${escape(localize('welcomePage.resources', "Resources"))}</h2>
					<div class="tabs">
					<!-- Radio button is not accessible to user yet, this feature is still in development -->
					<input tabindex="-1" aria-hidden="true" class="input" name="tabs" type="radio" id="tab-1" checked="checked" />
					<span id="historyLabel" class="label" for="tab-1" tabIndex="0" role="tab">${escape(localize('welcomePage.history', "History"))}</span>
						<div class="panel">
							<div class="recent history">
								<div class="flex list-header-container">
									<i class="icon-document themed-icon"></i>
									<span class="list-header">${escape(localize('welcomePage.name', "Name"))}</span>
									<span class="list-header-last-opened">${escape(localize('welcomePage.location', "Location"))}</span>
								</div>
								<ul class="list">
									<!-- Filled programmatically -->
								</ul>
								<p class="none detail">No recent folders</p>
								<div class="moreRecent">
									<a role="button" class="ads-welcome-page-link" href="command:workbench.action.openRecent">${escape(localize('welcomePage.moreRecent', "Show more"))}
									<i class="icon-arrow-down-dark"></i>
									</a>
								</div>
							</div>
						</div>
					</div>
					<p class="showOnStartup"><input type="checkbox" id="showOnStartup" class="checkbox">
						<label for="showOnStartup">${escape(localize('welcomePage.showOnStartup', "Show welcome page on startup"))}</label>
					</p>
				</div>
				<div class="getting-started-container">
					<div class="links">
						<h2>${escape(localize('welcomePage.usefuLinks', "Useful Links"))}</h2>
						<div class="link-header">
							<a class="link ads-welcome-page-link" href="https://aka.ms/get-started-azdata">
								${escape(localize('welcomePage.gettingStarted', "Getting Started"))}<span class="icon-link themed-icon-alt"></span>
							</a>
						</div>
						<p>
							${escape(localize('welcomePage.gettingStartedBody', "Discover the capabilities offered by Azure Data Studio and learn how to make the most of them."))}
						</p>
						<div class="link-header">
							<a class="link ads-welcome-page-link" href="command:workbench.action.openDocumentationUrl">
								${escape(localize('welcomePage.documentation', "Documentation"))}<span class="icon-link themed-icon-alt"></span>
							</a>
						</div>
						<p>
							${escape(localize('welcomePage.documentationBody', "Visit the documentation center for quickstarts, how-to guides, and references for PowerShell, APIs, etc."))}
						</p>
						<div class="videos-container row">
							<h2>${escape(localize('welcomePage.videos', "Videos"))}</h2>
							<div class="flex flex-container-video">
								<div class="videos-container-video">
									<a href="https://www.youtube.com/watch?v=Orv7fptVoUA" class="video overview ads-welcome-page-link">
										<img src="${require.toUrl('./../../media/video_overview.png')}" class="video-overview" id="video-overview" />
										<h4>${escape(localize('welcomePage.videoDescriptionOverview', "Overview of Azure Data Studio"))}</h4>
									</a>
								</div>
								<div class="videos-container-video">
									<a href="https://www.youtube.com/watch?v=Nt4kIHQ0IOc" class="video overview ads-welcome-page-link">
										<img src="${require.toUrl('./../../media/video_introduction.png')}" class="video-introduction" id="video-introduction" />
										<h4>${escape(localize('welcomePage.videoDescriptionIntroduction', "Introduction to Azure Data Studio Notebooks | Data Exposed"))}</h4>
									</a>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="ads-homepage-section content extensions content-container">
				<div class="flex flex-j-between">
					<h2>${escape(localize('welcomePage.extensions', "Extensions"))}</h2>
					<a role="button" class="link-show-all flex ads-welcome-page-link" href="command:workbench.view.extensions">
						${escape(localize('welcomePage.showAll', "Show All"))}<span class="icon-arrow-right"></span>
					</a>
				</div>
				<div class="row ads-grid grip-gap-50">
					<div class="ads-grid tile no-hover extension-pack">
						<div class="extension-pack-description">
							<h3 class="extension-pack-header"></h3>
							<p class="extension-pack-body"></p>
						</div>
						<div class="extension-pack-extensions flex flex-d-column flex-j-evenly flex-a-start">
							<div class="extension-pack-extension-list flex flex-d-column flex-j-evenly flex-a-start"></div>
							<div class="flex flex-j-end extension-pack-btn-container flex flex-j-between flex-a-center">
								<div class="extensionPack"></div>
								<a role="button" class="a-self-end link-learn-more flex flex-a-center ads-welcome-page-link" href="command:azdata.extension.open?%7B%22id%22%3A%22microsoft.admin-pack%22%7D">
									${escape(localize('welcomePage.learnMore', "Learn more "))}<span class="icon-arrow-right"></span>
								</a>
							</div>
						</div>
					</div>
					<div class="extension-list flex flex-d-column">
						<!-- Dynamically populated -->
					</div>
				</div>
				<br /><br /><br />
			</div>
		</div>
	</div>
</div>
`;

