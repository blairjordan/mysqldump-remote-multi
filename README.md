# mysql-remote-multi 🐬

This tool can be used to quickly retrieve dumps of MySQL databases remotely.

## Usage

Create **config.json** and execute `npm start`.

## Demo config.json

    { 
	    "mysql": {
		    "mysql_path" : "C:/Program Files/MySQL/MySQL Server/bin/mysql.exe",
		    "mysqldump_path" : "C:/Program Files/MySQL/MySQL Server/bin/mysqldump.exe",
		    "output_path" : "./output",
		    "queries_path" : "./queries",
		    "dump_subdir" : "dump",
		    "results_subdir" : "results",
        	"result_extension" : "tsv",
			"merge_db_connection" : {
			    "host" : "localhost",
			    "port" : "3306",
			    "template_db": "connection1",
			    "database" : "merged_db",
			    "username" : "testuser",
			    "password" : "mypassword"
			},
		    "connections" : [
			    {
				"name" : "connection1",
			        "host" : "EXAMPLEHOST",
			        "port" : "3366",
			        "database" : "db_name",
			        "username" : "testuser",
			        "password" : "mypassword",
			        "sql" : ["sqlfile1", "sqlfile2"]
			    },
			    {
				"name" : "connection2",
			        "host" : "EXAMPLEHOST2",
			        "port" : "3366",
			        "database" : "old_db",
			        "username" : "testuser",
			        "password" : "mypassword",
			        "mysql_path" : "C:/Program Files/MySQL/MySQL Server 5.0/bin/mysql.exe",
			        "mysqldump_path" : "C:/Program Files/MySQL/MySQL Server 5.0/bin/mysqldump.exe",
			    }
		    ]
	    }
    }

The demo above will connect to a single mysql host, and write dump files to **output/dump**.

The following queries will also be executed:
- queries/sqlfile1.sql
- queries/sqlfile2.sql

Query output will be saved to **output/results/db_name/**

The example also shows the bin override in the **connection2** connection, which allows you to use legacy MySQL binaries.

## Arguments

### --run-queries

`node run.js --run-queries`

Run all queries for each connection. Queries are specified per-connection, e.g.

	"connections" : [
	    {
	        "name" : "sampleconnection",
	        "host" : "EXAMPLEHOST",
	        "port" : "3366",
	        "database" : "db_name",
	        "username" : "testuser",
	        "password" : "mypassword",
	        "sql" : ["sqlfile1", "sqlfile2"]
	    },
	    ...
	]


In the above example, two statements will be run: **sqlfile1.sql** and **sqlfile2.sql**.

Queries are sourced from the `queries_path` folder.

Results are placed under the `output_path`/`results_subdir` subdirectory.

### --full-dump

Export a full database dump for all database connections.

`node run.js --full-dump`

Dumps are placed under the `output_path`/`dump_subdir` subdirectory.

### --merge

Merge all databases into a single database.

Before running a merge, you should ensure that you have a `merge_db_connection` object defined in **config.json**.

Example:

	...
	"merge_db_connection" : {
	    "host" : "localhost",
	    "port" : "3306",
	    "template_db": "db_name",
	    "database" : "merged_db",
	    "username" : "testuser",
	    "password" : "mypassword"
	},
	"connections" : [
        {
	    "host" : "EXAMPLEHOST",
	    "port" : "3366",
	    "database" : "db_name",
	    "username" : "testuser",
	    "password" : "mypassword",
	    "sql" : ["sqlfile1", "sqlfile2"]
         },
	...
	]
	...

The `template_db` should refer to a specific database name in the `connections` array.

The template database is used to generate the initial schema definition.

The schema definition will be applied to a new database. The new database name is defined in the `merge_db_connection`.

### --ignore

Specify tables to ignore during dump/ merge process. 

`node run.js --merge --ignore table1 table2`

or

`node run.js --merge --ignore table1 --ignore table2`

### --preview

Preview all mysql and mysqldump commands without running them.

### --connections

You can optionally specify which connection names you wish to include in your export.

Ommitting the `--connections` flag will export all connections.

`node run.js --full-dump --connections connection1 connection2`
