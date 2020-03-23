/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { escape } from 'vs/base/common/strings';
import { localize } from 'vs/nls';

export default () => `
<div class="welcomePageContainer">
	<div class="welcomePage">
		<div class="ads_homepage splash">
			<div class="gradient">
				<div class="preview_text tool_tip">
					<div class="tool_tip__container" id="tool_tip__container--wide">
						<a aria-describedby="tooltip__text--wide" id="preview_link--wide" class="preview_link" tabindex="0" name="preview"><p>Preview</p><i class="icon--info themed_icon"></i></a>
						<span role="tooltip" id="tooltip__text--wide" class="tool_tip__text" aria-hidden="true">
							<h3 tabindex="0" class="preview_tooltip__header">${escape(localize('welcomePage.previewHeader', "This page is in preview"))}</h3>
							<p tabindex="0" class="preview_tooltip__body">${escape(localize('welcomePage.previewBody', "Preview features introduce new functionalities that are on track to becoming a permanent part the product. They are stable, but need additional accessibility improvements. We welcome your early feedback while they are under development."))}</p>
						</span>
					</div>
					<div class="tool_tip__container" id="tool_tip__container--narrow">
						<a aria-haspopup="true" class="preview_link" tabindex="0" id="preview_link--narrow" name="previewNarrow"><p>Preview</p><i class="icon--info themed_icon"></i></a>
					</div>
				</div>
				<div id="preview_modal" class="modal" aria-modal="true" aria-hidden="true">
					<div class="modal_content">
						<span class="close_icon">x</span>
						<h3 tabindex="0" class="preview_modal__header">${escape(localize('welcomePage.previewHeader', "This page is in preview"))}</h3>
						<p tabindex="0" class="preview_modal__body">${escape(localize('welcomePage.previewBody', "Preview features introduce new functionalities that are on track to becoming a permanent part the product. They are stable, but need additional accessibility improvements. We welcome your early feedback while they are under development."))}</p>
					</div>
				</div>
				<div class="ads_homepage__section section header hero">
					<div class="row start">
						<div class="header__top_nav">
							<div class="flex">
								<div class="icon"></div>
								<div>
									<h1>Azure Data Studio</h1>
									<div class="flex btn_container">
										<div>
											<button id="dropdown_btn" class="btn btn--primary dropdown" role="navigation" aria-haspopup="true" aria-controls="dropdown">
												<div class="dropdown__text" style="pointer-events: none;">
													<span>${escape(localize('welcomePage.new', "New"))}</span><i class="icon--arrow_down"></i>
												</div>
											</button>
											<nav role="navigation" class="dropdown_nav">
												<ul id="dropdown" class="dropdown-content" aria-hidden="true" aria-label="submenu" role="menu" aria-labelledby="dropdown_btn">
													<li role="none"><a role="menuitem" tabIndex="-1" class="move" href="command:registeredServers.addConnection">${escape(localize('welcomePage.newConnection', "New connection"))}</a></li>
													<li role="none"><a role="menuitem" tabIndex="-1" class="move" href="command:workbench.action.files.newUntitledFile">${escape(localize('welcomePage.newQuery', "New query"))}</a></li>
													<li role="none"><a role="menuitem" tabIndex="-1" class="move" href="command:notebook.command.new">${escape(localize('welcomePage.newNotebook', "New notebook"))}</a></li>
													<li role="none" id="dropdown_mac-only"><a role="menuitem" tabIndex="-1" class="move mac-only" href="command:workbench.action.files.openLocalFileFolder">${escape(localize('welcomePage.openFileMac', "Open file"))}</a></li>
													<li role="none" id="dropdown_windows_linux-only"><a role="menuitem" tabIndex="-1" class="move windows-only linux-only" href="command:workbench.action.files.openFile">${escape(localize('welcomePage.openFileLinuxPC', "Open file"))}</a></li>
												</ul>
											</nav>
										</div>
										<a class="windows-only linux-only btn btn--standard"
											href="command:workbench.action.files.openFile">
											${escape(localize('welcomePage.openFileLinuxPC', "Open file"))}
										</a>
										<a class="mac-only btn btn--standard" href="command:workbench.action.files.openLocalFileFolder">${escape(localize('welcomePage.openFileMac', "Open file"))}</a>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="row header__bottom_nav__tiles ads_grid">
						<div class="col">
							<a class="header__bottom_nav__tile__link" href="command:registeredServers.addConnection">
								<div class="header__bottom_nav__tile tile tile--connection content">
									<h3>${escape(localize('welcomePage.createConnection', "Create a connection"))}</h3>
									<p>${escape(localize('welcomePage.createConnectionBody', "Connect to a database instance through the connection dialog."))}</p>
									<div class="icon connection"></div>
								</div>
							</a>
						</div>
						<div class="col">
							<a class="header__bottom_nav__tile__link"
								href="command:workbench.action.files.newUntitledFile">
								<div class="header__bottom_nav__tile tile tile--query content">
									<h3>${escape(localize('welcomePage.runQuery', "Run a query"))}</h3>
									<p>${escape(localize('welcomePage.runQueryBody', "Interact with data through a query editor."))}</p>
									<div class="icon query"></div>
								</div>
							</a>
						</div>
						<div class="col">
							<a class="header__bottom_nav__tile__link" href="command:notebook.command.new">
								<div class="header__bottom_nav__tile tile tile--notebook content">
									<h3>${escape(localize('welcomePage.createNotebook', "Create a notebook"))}</h3>
									<p>${escape(localize('welcomePage.createNotebookBody', "Build a new notebook using a native notebook editor."))}</p>
									<div class="icon notebook"></div>
								</div>
							</a>
						</div>
						<div class="col">
							<a class="header__bottom_nav__tile__link" href="command:azdata.resource.deploy">
								<div class="header__bottom_nav__tile tile tile--server content">
									<h3>${escape(localize('welcomePage.deployServer', "Deploy a server"))}</h3>
									<p>${escape(localize('welcomePage.deployServerBody', "Create a new instance of SQL Server on the platform of your choice."))}</p>
									<div class="icon server"></div>
								</div>
							</a>
						</div>
					</div>
				</div>
			</div>
			<div class="ads_homepage__section middle_section content row ads_grid">
				<div class="resources__container">
					<h2>${escape(localize('welcomePage.resources', "Resources"))}</h2>
					<div class="tabs">
						<input class="input" name="tabs" type="radio" id="tab-1" checked="checked" />
						<label class="label" for="tab-1" tabIndex="0">${escape(localize('welcomePage.history', "History"))}</label>
						<div class="panel">
							<div class="recent history">
								<div class="flex list__header__container">
									<i class="icon--document themed_icon"></i>
									<h4 class="list__header">${escape(localize('welcomePage.name', "Name"))}</h4>
									<h4 class="list__header--last_opened">${escape(localize('welcomePage.lastOpened', "Last Opened"))}</h4>
								</div>
								<ul class="list">
									<!-- Filled programmatically -->
								</ul>
								<p class="none detail">No recent folders</p>
								<ul class="moreRecent--list">
									<li class="moreRecent">
										<a href="command:workbench.action.openRecent">${escape(localize('welcomePage.moreRecent', "Show more"))}</a>
										<i class="icon--arrow_down--dark"></i>
									</li>
								</ul>
							</div>
						</div>
					</div>
					<p class="showOnStartup"><input type="checkbox" id="showOnStartup" class="checkbox">
						<label class="caption" for="showOnStartup">${escape(localize('welcomePage.showOnStartup', "Show welcome page on startup"))}</label>
					</p>
				</div>
				<div class="getting_started__container">
					<div class="links">
						<h2>${escape(localize('welcomePage.usefuLinks', "Useful Links"))}</h2>
						<div class="link_header">
							<a class="link"
								href="https://aka.ms/azuredatastudio">${escape(localize('welcomePage.gettingStarted',
	"Getting Started"))}<span class="icon--link themed_icon--alt"></a>
						</div>
						<p>
						${escape(localize('welcomePage.gettingStartedBody',
		"Discover the capabilities offered by Aure Data Studio and learn how to make the most of them."))}
						</p>
						<div class="link_header">
							<a class="link"
								href="https://aka.ms/azuredatastudio">${escape(localize('welcomePage.documentation',
			"Documentation"))}<span class="icon--link themed_icon--alt"</a></a>
						</div>
						<p>${escape(localize('welcomePage.documentationBody',
				"Visit the documentation center for quickstarts, how-to guides, and references for PowerShell, APIs, etc."))}
						</p>


						<div class="videos_container row">
							<h2>Videos</h2>
							<div class="flex flex--d_row">
								<div class="videos_container__video">
									<a href="https://www.youtube.com/watch?v=Orv7fptVoUA" class="video overview">
									<img src="../../../../sql/workbench/contrib/welcome/media/video_overview.png" />
										<h4>${escape(localize('welcomePage.videoDescriptionOverview',
					"Overview of Azure Data Studio"))}</h4>
									</a>

								</div>
								<div class="videos_container__video">
									<a href="https://www.youtube.com/watch?v=Nt4kIHQ0IOc" class="video overview">
									<img src="../../../../sql/workbench/contrib/welcome/media/video_introduction.png" />
										<h4>${escape(localize('welcomePage.videoDescriptionIntroduction',
						"Introduction to Azure Data Studio Notebooks | Data Exposed"))}</h4>
									</a>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="ads_homepage__section content extensions">
				<div class="flex flex--j_between">
					<h2>Extend your data studio</h2>
					<a class="link--show_all flex" href="command:extensions.listView.focus">${escape(localize('welcomePage.showAll', "Show All"))} <span class="icon--arrow_right"></span></a>
				</div>
				<div class="row ads_grid grip_gap--50">
					<div
						class="ads_grid tile no_hover extension_pack">
						<div class="extension_pack__description">
							<div class="extension_pack__header"></div>
							<p class="extension_pack__body"></p>
						</div>
						<div class="extension_pack__extensions flex flex--d_column flex--j_evenly flex--a_start">
							<div class="extension_pack__extension_list flex flex--d_column flex--j_evenly flex--a_start"></div>
							<div class="flex flex--j_end extension_pack__btn_container flex flex--j_between flex--a_center"">
							<div class="extensionPack" href="#"></div>
							<a class="a_self--end link--learn_more flex flex--a_center" href="command:azdata.extension.open?%7B%22id%22%3A%22microsoft.admin-pack%22%7D">${escape(localize('welcomePage.learnMore',
							"Learn more "))}<span class="icon--arrow_right"></span></a>
						</div>
					</div>
				</div>
				<div class="extension_list flex flex--d_column">
					<!-- Dynamically populated -->
				</div>
				<br /><br /><br />
			</div>
		</div>
	</div>
</div>
`;
