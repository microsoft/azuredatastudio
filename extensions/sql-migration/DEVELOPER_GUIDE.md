# SQL Migration Extension Developer Guide

SQL migration utilizes a backend service to execute assessments and provide SKU recommendations. The source code for the backend service can be found at  [Microsoft.SqlTools.Migration](https://github.com/microsoft/sqltoolsservice/tree/main/src/Microsoft.SqlTools.Migration).

During regular usage of the extension, the backend service is downloaded from a URL specified in the config.json file.

When developing the extension, it is possible to run the backend service locally and debug the extension against the local backend service. This guide will walk you through the necessary steps to do so.

## Using ADS_MIGRATIONSERVICE environment variable

1. Clone the sqltoolsservice repository by running `git clone git@github.com:microsoft/sqltoolsservice.git`
1. Navigate to the migration folder by running `cd src/Microsoft.SqlTools.Migration`
1. Publish the project by running `dotnet publish -r <platform>` (e.g. `dotnet publish -r win-x64`). This will publish the project to a folder similar to `bin/Debug/net7.0/<platform>/publish/`
1. In a terminal window, set the `ADS_MIGRATIONSERVICE` environment variable to the full path of the publish folder from the previous step.
For example:
	```
	$ENV:ADS_MIGRATIONSERVICE=/Users/username/sqltoolsservice/src/Microsoft.SqlTools.Migration/bin/Debug/net7.0/win-x64/publish
	```
1. Launch Azure Data Studio from the same terminal where you set the environment variable. When the migration service is activated, it will use the backend service from the environment variable path.
1. You should see a pop-up notification indicating that the migration service is running from the environment variable path. If this notification does not appear, check that the environment variable is spelled correctly and that it points to the correct directory.
1. After making changes to the service, you can republish the project and launch Azure Data Studio again from the same terminal where you set the environment variable.

## Replacing the Binaries Manually

1. Close any running instances of Azure Data Studio.
1. Copy the publish folder from  `src/Migration.SqlTools.Migration/bin/Debug/net7.0/<platform>/publish/` to `src/extensions/sql-migration/`. For example:
	```
	cp -r <src>/sqltoolsservice/src/Microsoft.SqlTools.Migration/bin/Debug/net7.0/win-x64/publish <src>/azuredatastudio/extensions/sql-migration/migrationService/<platform>/<version>/
	```
1. Launch Azure Data Studio from `<src>/azuredatastudio`


## Debugging the extension service:

### The logs for the extension and service during runtime can be accessed by:

1. Opening the command palette (Ctrl+P) and searching for "Developer: Open Extensions Logs Folder"
2. Opening the Microsoft.sql-migration folder to access the log files. You will see three different log files:
	* `MicrosoftSqlToolsMigration`: logs for the migration service
	* `SqlAssessmentReport-<TIMESTAMP>`: report generated everytime user runs the assessment
	* `SqlAssessmentsLogs`: folder that contains runtime logs for the assessments
