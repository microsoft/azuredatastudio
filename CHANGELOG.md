# Change Log

## Version 0.31.4
* Release date: July 19, 2018
* Release status: Public Preview

## What's new in this version
* SQL Server Agent for SQL Operations Studio extension improvements
  * Added view of Alerts, Operators, and Proxies and icons on left pane
  * Added dialogs for New Job, New Job Step, New Alert, and New Operator
  * Added Delete Job, Delete Alert, and Delete Operator (right-click)
  * Added Previous Runs visualization
  * Added Filters for each column name
* SQL Server Profiler for SQL Operations Studio extension improvements
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
* **SQL Server Profiler for SQL Operations Studio  *Preview*** extension initial release
* The new **SQL Data Warehouse** extension includes rich customizable dashboard widgets surfacing insights to your data warehouse. This unlocks key scenarios around managing and tuning your data warehouse to ensure it is optimized for consistent performance.
* **Edit Data "Filtering and Sorting"** support
* **SQL Server Agent for SQL Operations Studio *Preview*** extension enhancements for Jobs and Job History views
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
* Reduced telemetry collection, improved [opt-out](https://github.com/Microsoft/sqlopsstudio/wiki/How-to-Disable-Telemetry-Reporting) experience and in-product links to [Privacy Statement](https://privacy.microsoft.com/en-us/privacystatement)
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
The March Public Preview release enables some key aspects of the SQL Operations
Studio extensibility story.  Here are some highlights in this release.

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
