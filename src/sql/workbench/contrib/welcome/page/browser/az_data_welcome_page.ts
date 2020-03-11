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
				<div class="ads_homepage__section section header hero">
					<div class="row start">
						<div class="header__top_nav">
							<div class="flex">
								<div class="icon"></div>
								<div>
									<h1>Azure Data Studio</h1>
									<div class="flex btn_container">
										<div class="btn btn--primary dropdown" role="navigation">
											<ul>
												<li>
													<a class="dropdown__text" href="#">
														<span>New</span><i class="icon--arrow_down"></i>
													</a>
													<ul class="dropdown">
														<li>
															<a href="command:registeredServers.addConnection">${escape(localize("welcomePage.newConnection",
	"New connection"))}</a>
														</li>
														<li>
															<a href="command:workbench.action.files.newUntitledFile">${escape(localize("welcomePage.newQuery",
		"New query"))}</a>
														</li>
														<li>
															<a href="command:notebook.command.new">${escape(localize("welcomePage.newNotebook",
			"New notebook"))}</a>
														</li>
														<li class="mac-only">
															<a
																href="command:workbench.action.files.openLocalFileFolder">${escape(localize("welcomePage.openFileMac",
				"Open file"))}</a>
														</li>
														<li class="windows-only linux-only">
															<a href="command:workbench.action.files.openFile">${escape(localize("welcomePage.openFileLinuxPC",
					"Open file"))}</a>
														</li>
													</ul>
												</li>
											</ul>
										</div>
										<a class="windows-only linux-only btn btn--standard"
											href="command:workbench.action.files.openFile">
											${escape(localize("welcomePage.openFileLinuxPC", "Open file"))}
										</a>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="row header__bottom_nav__tiles ads_grid sm--cols-2 xl--cols-4">
						<div class="col">
							<a class="header__bottom_nav__tile__link" href="command:registeredServers.addConnection">
								<div class="header__bottom_nav__tile tile tile--connection content">
									<h3>${escape(localize("welcomePage.createConnection", "Create a Connection"))}</h3>
									<p>${escape(localize("welcomePage.createConnectionBody", "Install extensions to enhance the tool’s capabilities."))}</p>
									<div class="icon connection"></div>
								</div>
							</a>
						</div>
						<div class="col">
							<a class="header__bottom_nav__tile__link"
								href="command:workbench.action.files.newUntitledFile">
								<div class="header__bottom_nav__tile tile tile--query content">
									<h3>${escape(localize("welcomePage.runQuery", "Run a query"))}</h3>
									<p>${escape(localize("welcomePage.runQueryBody", "Access your data in a query editor."))}</p>
									<div class="icon query"></div>
								</div>
							</a>
						</div>
						<div class="col">
							<a class="header__bottom_nav__tile__link" href="command:notebook.command.new">
								<div class="header__bottom_nav__tile tile tile--notebook content">
									<h3>${escape(localize("welcomePage.createNotebook", "Create a notebook"))}</h3>
									<p>${escape(localize("welcomePage.createNotebookBody", "Start a local computational notebook."))}</p>
									<div class="icon notebook"></div>
								</div>
							</a>
						</div>
						<div class="col">
							<a class="header__bottom_nav__tile__link" href="command:azdata.resource.deploy">
								<div class="header__bottom_nav__tile tile tile--server content">
									<h3>${escape(localize("welcomePage.deployServer", "Deploy a server"))}</h3>
									<p>${escape(localize("welcomePage.deployServerBody", "Install an image of SQL Server to a remote location."))}</p>
									<div class="icon server"></div>
								</div>
							</a>
						</div>
					</div>
				</div>
			</div>
			<div class="ads_homepage__section content row ads_grid xl--cols-12 sm--cols-1">
				<div class="col--lg--span-4 col--xl--start_1__span_7 col--sm--start_1__span_1 resources">
					<h2>${escape(localize("welcomePage.resources", "Resources"))}</h2>
					<div class="tabs">
						<input class="input" name="tabs" type="radio" id="tab-1" checked="checked" />
						<label class="label" for="tab-1">${escape(localize("welcomePage.history", "History"))}</label>
						<div class="panel">
							<div class="recent history">
								<div class="flex flex--j_between list__header__container">
									<h4 class="icon--document list__header">${escape(localize("welcomePage.name", "Name"))}</h4>
									<h4>${escape(localize("welcomePage.lastOpened", "Last Opened"))}</h4>
								</div>
								<ul class="list">
									<!-- Filled programmatically -->
									<li class="moreRecent">
										<a href="command:workbench.action.openRecent">${escape(localize("welcomePage.moreRecent", "Show more"))}</a>
										<i class="icon--arrow_down--dark"></i>
									</li>
								</ul>
								<p class="none detail">No recent folders</p>
							</div>
						</div>
					</div>
					<p class="showOnStartup"><input type="checkbox" id="showOnStartup" class="checkbox">
						<label class="caption" for="showOnStartup">${escape(localize("welcomePage.showOnStartup", "Show welcome page on startup"))}</label>
					</p>
				</div>
				<div class="col--xl--start_9__span_6 col--sm--start_1__span_1">
					<div class="links">
						<h2>${escape(localize("welcomePage.usefuLinks", "Useful Links"))}</h2>
						<h4>
							<a class="link"
								href="https://aka.ms/azuredatastudio">${escape(localize("welcomePage.gettingStarted",
						"Getting Started"))}<span class="icon--link"</a>
						</h4>
						<p>
						${escape(localize("welcomePage.gettingStartedBody",
							"Discover the capabilities offered by Aure Data Studio and learn how to make the most of them."))}
						</p>
						<h4>
							<a class="link"
								href="https://aka.ms/azuredatastudio">${escape(localize("welcomePage.documentation",
								"Documentation"))}<span class="icon--link"</a></a>
						</h4>
						<p>${escape(localize("welcomePage.documentationBody",
									"Visit the documentation center for quickstarts, how-to guides, and references for PowerShell, APIs, etc."))}
						</p>


						<div class="videos_container row">
							<h2>Videos</h2>
							<div class="flex flex--d_row">
								<div class="videos_container__video">
									<a href="https://www.youtube.com/watch?v=Orv7fptVoUA" class="video overview"><img src="../../../workbench/contrib/welcome/video_overview.png" />
										<h4>${escape(localize("welcomePage.videoDescriptionOverview",
										"Overview of Azure Data Studio"))}</h4>
									</a>

								</div>
								<div class="videos_container__video">
								<a href="https://www.youtube.com/watch?v=Nt4kIHQ0IOc" class="video overview"><img src="../../../workbench/contrib/welcome/video_introduction.png" />
									<h4>${escape(localize("welcomePage.videoDescriptionIntroduction",
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
					<a class="link--show_all flex" href="command:workbench.extensions.action.showLanguageExtensions">${escape(localize("welcomePage.showAll", "Show All"))} <span class="icon--arrow_right"></span></a>
				</div>
				<div class="row ads_grid grip_gap--50 lg--cols-2 xxl--cols-8">
					<div
						class="ads_grid col--sm--start_1__span_2 row--xxl--start_1__span_4 col--xxl--start_1__span_4 lg--cols-2 tile no_hover extension_pack">
						<div class="extension_pack__description">
							<h2 class="extension_pack__header"></h2>
							<p class="extension_pack__body"></p>
						</div>
						<div class="extension_pack__extensions flex flex--d_column flex--j_evenly flex--a_start">
							<div class="extension_pack__extension_list flex flex--d_column flex--j_evenly flex--a_start"></div>
							<div class="flex flex--j_end extension_pack__btn_container flex flex--j_between flex--a_center"">
							<div class=" extensionPack" href="#"></div>
							<a class="a_self--end link--learn_more flex flex--a_center" href="https://github.com/microsoft/azuredatastudio/tree/master/extensions/admin-pack">${escape(localize("welcomePage.learnMore",
												"Learn more "))}
													<span class="icon--arrow_right"></span></a>
						</div>
					</div>
				</div>
				<div class="extension_list col col--sm--start_1__span_2 col--xxl--start_5__span_4 row--xxl--start_1__span_4 flex flex--d_column">
					<!-- Dynamically populated -->
				</div>
				<br /><br /><br />
			</div>
		</div>
	</div>
</div>
`;