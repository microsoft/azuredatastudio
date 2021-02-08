# Server Reports for Azure Data Studio

Welcome to **Server Reports** for Azure Data Studio! Server Reports give useful insights about the server related to performance. These can be used to see current activity as well as historical activity. Here is a list of some of the available reports.

* DB Space Usage
* DB Buffer Usage
* CPU Utilization
* Backup Growth Trend
* Wait counts

<img src="https://github.com/Microsoft/azuredatastudio/raw/main/samples/serverReports/images/server_reports.png" alt="Server Reports" style="width:480px;"/>

This extension is inspired by SQL Server Management Studio (SSMS)'s reports. We will continually add more useful server insights and tasks.

## Building your own reports
This extension is also useful as a sample dashboard extension. It demonstrates building a dedicated dashboard extension with a set of insights built in. You can get started building your own reports by following the [extension authoring guide].

See the [Server Reports Extension Project] in the Azure Data Studio repository on Github for the extension source code.

[Server Reports Extension Project]:https://github.com/Microsoft/azuredatastudio/tree/main/samples/serverReports
[extension authoring guide]:https://github.com/Microsoft/azuredatastudio/wiki/Getting-started-with-Extensibility


## Contributions and "thank you"
Special thanks to our Microsoft MVPs for providing useful queries.
*	Paul Randal:
https://www.sqlskills.com/blogs/paul/wait-statistics-or-please-tell-me-where-it-hurts/

See [Paul Randal's wait types library] for more information about each wait type in the Wait Counts widget.

[Paul Randal's wait types library]:https://www.sqlskills.com/help/waits

*	Glenn Berry: https://gallery.technet.microsoft.com/scriptcenter/All-Databases-Data-log-a36da95d

*	Aaron Bertrand: https://www.mssqltips.com/sqlservertip/2393/determine-sql-server-memory-use-by-database-and-object/


We would like to thank all our users who raised issues, and in particular the following users who helped contribute fixes:
*	flyfishingdba for Add square brackets for ms_foreachdb call (#1023)
*	Peter-Schneider for Changed the stored procedure call to work on case sensitive instances (#1809)

## What's new in Server Reports v1.5?
* Add VDI_CLIENT_OTHER to the ignore list in the script used by the wait counts widget

## What's new in Server Reports v1.4?
* Add PREEMPTIVE_OS_FLUSHFILEBUFFERS to the ignore list in the script used by the wait counts widget

## What's new in Server Reports v1.3?
* Changed the stored procedure call to work on case sensitive instances

## What's new in Server Reports v1.2?
* Created left nav bar and added 2 categories for insight widgets: monitor and performance

## What's new in Server Reports v1.1?
* Fixed DB Space Usage where it threw an error when database names contain special characters
* Changed DB Space Usage and DB Buffer Usage to show only top 10 data

## How to produce an extension installation package
Run the following commands sequentially in the context of this directory:
- `yarn install` - to install the dependencies
- `yarn build` - to build the code
- `vsce package` - to produce an extension installation package
