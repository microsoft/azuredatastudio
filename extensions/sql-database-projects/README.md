# SQL Database Projects extension

Database source control where objects are stored as code, integrating with build-time validation and dynamically calculated deployments for database DevOps. Cross-platform and compatible with Visual Studio SQL Server Data Tools (SSDT) for SQL Server, Azure SQL, and Fabric SQL.

## Overview

SQL Database Projects for Azure Data Studio and VS Code provides a way to design, edit, and publish objects to SQL databases from a source controlled project. For a complete development workflow, build and deploy your database projects in CI/CD pipelines, such as [GitHub Actions](https://github.com/azure/sql-action) or Azure DevOps.

![SQL project lifecycle](https://raw.githubusercontent.com/microsoft/azuredatastudio/main/extensions/sql-database-projects/images/sqlproj-lifecycle.png)

📕 Learn more about SQL Database Projects in the documentation: https://aka.ms/sqlprojects

## Requirements

The extension will prompt to install the [.NET SDK](https://aka.ms/sqlprojects-dotnet) if it is not found, as it is required to build SQL projects. You can also install the .NET SDK manually from [here](https://aka.ms/sqlprojects-dotnet) for Windows, macOS, and Linux.

## Quick start

1. Create a new database project by going to the Database Projects view or by searching for Database Projects: New in the command palette.
2. Add `.sql` files to the project to define database objects. For example, creating a file `Product.sql` in the SQL project folder to add a table named `Product`:
  ```sql
  CREATE TABLE [dbo].[Product](
      [ProductID] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
      [ProductName] [nvarchar](200) NOT NULL
  );
  ```
3. Build the SQL project to validate the SQL syntax and object references. In the Database Projects view, right-click the database project's root node and select Build.
4. Building the project created a `.dacpac` file in the output folder. This file contains the schema of the database project and can be deployed to a SQL Server or Azure SQL instance.

📕 Dive in further with this complete tutorial for [creating and deploying a SQL project](https://learn.microsoft.com/sql/tools/sql-database-projects/tutorials/create-deploy-sql-project?pivots=sq1-visual-studio-code).

![AdventureWorks SQL project](https://raw.githubusercontent.com/microsoft/azuredatastudio/main/extensions/sql-database-projects/images/readme-sqlproj.png)

## Features

- [Microsoft.Build.Sql SDK-style projects](https://aka.ms/sqlprojects)
- [Develop and validate database objects using T-SQL](https://learn.microsoft.com/sql/tools/sql-database-projects/sql-database-projects#validation)
- [Start from an existing database to get it in source control](https://learn.microsoft.com/sql/tools/sql-database-projects/tutorials/start-from-existing-database?pivots=sq1-visual-studio-code)
- [Publish the database objects to a SQL Server or Azure SQL instance](https://learn.microsoft.com/sql/tools/sql-database-projects/sql-database-projects#deployment)
- [Publish the database objects to a local development container](https://learn.microsoft.com/azure-data-studio/extensions/sql-database-project-extension-build#publish-the-sql-project-and-deploy-to-a-local-container)
- [Automate generation of deployment scripts and reports](https://learn.microsoft.com/sql/tools/sqlpackage/sqlpackage#deployments)
- [Update the database project from a database and visualize differences](https://learn.microsoft.com/sql/tools/sql-database-projects/howto/compare-database-project?pivots=sq1-visual-studio-code)
- [Code analysis for best practices](https://learn.microsoft.com/sql/tools/sql-database-projects/concepts/sql-code-analysis/sql-code-analysis?pivots=sq1-visual-studio-code)
- [Include custom scripts before and after deployment](https://learn.microsoft.com/sql/tools/sql-database-projects/concepts/pre-post-deployment-scripts?pivots=sq1-visual-studio-code)
- [Declare deploy-time variables](https://learn.microsoft.com/sql/tools/sql-database-projects/concepts/sqlcmd-variables?pivots=sq1-visual-studio-code)

### Preview Features

- Generate SQL projects from OpenAPI/Swagger specs

## Settings

### General Settings

- `sqlDatabaseProjects.dotnetSDK Location`: The path to the folder containing the `dotnet` folder for the .NET SDK. If not set, the extension will attempt to find the .NET SDK on the system.
- `sqlDatabaseProjects.microsoftBuildSqlVersion`: Version of Microsoft.Build.Sql binaries used when building SQL projects that are not SDK-style SQL projects. If not set, the extension will use Microsoft.Build.Sql 1.0.0.
- `sqlDatabaseProjects.netCoreDoNotAsk`: When true, no longer prompts to install .NET SDK when a supported installation is not found.
- `sqlDatabaseProjects.collapseProjectNodes`: Option to set the default state of the project nodes in the database projects view to collapsed. If not set, the extension will default to expanded.

### AutoRest Settings (preview)

- `sqlDatabaseProjects.nodejsDoNotAsk`: When true, no longer prompts to install Node.js when a supported installation is not found.
- `sqlDatabaseProjects.autorestSqlVersion`: Version of AutoRest.sql to use for generating SQL projects from OpenAPI/Swagger specs. If not set, the extension will use the latest version.

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Telemetry

This extensions collects telemetry data, which is used to help understand how to improve the product. For example, this usage data helps to debug issues, such as slow start-up times, and to prioritize new features. While we appreciate the insights this data provides, we also know that not everyone wants to send usage data and you can disable telemetry as described [here for Azure Data Studio](https://aka.ms/ads-disable-telemetry) or [here for VS Code](https://code.visualstudio.com/docs/getstarted/telemetry#_disable-telemetry-reporting).

## Privacy Statement

To learn more about our Privacy Statement visit [this link](https://go.microsoft.com/fwlink/?LinkID=824704).

## Feedback

Please report issues and feature requests [here.](https://github.com/microsoft/azuredatastudio/issues)

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [MIT License](https://raw.githubusercontent.com/Microsoft/azuredatastudio/main/LICENSE.txt).
