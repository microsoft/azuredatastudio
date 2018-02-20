# Change Log

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
