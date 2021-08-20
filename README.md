# Azure Data Studio

[![Join the chat at https://gitter.im/Microsoft/sqlopsstudio](https://badges.gitter.im/Microsoft/sqlopsstudio.svg)](https://gitter.im/Microsoft/sqlopsstudio?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Build Status](https://dev.azure.com/azuredatastudio/azuredatastudio/_apis/build/status/Azure%20Data%20Studio%20CI?branchName=main)](https://dev.azure.com/azuredatastudio/azuredatastudio/_build/latest?definitionId=4&branchName=main)
[![Twitter Follow](https://img.shields.io/twitter/follow/azuredatastudio?style=social)](https://twitter.com/azuredatastudio)

Azure Data Studio is a data management tool that enables you to work with SQL Server, Azure SQL DB and SQL DW from Windows, macOS and Linux.

## **Download the latest Azure Data Studio release**

| Platform																|
| ---------------------------------------	|
| [Windows User Installer][win-user]			|
| [Windows System Installer][win-system]	|
| [Windows ZIP][win-zip]									|
| [macOS ZIP][osx-zip]										|
| [Linux TAR.GZ][linux-zip]								|
| [Linux RPM][linux-rpm]									|
| [Linux DEB][linux-deb]									|


Go to our [download page](https://aka.ms/getazuredatastudio) for more specific instructions.

## Try out the latest insiders build from `main`:
- [Windows User Installer - **Insiders build**](https://azuredatastudio-update.azurewebsites.net/latest/win32-x64-user/insider)
- [Windows System Installer - **Insiders build**](https://azuredatastudio-update.azurewebsites.net/latest/win32-x64/insider)
- [Windows ZIP - **Insiders build**](https://azuredatastudio-update.azurewebsites.net/latest/win32-x64-archive/insider)
- [macOS ZIP - **Insiders build**](https://azuredatastudio-update.azurewebsites.net/latest/darwin/insider)
- [Linux TAR.GZ - **Insiders build**](https://azuredatastudio-update.azurewebsites.net/latest/linux-x64/insider)

See the [change log](https://github.com/Microsoft/azuredatastudio/blob/main/CHANGELOG.md) for additional details of what's in this release.
Go to our [download page](https://aka.ms/getazuredatastudio) for more specific instructions.


## **Feature Highlights**

- Cross-Platform DB management for Windows, macOS and Linux with simple XCopy deployment
- SQL Server Connection Management with Connection Dialog, Server Groups, Azure Integration and Registered Servers
- Object Explorer supporting schema browsing and contextual command execution
- T-SQL Query Editor with advanced coding features such as autosuggestions, error diagnostics, tooltips, formatting and peek definition
- Query Results Viewer with advanced data grid supporting large result sets, export to JSON\CSV\Excel, query plan and charting
- Management Dashboard supporting customizable widgets with drill-through actionable insights
- Visual Data Editor that enables direct row insertion, update and deletion into tables
- Backup and Restore dialogs that enables advanced customization and remote filesystem browsing, configured tasks can be executed or scripted
- Task History window to view current task execution status, completion results with error messages and task T-SQL scripting
- Scripting support to generate CREATE, SELECT, ALTER and DROP statements for database objects
- Workspaces with full Git integration and Find In Files support to managing T-SQL script libraries
- Modern light-weight shell with theming, user settings, full-screen support, integrated terminal and numerous other features

Here are some of these features in action.

<img src='https://github.com/Microsoft/azuredatastudio/blob/main/docs/overview_screen.jpg' width='800px'>

## Contributing
If you are interested in fixing issues and contributing directly to the code base,
please see the document [How to Contribute](https://github.com/Microsoft/azuredatastudio/wiki/How-to-Contribute), which covers the following:

* [How to build and run from source](https://github.com/Microsoft/azuredatastudio/wiki/How-to-Contribute#Build-and-Run-From-Source)
* [The development workflow, including debugging and running tests](https://github.com/Microsoft/azuredatastudio/wiki/How-to-Contribute#development-workflow)
* [Submitting pull requests](https://github.com/Microsoft/azuredatastudio/wiki/How-to-Contribute#pull-requests)

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Localization
Azure Data Studio is localized into 10 languages: French, Italian, German, Spanish, Simplified Chinese, Traditional Chinese, Japanese, Korean, Russian, and Portuguese (Brazil). The language packs are available in the Extension Manager marketplace. Simply, search for the specific language using the extension marketplace and install. Once you install the selected language, Azure Data Studio will prompt you to restart with the new language.

## Privacy Statement
The [Microsoft Enterprise and Developer Privacy Statement](https://privacy.microsoft.com/privacystatement) describes the privacy statement of this software.

## Contributions and "Thank You"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* eulercamposbarros for `Prevent connections from moving on click (#7528)`
* AlexFsmn for `Fixed issue where task icons got hidden if text was too long`
* jamesrod817 for `Tempdb (#7022)`
* dzsquared for `fix(snippets): ads parenthesis to sqlcreateindex snippet #7020`
* devmattrick for `Update row count as updates are received #6642`
* mottykohn for `In Message panel onclick scroll to line #6417`
* Stevoni for `Corrected Keyboard Shortcut Execution Issue #5480`
* yamatoya for `fix the format #4899`
* GeoffYoung for `Fix sqlDropColumn description #4422`
* AlexFsmn for `Added context menu for DBs in explorer view to backup & restore db. #2277`
* sadedil for `Missing feature request: Save as XML #3729`
* gbritton1 for `Removed reference to object explorer #3463`
* Tarig0  for `Add Routine_Type to CreateStoredProc fixes #3257 (#3286)`
* oltruong  for `typo fix #3025'`
* Thomas-S-B for `Removed unnecessary IErrorDetectionStrategy #749`
* Thomas-S-B for `Simplified code #750`
* rdaniels6813  for `Add query plan theme support #3031`
* Ruturaj123 for `Fixed some typos and grammatical errors #3027`
* PromoFaux for `Use emoji shortcodes in CONTRIBUTING.md instead of � #3009`
* ckaczor for `Fix: DATETIMEOFFSET data types should be ISO formatted #714`
* hi-im-T0dd for `Fixed sync issue with my forked master so this commit is correct #2948`
* hi-im-T0dd for `Fixed when right clicking and selecting Manage-correct name displays #2794`
* philoushka  for `center the icon #2760`
* anthonypants for `Typo #2775`
* kstolte for `Fix Invalid Configuration in Launch.json #2789`
* kstolte for `Fixing a reference to SQL Ops Studio #2788`
* AlexFsmn `Feature: Ability to add connection name #2332`
* AlexFsmn `Disabled connection name input when connecting to a server. #2566`
* SebastianPfliegel `Added more saveAsCsv options #2099`
* ianychoi `Fixes a typo: Mimunum -> Minimum #1994`
* AlexFsmn `Fixed bug where proper file extension wasn't appended to the filename. #2151`
* AlexFsmn `Added functionality for adding any file to import wizard #2329`
* AlexFsmn `Fixed background issue when copying a chart to clipboard #2215`
* AlexFsmn `Fixed problem where vertical charts didn't display labels correctly. #2263`
* AlexFsmn `Fixed Initial values for charts to match visuals #2266`
* AlexFsmn `Renamed chart option labels #2264`
* AlexFsmn `Added feature for the opening file after exporting to CSV/XLS/JSON & query files #2216`
* AlexFsmm `Get Connection String should copy to clipboard #2175`
* lanceklinger `Fix for double-clicking column handle in results table #1504`
* westerncj for `Removed duplicate contribution from README.md (#753)`
* ntovas for `Fix for duplicate extensions shown in "Save File" dialog. (#779)`
* SebastianPfliegel for `Add cursor snippet (#475)`
* mikaoelitiana for the fix: `revert README and CONTRIBUTING after last VSCode merge (#574)`
* alextercete for `Reinstate menu item to install from VSIX (#682)`
* alextercete for `Fix "No extension gallery service configured" error (#427)`
* mwiedemeyer for `Fix #58: Default sort order for DB size widget (#111)`
* AlexTroshkin for `Show disconnect in context menu only when connectionProfile connected (#150)`
* AlexTroshkin for `Fix #138: Invalid syntax color highlighting (identity not highlighting) (#140))`
* stebet for `Fix #153: Fixing sql snippets that failed on a DB with a case-sensitive collation. (#152)`
* SebastianPfliegel `Remove sqlExtensionHelp (#312)`
* olljanat for `Implemented npm version check (#314)`
* Adam Machanic for helping with the `whoisactive` extension

And of course, we'd like to thank the authors of all upstream dependencies.  Please see a full list in the [ThirdPartyNotices.txt](https://raw.githubusercontent.com/Microsoft/azuredatastudio/main/ThirdPartyNotices.txt)

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [Source EULA](LICENSE.txt).

[win-user]: https://go.microsoft.com/fwlink/?linkid=2170400
[win-system]: https://go.microsoft.com/fwlink/?linkid=2170401
[win-zip]: https://go.microsoft.com/fwlink/?linkid=2170402
[osx-zip]: https://go.microsoft.com/fwlink/?linkid=2169955
[linux-zip]: https://go.microsoft.com/fwlink/?linkid=2170045
[linux-rpm]: https://go.microsoft.com/fwlink/?linkid=2170403
[linux-deb]: https://go.microsoft.com/fwlink/?linkid=2169956
