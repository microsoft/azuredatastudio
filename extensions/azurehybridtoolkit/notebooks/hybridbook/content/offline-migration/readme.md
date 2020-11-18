# Offline Migration
[Home](../readme.md)

## Notebooks in this Chapter
This chapter contains a set of Notebooks that enables migration of local SQL Server resources to Azure. Use the table below to choose the correct Notebook for the appropriate migration scenario. 

| Notebook | SQL Resource Type  | Azure Resource Type | Description 
| -------- | ------------------ | ------------------- | ----------- 
| [Create Database Backups](create-sql-backups.ipynb) | SQL Server Database(s) | N/A | Export existing databases to a backups folder for later migration. This major task has its own notebook since it could be long running. Creates a ***.bacpac** file for each database a specified folder. 
| [Migrate Instance to Azure SQL VM](instance-to-VM.ipynb) | SQL Server Instance | Azure SQL Virtual Machine | Migrate a single local instance to Azure using a SQL VM to host a new instance. 
| [Migrate Database to Azure SQL VM](db-to-VM.ipynb) | SQL Server Database(s) | Azure SQL Virtual Machine | Migrate local SQL database(s) using the backups folder created in a separate notebook.
| [Migrate Instance to Azure SQL MI](instance-to-MI.ipynb) | SQL Server Instance | Azure SQL Managed Instance | Migrate a single SQL Instance to an Azure Managed Instance. 
| [Migrate Database to Azure SQL MI](db-to-MI.ipynb) | SQL Server Database(s) | Azure SQL Managed Instance |
| [Migrate Database to Azure SQL DB](db-to-SQLDB.ipynb) | SQL Server Database(s) | Azure SQL Database(s) | One-to-one migration of a folder of database backups to the cloud as individual databases. 