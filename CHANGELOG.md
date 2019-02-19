# Change Log

## Version 1.4.5
* Release date: February 13, 2019
* Release status: General Availability

## What's new in this version
* Added **Admin pack for SQL Server** extension pack to make it easier to install SQL Server admin-related extensions. This includes:
    * [SQL Server Agent](https://docs.microsoft.com/en-us/sql/azure-data-studio/sql-server-agent-extension?view=sql-server-2017)
    * [SQL Server Profiler](https://docs.microsoft.com/en-us/sql/azure-data-studio/sql-server-profiler-extension?view=sql-server-2017)
    * [SQL Server Import](https://docs.microsoft.com/en-us/sql/azure-data-studio/sql-server-import-extension?view=sql-server-2017)
* Added filtering extended event support in Profiler extension
* Added Save as XML feature that can save T-SQL results as XML
* Added Data-Tier Application Wizard improvements
    * Added Generate script button
    * Added view to give warnings of possible data loss during deployment
* Updates to the [SQL Server 2019 Preview extension](https://docs.microsoft.com/sql/azure-data-studio/sql-server-2019-extension?view=sql-server-ver15)
* Results streaming enabled by default for long running queries
* Resolved [bugs and issues](https://github.com/Microsoft/azuredatastudio/milestone/23?closed=1).

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* AlexFsmn for `Added context menu for DBs in explorer view to backup & restore db. #2277`
* sadedil for `Missing feature request: Save as XML #3729`
* gbritton1 for `Removed reference to object explorer #3463`

## Version 1.3.8
* Release date: January 9, 2019
* Release status: General Availability

## What's new in this version
* #13 Feature Request: Azure Active Directory Authentication
* #1040 Stream initial query results as they become available
* #3298 Сan't add an azure account.
* #2387 Support Per-User Installer
* SQL Server Import updates for DACPAC\BACPAC
* SQL Server Profiler UI and UX improvements
* Updates to [SQL Server 2019 extension](https://docs.microsoft.com/sql/azure-data-studio/sql-server-2019-extension?view=sql-server-ver15)
* **sp_executesql to SQL** and **New Database** extensions

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* Tarig0  for `Add Routine_Type to CreateStoredProc fixes #3257 (#3286)`
* oltruong  for `typo fix #3025'`
* Thomas-S-B for `Removed unnecessary IErrorDetectionStrategy #749`
* Thomas-S-B for `Simplified code #750`

## Version 1.2.4
* Release date: November 6, 2018
* Release status: General Availability

## What's new in this version
* Update to the SQL Server 2019 Preview extension
* Introducing Paste the Plan extension
* Introducing High Color queries extension, including SSMS editor theme
* Fixes in SQL Server Agent, Profiler, and Import extensions
* Fix .Net Core Socket KeepAlive issue causing dropped inactive connections on macOS
* Upgrade SQL Tools Service to .Net Core 2.2 Preview 3 (for eventual AAD support)
* Fix customer reported GitHub issues

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* rdaniels6813  for `Add query plan theme support #3031`
* Ruturaj123 for `Fixed some typos and grammatical errors #3027`
* PromoFaux for `Use emoji shortcodes in CONTRIBUTING.md instead of � #3009`
* ckaczor for `Fix: DATETIMEOFFSET data types should be ISO formatted #714`
* hi-im-T0dd for `Fixed sync issue with my forked master so this commit is correct #2948`
* hi-im-T0dd for `Fixed when right clicking and selecting Manage-correct name displays #2794`

## Version 1.1.3
* Release date: October 18, 2018
* Release status: General Availability

## What's new in this version
* Introducing the Azure Resource Explorer to browse Azure SQL Databases
* Improve Object Explorer and Query Editor connectivity robustness
* SQL Server 2019 and SQL Agent extension improvements

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* philoushka  for `center the icon #2760`
* anthonypants for `Typo #2775`
* kstolte for `Fix Invalid Configuration in Launch.json #2789`
* kstolte for `Fixing a reference to SQL Ops Studio #2788`

## Version 1.0.0
* Release date: September 24, 2018
* Release status: General Availability

## What's new in this version
* Announcing the SQL Server 2019 Preview extension.
  * Support for SQL Server 2019 preview features including big data cluster support.
  * Azure Data Studio Notebooks
  * The Azure Resource Explorer viewlets you browse data-related endpoints for your Azure accounts and create connections to them in Object Explorer. In this release Azure SQL Databases and servers are supported.
  * SQL Server Polybase Create External Table Wizard
* Query Results Grid performance and UX improvements for large number of result sets.
* Visual Studio Code source code refresh from 1.23 to 1.26.1 with Grid Layout and Improved Settings Editor (preview).
* Accessibility improvements for screen reader, keyboard navigation and high-contrast.
* Added Connection name option to provide an alternative display name in the Servers viewlet.

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* AlexFsmn `Feature: Ability to add connection name #2332`
* AlexFsmn `Disabled connection name input when connecting to a server. #2566`

## Version 0.33.7
* Release date: August 30, 2018
* Release status: Public Preview

## What's new in this version
* Announcing the SQL Server Import Extension
* SQL Server Profiler Session management
* SQL Server Agent improvements
* New community extension: First Responder Kit
* Quality of Life improvements: Connection strings
* Fix many customer reported GitHub issues

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* SebastianPfliegel `Added more saveAsCsv options #2099`
* ianychoi `Fixes a typo: Mimunum -> Minimum #1994`
* AlexFsmn `Fixed bug where proper file extension wasn't appended to filename. #2151`
* AlexFsmn `Added functionality for adding any file to import wizard #2329`
* AlexFsmn `Fixed background issue when copying a chart to clipboard #2215`
* AlexFsmn `Fixed problem where vertical charts didn't display labels correctly. #2263`
* AlexFsmn `Fixed Initial values for charts to match visuals #2266`
* AlexFsmn `Renamed chart option labels #2264`
* AlexFsmn `Added feature for opening file after exporting to CSV/XLS/JSON & query files #2216`
* AlexFsmm `Get Connection String should copy to clipboard #2175`

## Version 0.31.4
* Release date: July 19, 2018
* Release status: Public Preview

## What's new in this version
* SQL Server Agent for Azure Data Studio extension improvements
  * Added view of Alerts, Operators, and Proxies and icons on left pane
  * Added dialogs for New Job, New Job Step, New Alert, and New Operator
  * Added Delete Job, Delete Alert, and Delete Operator (right-click)
  * Added Previous Runs visualization
  * Added Filters for each column name
* SQL Server Profiler for Azure Data Studio extension improvements
  * Added Hotkeys to quickly launch and start/stop Profiler
  * Added 5 Default Templates to view Extended Events
  * Added Server/Database connection name
  * Added support for Azure SQL Database instances
  * Added suggestion to exit Profiler when tab is closed when Profiler is still running
* Release of Combine Scripts Extension
* Wizard and Dialog Extensibility
* Fix GitHub Issues

## Version 0.30.6
* Release date: June 20, 2018
* Release status: Public Preview

## What's new in this version
* **SQL Server Profiler for Azure Data Studio  *Preview*** extension initial release
* The new **SQL Data Warehouse** extension includes rich customizable dashboard widgets surfacing insights to your data warehouse. This unlocks key scenarios around managing and tuning your data warehouse to ensure it is optimized for consistent performance.
* **Edit Data "Filtering and Sorting"** support
* **SQL Server Agent for Azure Data Studio *Preview*** extension enhancements for Jobs and Job History views
* Improved **Wizard & Dialog UI Builder Framework** extensibility APIs
* Update VS Code Platform source code integrating [March 2018 (1.22)](https://code.visualstudio.com/updates/v1_22) and [April 2018 (1.23)](https://code.visualstudio.com/updates/v1_23)  releases
* Fix GitHub Issues

## Version 0.29.3
* Release date: May 7, 2018
* Release status: Public Preview

## What's new in this version
The May release is focused on stabilization and bug fixes leading up to the Build conference.  This build contains the following highlights.

* Announcing **Redgate SQL Search** extension available in Extension Manager
* Community Localization available for 10 languages: **German, Spanish, French, Italian, Japanese, Korean, Portuguese, Russian, Simplified Chinese and Traditional Chinese!**
* Reduced telemetry collection, improved [opt-out](https://github.com/Microsoft/azuredatastudio/wiki/How-to-Disable-Telemetry-Reporting) experience and in-product links to [Privacy Statement](https://privacy.microsoft.com/en-us/privacystatement)
* Extension Manager has improved Marketplace experience to easily discover community extensions
* SQL Agent extension Jobs and Job History view improvement
* Updates for **whoisactive** and **Server Reports** extensions
* Continue to fix GitHub issues

## Version 0.28.6
* Release date: April 25, 2018
* Release status: Public Preview

## What's new in this version
The April Public Preview release contains some of the following highlights.

* Improvements to SQL Agent *Preview* extension
* Accessibility improvements for keyboard navigation, screen reader support and high-contrast mode.
* Improved large and protected file support for saving Admin protected and >256M files within SQL Ops Studio
* Integrated Terminal splitting to work with multiple open terminals at once
* Reduced installation on-disk file count foot print for faster installs and startup times
* Improvements to Server Reports extension
* Continue to fix GitHub issues

## Version 0.27.3
* Release date: March 28, 2017
* Release status: Public Preview

## What's new in this version
The March Public Preview release enables some key aspects of the Azure Data Studio
extensibility story.  Here are some highlights in this release.

* Enhance the Manage Dashboard extensibility model to support tabbed Insights and Configuration panes
* Dashboard Insights extensions for `sp_whoisactive` from [whoisactive.com](http://whoisactive.com)
* Extension Manager enables simple acquisition of 1st-party and 3rd-party extensions
* Add additional Extensibility APIs for `connection` and `objectexplorer` management
* Community Localization open for 10 languages
* Continue to fix important customer impacting GitHub issues

## Version 0.26.7
* Release date: February 16, 2017
* Release status: Public Preview Hotfix 1

## What's new in this version
* Bug fix for `#717 Selecting partial query and hitting Cmd or Ctrl+C opens terminal with Error message`

## Version 0.26.6
* Release date: February 15, 2017
* Release status: Public Preview

## What's new in this version
The February release fixes several important customer reported issues, as well as various feature improvements.  We've also introduced auto-update support in February which will simplify keeping updated with the lastest changes.

Here's some of the highlights in the February release.

* Support Auto-Update installation on Windows and macOS
* Publish RPM and DEB packages to offical Microsoft repos
* Fix `#6 Keep connection and selected database when opening new query tabs`
* Fix `#22 'Server Name' and 'Database Name' - Can these be drop downs instead of text` boxes?
* Fix #481 Add "Check for updates" option.
* SQL Editor colorization and auto-completion fixes
  * `#584 Keyword "FULL" not highlighted by IntelliSense`
  * `#345 Colorize SQL functions within the editor`
  * `#300 [#tempData] latest "]" will display green color`
  * `#225 Keyword color mismatch`
  * `#60 invalid sql syntax color highlighting when using temporary table in from clause`
* Introduce Connection extensibility API
* VS Code Editor 1.19 integration
* Update JustinPealing/html-query-plan component to pick-up several Query Plan viewer improvements

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* SebastianPfliegel for `Add cursor snippet (#475)`
* mikaoelitiana for fix: `revert README and CONTRIBUTING after last VSCode merge (#574)`
* alextercete for `Reinstate menu item to install from VSIX (#682)`

## Version 0.25.4
* Release date: January 17, 2017
* Release status: Public Preview

## What's new in this version
The January release focuses on addressing a few of the top upvoted feature suggestions, as well as fixing high-priority bugs.  This release period coincides with holiday vacations, so the churn in this release is
relatively scoped.

Here's some of the highlights in the January release.

* Tab-coloring based on Server Group
* Saved Server connections are available in Connection Dialog
* Enable HotExit feature
* Fix broken Run Current Query command
* Fix drag-and-drop breaking scripting bug
* Fix incorrect pinned Start Menu icon
* Fix missing Azure Account branding icon
* Change "Server name" to "Server" in Connection Dialog

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:

* alextercete for `Fix "No extension gallery service configured" error (#427)`
* SebastianPfliegel for `Add cursor snippet (#475)`

## Version 0.24.1
* Release date: December 19, 2017
* Release status: Public Preview

## What's new in this version
* Azure Integration with Create Firewall Rule
* Windows Setup, Linux DEB and Linux RPM installation packages
* Manage Dashboard visual layout editor
* Script As Alter and Script As Execute commands
* Integrate VS Code 1.18.1 editor platform
* Enable Sideloading of VSIX Extension files
* Support "GO N" batch iteration syntax
* "Run Current Query with Actual Plan" command
* Delete Recent Connection command in Connection Dialog
* Performance fixes for Object Explorer expansion and Scripting sprocs
* Fix IntelliSense settings namespace to be `mssql.*`
* Only show `Disconnect` menu item if server is connected
* Several snippet and default widget improvements
* Improve Kerberos connection failure error message
* Add command to hide query results window after running query
* Retain cursor line positon when switching document tabs
* Keep cursor focus in editor window after executing query
* Support shortcuts to execute common queries like sp_who or sp_help
* Fix tab order behavior when using keyboard to navigate dialog controls
* Improved chart axis and label behavior
* Allow expanding databases not in certain non-Online states
* Connection Dialog selects most common default authentication method based on platform

## Contributions and "thank you"
We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:
* mwiedemeyer for `Fix #58: Default sort order for DB size widget (#111)`
* AlexTroshkin for `Show disconnect in context menu only when connectionProfile connected (#150)`
* AlexTroshkin for `Fix #138: Invalid syntax color highlighting (identity not highlighting) (#140))`
* stebet for `Fix #153: Fixing sql snippets that failed on a DB with case-sensitive collation. (#152)`
* SebastianPfliegel `Remove sqlExtensionHelp (#312)`
* olljanat for `Implemented npm version check (#314)`
