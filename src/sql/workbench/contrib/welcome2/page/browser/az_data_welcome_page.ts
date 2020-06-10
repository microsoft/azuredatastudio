/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { escape } from 'vs/base/common/strings';
import { localize } from 'vs/nls';

export default () => `
<div class="welcomePageContainer2">
	<div class="welcomePage2">
		<div class="title">
			<h1 class="caption">${escape(localize('welcomePage.azdata', "Azure Data Studio"))}</h1>
			<p class="subtitle detail"></p>
		</div>
		<div class="row">
			<div class="splash">
				<div class="section start">
					<h2 class="caption">${escape(localize('welcomePage.start', "Start"))}</h2>
					<ul>
						<li><a href="command:registeredServers.addConnection">${escape(localize('welcomePage.newConnection', "New connection"))}</a></li>
						<li><a href="command:workbench.action.files.newUntitledFile">${escape(localize('welcomePage.newQuery', "New query"))}</a></li>
						<li><a href="command:notebook.command.new">${escape(localize('welcomePage.newNotebook', "New notebook"))}</a></li>
						<li class="mac-only"><a href="command:workbench.action.files.openLocalFileFolder">${escape(localize('welcomePage.openFileMac', "Open file"))}</a></li>
						<li class="windows-only linux-only"><a href="command:workbench.action.files.openFile">${escape(localize('welcomePage.openFileLinuxPC', "Open file"))}</a></li>
					</ul>
				</div>
				<div class="section deploy">
					<h2 class="caption">${escape(localize('welcomePage.deploy', "Deploy"))}</h2>
					<ul>
						<li><a href="command:azdata.resource.deploy">${escape(localize('welcomePage.newDeployment', "New Deployment…"))}</a></li>
					</ul>
				</div>
				<div class="section recent">
					<h2 class="caption">${escape(localize('welcomePage.recent', "Recent"))}</h2>
					<ul class="list">
						<!-- Filled programmatically -->
						<li class="moreRecent"><a href="command:workbench.action.openRecent">${escape(localize('welcomePage.moreRecent', "More..."))}</a><span class="path detail if_shortcut" data-command="workbench.action.openRecent">(<span class="shortcut" data-command="workbench.action.openRecent"></span>)</span></li>
					</ul>
					<p class="none detail">${escape(localize('welcomePage.noRecentFolders', "No recent folders"))}</p>
				</div>
				<div class="section help">
					<h2 class="caption">${escape(localize('welcomePage.help', "Help"))}</h2>
					<ul>
						<li><a href="https://aka.ms/get-started-azdata">${escape(localize('welcomePage.gettingStarted', "Getting started"))}</a></li>
						<li><a href="https://aka.ms/azuredatastudio">${escape(localize('welcomePage.productDocumentation', "Documentation"))}</a></li>
						<li><a href="https://github.com/Microsoft/azuredatastudio/issues/new/choose">${escape(localize('welcomePage.reportIssue', "Report issue or feature request"))}</a></li>
						<li><a href="https://github.com/Microsoft/azuredatastudio">${escape(localize('welcomePage.gitHubRepository', "GitHub repository"))}</a></li>
						<li><a href="https://aka.ms/azuredatastudio-releasenotes">${escape(localize('welcomePage.releaseNotes', "Release notes"))}</a></li>
					</ul>
				</div>
				<p class="showOnStartup"><input type="checkbox" id="showOnStartup" class="checkbox"> <label class="caption" for="showOnStartup">${escape(localize('welcomePage.showOnStartup', "Show welcome page on startup"))}</label></p>
			</div>
			<div class="commands">
				<div class="section customize">
					<h2 class="caption">${escape(localize('welcomePage.customize', "Customize"))}</h2>
					<div class="list">
						<div class="item selectTheme"><button data-href="command:workbench.view.extensions"><h3 class="caption">${escape(localize('welcomePage.extensions', "Extensions"))}</h3> <span class="detail">${escape(localize('welcomePage.extensionDescription', "Download extensions that you need, including the SQL Server Admin pack and more"))}</span></button></div>
						<div class="item selectTheme"><button data-href="command:workbench.action.openGlobalKeybindings"><h3 class="caption">${escape(localize('welcomePage.keyboardShortcut', "Keyboard Shortcuts"))}</h3> <span class="detail">${escape(localize('welcomePage.keyboardShortcutDescription', "Find your favorite commands and customize them"))}</span></button></div>
						<div class="item selectTheme"><button data-href="command:workbench.action.selectTheme"><h3 class="caption">${escape(localize('welcomePage.colorTheme', "Color theme"))}</h3> <span class="detail">${escape(localize('welcomePage.colorThemeDescription', "Make the editor and your code look the way you love"))}</span></button></div>
					</div>
				</div>
				<div class="section learn">
					<h2 class="caption">${escape(localize('welcomePage.learn', "Learn"))}</h2>
					<div class="list">
						<div class="item showCommands"><button data-href="command:workbench.action.showCommands"><h3 class="caption">${escape(localize('welcomePage.showCommands', "Find and run all commands"))}</h3> <span class="detail">${escape(localize('welcomePage.showCommandsDescription', "Rapidly access and search commands from the Command Palette ({0})"))
		.replace('{0}', '<span class="shortcut" data-command="workbench.action.showCommands"></span>')}</span></button></div>
						<div class="item showInterfaceOverview"><button data-href="https://aka.ms/azdata-blog"><h3 class="caption">${escape(localize('welcomePage.azdataBlog', "Discover what's new in the latest release"))}</h3> <span class="detail">${escape(localize('welcomePage.azdataBlogDescription', "New monthly blog posts each month showcasing our new features"))}</span></button></div>
						<div class="item showInteractivePlayground"><button data-href="https://twitter.com/azuredatastudio"><h3 class="caption">${escape(localize('welcomePage.followTwitter', "Follow us on Twitter"))}</h3> <span class="detail">${escape(localize('welcomePage.followTwitterDescription', "Keep up to date with how the community is using Azure Data Studio and to talk directly with the engineers."))}</span></button></div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
`;
