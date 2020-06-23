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
					<div class="tool_tip_container" id="tool_tip_container_wide">
						<a aria-describedby="tooltip_text_wide" id="preview_link_wide" class="preview_link" tabindex="0" name="preview"><p>Preview</p><i class="icon_info themed_icon"></i></a>
						<span role="tooltip" id="tooltip_text_wide" class="tool_tip_text" aria-hidden="true">
							<h3 tabindex="0" class="preview_tooltip_header">${escape(localize('welcomePage.previewHeader', "This page is in preview"))}</h3>
							<p tabindex="0" class="preview_tooltip_body">${escape(localize('welcomePage.previewBody', "Preview features introduce new functionalities that are on track to becoming a permanent part the product. They are stable, but need additional accessibility improvements. We welcome your early feedback while they are under development."))}</p>
						</span>
					</div>
					<div class="tool_tip_container" id="tool_tip_container_narrow">
						<a aria-haspopup="true" class="preview_link" tabindex="0" id="preview_link_narrow" name="previewNarrow"><p>Preview</p><i class="icon_info themed_icon"></i></a>
					</div>
				</div>
				<div id="preview_modal" class="modal" aria-modal="true" aria-hidden="true">
					<div class="modal_content">
						<span class="close_icon">x</span>
						<h3 tabindex="0" class="preview_modal_header">${escape(localize('welcomePage.previewHeader', "This page is in preview"))}</h3>
						<p tabindex="0" class="preview_modal_body">${escape(localize('welcomePage.previewBody', "Preview features introduce new functionalities that are on track to becoming a permanent part the product. They are stable, but need additional accessibility improvements. We welcome your early feedback while they are under development."))}</p>
					</div>
				</div>
				<div class="ads_homepage_section section header hero">
					<div class="row start">
						<div class="header_top_nav">
							<div class="flex">
								<div class="icon sm"></div>
								<div class="title">
									<div class="caption_container">
										<span class="icon xs"></span><h1 class="caption"></h1>
									</div>
									<div class="flex btn_container">
										<div>
											<button id="dropdown_btn" class="btn btn_primary dropdown" role="navigation" aria-haspopup="true" aria-controls="dropdown">
												<div class="dropdown_text" style="pointer-events: none;">
													<span>${escape(localize('welcomePage.new', "New"))}</span><i class="icon_arrow_down"></i>
												</div>
											</button>
											<nav role="navigation" class="dropdown_nav">
												<ul id="dropdown" class="dropdown-content" aria-hidden="true" aria-label="submenu" role="menu" aria-labelledby="dropdown_btn">
													<li role="none"><a role="menuitem" tabIndex="-1" class="move" href="command:registeredServers.addConnection">${escape(localize('welcomePage.newConnection', "New connection"))}</a></li>
													<li role="none"><a role="menuitem" tabIndex="-1" class="move" href="command:workbench.action.files.newUntitledFile">${escape(localize('welcomePage.newQuery', "New query"))}</a></li>
													<li role="none"><a role="menuitem" tabIndex="-1" class="move" href="command:notebook.command.new">${escape(localize('welcomePage.newNotebook', "New notebook"))}</a></li>
													<li role="none" id="dropdown_mac_only"><a role="menuitem" tabIndex="-1" class="move mac_only" href="command:workbench.action.files.openLocalFileFolder">${escape(localize('welcomePage.openFileMac', "Open file"))}</a></li>
													<li role="none" id="dropdown_windows_linux_only"><a role="menuitem" tabIndex="-1" class="move windows_only linux_only" href="command:workbench.action.files.openFile">${escape(localize('welcomePage.openFileLinuxPC', "Open file"))}</a></li>
												</ul>
											</nav>
										</div>
										<a class="windows_only linux_only btn btn_secondary"
											href="command:workbench.action.files.openFile">
											${escape(localize('welcomePage.openFileLinuxPC', "Open file"))}
										</a>
										<a class="mac_only btn btn_secondary" href="command:workbench.action.files.openLocalFileFolder">${escape(localize('welcomePage.openFileMac', "Open file"))}</a>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="row header_bottom_nav_tiles ads_grid">
						<div class="col">
							<a class="header_bottom_nav_tile_link" href="command:registeredServers.addConnection">
								<div class="header_bottom_nav_tile tile tile_connection">
									<h3>${escape(localize('welcomePage.createConnection', "Create a connection"))}</h3>
									<p>${escape(localize('welcomePage.createConnectionBody', "Connect to a database instance through the connection dialog."))}</p>
									<div class="icon connection"></div>
								</div>
							</a>
						</div>
						<div class="col">
							<a class="header_bottom_nav_tile_link"
								href="command:workbench.action.files.newUntitledFile">
								<div class="header_bottom_nav_tile tile tile_query">
									<h3>${escape(localize('welcomePage.runQuery', "Run a query"))}</h3>
									<p>${escape(localize('welcomePage.runQueryBody', "Interact with data through a query editor."))}</p>
									<div class="icon query"></div>
								</div>
							</a>
						</div>
						<div class="col">
							<a class="header_bottom_nav_tile_link" href="command:notebook.command.new">
								<div class="header_bottom_nav_tile tile tile_notebook">
									<h3>${escape(localize('welcomePage.createNotebook', "Create a notebook"))}</h3>
									<p>${escape(localize('welcomePage.createNotebookBody', "Build a new notebook using a native notebook editor."))}</p>
									<div class="icon notebook"></div>
								</div>
							</a>
						</div>
						<div class="col">
							<a class="header_bottom_nav_tile_link" href="command:azdata.resource.deploy">
								<div class="header_bottom_nav_tile tile tile_server">
									<h3>${escape(localize('welcomePage.deployServer', "Deploy a server"))}</h3>
									<p>${escape(localize('welcomePage.deployServerBody', "Create a new instance of SQL Server on the platform of your choice."))}</p>
									<div class="icon server"></div>
								</div>
							</a>
						</div>
					</div>
				</div>
			</div>
			<div class="ads_homepage_section middle_section content row ads_grid">
				<div class="resources_container">
					<h2>${escape(localize('welcomePage.resources', "Resources"))}</h2>
					<div class="tabs">
						<input class="input" name="tabs" type="radio" id="tab-1" checked="checked" />
						<label class="label" for="tab-1" tabIndex="0">${escape(localize('welcomePage.history', "History"))}</label>
						<div class="panel">
							<div class="recent history">
								<div class="flex list_header_container">
									<i class="icon_document themed_icon"></i>
									<h4 class="list_header">${escape(localize('welcomePage.name', "Name"))}</h4>
									<h4 class="list_header_last_opened">${escape(localize('welcomePage.lastOpened', "Last Opened"))}</h4>
								</div>
								<ul class="list">
									<!-- Filled programmatically -->
								</ul>
								<p class="none detail">No recent folders</p>
								<ul class="moreRecent_list">
									<li class="moreRecent">
										<a href="command:workbench.action.openRecent">${escape(localize('welcomePage.moreRecent', "Show more"))}
											<i class="icon_arrow_down_dark"></i>
										</a>
									</li>
								</ul>
							</div>
						</div>
					</div>
					<p class="showOnStartup"><input type="checkbox" id="showOnStartup" class="checkbox">
						<label for="showOnStartup">${escape(localize('welcomePage.showOnStartup', "Show welcome page on startup"))}</label>
					</p>
				</div>
				<div class="getting_started_container">
					<div class="links">
						<h2>${escape(localize('welcomePage.usefuLinks', "Useful Links"))}</h2>
						<div class="link_header">
							<a class="link"
								href="https://aka.ms/get-started-azdata">${escape(localize('welcomePage.gettingStarted',
	"Getting Started"))}<span class="icon_link themed_icon_alt"></a>
						</div>
						<p>
						${escape(localize('welcomePage.gettingStartedBody',
		"Discover the capabilities offered by Azure Data Studio and learn how to make the most of them."))}
						</p>
						<div class="link_header">
							<a class="link"
								href="command:workbench.action.openDocumentationUrl">${escape(localize('welcomePage.documentation',
			"Documentation"))}<span class="icon_link themed_icon_alt"</a></a>
						</div>
						<p>${escape(localize('welcomePage.documentationBody',
				"Visit the documentation center for quickstarts, how-to guides, and references for PowerShell, APIs, etc."))}
						</p>


						<div class="videos_container row">
							<h2>Videos</h2>
							<div class="flex flex_container_video">
								<div class="videos_container_video">
									<a href="https://www.youtube.com/watch?v=Orv7fptVoUA" class="video overview">
									<img src="${require.toUrl('./../../media/video_overview.png')}" class="video_overview" id="video_overview" />
										<h4>${escape(localize('welcomePage.videoDescriptionOverview',
					"Overview of Azure Data Studio"))}</h4>
									</a>

								</div>
								<div class="videos_container_video">
									<a href="https://www.youtube.com/watch?v=Nt4kIHQ0IOc" class="video overview">
									<img src="${require.toUrl('./../../media/video_introduction.png')}" class="video_introduction" id="video_introduction" />
										<h4>${escape(localize('welcomePage.videoDescriptionIntroduction',
						"Introduction to Azure Data Studio Notebooks | Data Exposed"))}</h4>
									</a>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="ads_homepage_section content extensions">
				<div class="flex flex_j_between">
					<h2>Extend your data studio</h2>
					<a class="link_show_all flex" href="command:extensions.listView.focus">${escape(localize('welcomePage.showAll', "Show All"))} <span class="icon_arrow_right"></span></a>
				</div>
				<div class="row ads_grid grip_gap_50">
					<div
						class="ads_grid tile no_hover extension_pack">
						<div class="extension_pack_description">
							<div class="extension_pack_header"></div>
							<p class="extension_pack_body"></p>
						</div>
						<div class="extension_pack_extensions flex flex_d_column flex_j_evenly flex_a_start">
							<div class="extension_pack_extension_list flex flex_d_column flex_j_evenly flex_a_start"></div>
							<div class="flex flex_j_end extension_pack_btn_container flex flex_j_between flex_a_center"">
							<div class="extensionPack" href="#"></div>
							<a class="a_self_end link_learn_more flex flex_a_center" href="command:azdata.extension.open?%7B%22id%22%3A%22microsoft.admin-pack%22%7D">${escape(localize('welcomePage.learnMore',
							"Learn more "))}<span class="icon_arrow_right"></span></a>
						</div>
					</div>
				</div>
				<div class="extension_list flex flex_d_column">
					<!-- Dynamically populated -->
				</div>
				<br /><br /><br />
			</div>
		</div>
	</div>
</div>
`;
