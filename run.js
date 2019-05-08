const fs = require("fs");
const path = require("path");
const exec = require("child_process").execSync;
const mysqlConfig = require("./config.json").mysql;
const replace = require('replace-in-file');
const argv = require('yargs')
  .version('1.0')
  .alias('version', 'v')
  .option('full-dump', {
    alias: 'd',
    describe: 'dump all databases to output folder',
    type: 'boolean',
    default: false
  })
  .option('run-queries', {
    alias: 'q',
    describe: 'export database query results. queries are defined in connection config(s)',
    type: 'boolean',
    default: false
  })
  .option('ignore', {
    alias: 'i',
    describe: 'list of tables to ignore',
    type: 'array'
  })
  .option('merge', {
    alias: 'm',
    describe: 'merge all databases into target db',
    type: 'boolean',
    default: false
  })
  .option('preview', {
    alias: 'p',
    describe: 'preview commands sent to MySQL binaries',
    type: 'boolean',
    default: false
  })
  .option('connections', {
    alias: 'c',
    describe: 'connection(s) to export',
    type: 'array'
  })
  .usage('Usage: $0 <cmd> [options]')
  .example('node run.js --full-dump --run-queries --merge', 'backup all databases, run all queries and merge all databases')
  .argv ;

if (!fs.existsSync(mysqlConfig.output_path)) {
  fs.mkdirSync(mysqlConfig.output_path);
}
const preview = argv['preview'];
const ignore = argv['ignore'];
let connections = (argv['connection'] || []).map(c => mysqlConfig.connections.filter(f => f.name === c).pop());
connections = connections.length !== 0 ? connections : mysqlConfig.connections;

const dump = (opts) => {
  const { mysqldump_path, host, port, database, username, password, output, input, noCreateInfo, noData, noTriggers, noRoutines, noCreateDb } = opts;  
  const ignoreTables = (ignore && ignore.length > 0) ? ignore.map(i => `--ignore-table=${database}.${i}`).join(" ") : "";
  const cmd = `"${mysqldump_path ? mysqldump_path : mysqlConfig.mysqldump_path}" ${ignoreTables} --host=${host} --port=${port} --user=${username} --password=${password} ${database ? '--databases ' + database : '--all-databases'} ${noTriggers ? '--skip-triggers' : ''} ${noRoutines ? '--skip-routines' : ''} ${noCreateInfo ? '--no-create-info' : ''} ${noData ? '--no-data' : ''} ${noCreateDb ? '--no-create-db' : ''} ${output ? '> ' + output : ''}  ${input ? '< ' + input : ''} --insert-ignore`;
  
  if (preview)
    console.log(cmd);
  else
    exec(cmd);
};

const execSql = (opts) => {
  const { host, port, database, username, password, input, output, force, mysql_path, ignoreForeignKeyChecks } = opts;
  const cmd = `"${mysql_path ? mysql_path : mysqlConfig.mysql_path}" ${force ? '--force' : ''} ${ignoreForeignKeyChecks ? '--init-command="SET SESSION FOREIGN_KEY_CHECKS=0;"' : ''} --host=${host} --port=${port} --user=${username} --password=${password} ${database ? '--database ' + database : ''} ${output ? '--batch --raw' : ''} ${input ? '< ' + input : ''} ${output ? '> ' + output : ''}`;
  
  if (preview)
    console.log(cmd);
  else
    exec(cmd);
};

const dumpAll = () => {
  if (!fs.existsSync(`${mysqlConfig.output_path}/${mysqlConfig.dump_subdir}`)) {
    fs.mkdirSync(`${mysqlConfig.output_path}/${mysqlConfig.dump_subdir}`);
  }
  connections.forEach(c => {
    const { host, port, database, username, password } = c;
    try {
      const output = `${mysqlConfig.output_path}/${mysqlConfig.dump_subdir}/${database}.sql`;
      console.log(output);
      dump({ host, port, database, username, password, output });
    } catch (err) {
      console.log(err);
    }
  });
};

const runQueries = () => {
  if (!fs.existsSync(`${mysqlConfig.output_path}/${mysqlConfig.results_subdir}`)) {
    fs.mkdirSync(`${mysqlConfig.output_path}/${mysqlConfig.results_subdir}`);
  }
  connections.forEach(c => {
    const { host, port, database, username, password, mysql_path, mysqldump_path } = c;
    
    if (!fs.existsSync(`${mysqlConfig.output_path}/${mysqlConfig.results_subdir}/${database}`)) {
      fs.mkdirSync(`${mysqlConfig.output_path}/${mysqlConfig.results_subdir}/${database}`);
    }

    c.sql.forEach(s => {
      try {
        const input = `./${mysqlConfig.queries_path}/${s}.sql`;
        const sqlName = path.basename(input, path.extname(input));
        const output = `${mysqlConfig.output_path}/${mysqlConfig.results_subdir}/${database}/${sqlName}.${mysqlConfig.result_extension}`;
        console.log(output);
        execSql({ host, port, database, username, password, input, output, mysql_path, mysqldump_path });
      } catch (err) {
        console.log(err);
      }
    });
  });
};

const merge = () => {
  if (!fs.existsSync(`${mysqlConfig.output_path}/${mysqlConfig.merge_subdir}`)) {
    fs.mkdirSync(`${mysqlConfig.output_path}/${mysqlConfig.merge_subdir}`);
  }
  const { merge_db_connection } = mysqlConfig;

  const template = mysqlConfig.connections.filter(c => c.name === merge_db_connection.template_db).pop();
  console.log(`Merging databases | template: ${template.database} | target:${merge_db_connection.template_db}`);
  try {
    const { host, port, database, username, password, mysql_path, mysqldump_path } = template;
    // Generate the schema SQL
    const sql = `${mysqlConfig.output_path}/${mysqlConfig.merge_subdir}/schema.sql`;
    dump({
      host,
      port,
      database,
      username,
      password,
      output: sql,
      noData: true,
      noTriggers: true,
      noRoutines: true,
      mysql_path,
      mysqldump_path
    });
    replace.sync({ files: sql, from: new RegExp(template.database, "g"), to: merge_db_connection.database });

    // Run the schema SQL 
    execSql({
      host: merge_db_connection.host,
      port: merge_db_connection.port,
      username: merge_db_connection.username,
      password: merge_db_connection.password,
      input: sql
    });
  } catch (err) {
    console.log(err);
  }
  
  connections.forEach(c => {
    const { host, port, database, username, password, mysqldump_path } = c;
    try {
      const sql = `${mysqlConfig.output_path}/${mysqlConfig.merge_subdir}/${database}.sql`;

      console.log(`Importing ${database} ...`);

      // Generate input file for target schema
      dump({
        host,
        port,
        database,
        username,
        password,
        output: sql,
        mysqldump_path,
        noTriggers: true,
        noRoutines: true,
        noCreateDb: true,
        noCreateInfo: true
      });
      replace.sync({ files: sql, from: /USE/g, to: '-- USE' });

      // Read input file into target schema
      execSql({
        host: merge_db_connection.host,
        port: merge_db_connection.port,
        database: merge_db_connection.database,
        username: merge_db_connection.username,
        password: merge_db_connection.password,
        input: sql,
        force: true,
        ignoreForeignKeyChecks: true
      });
    } catch (err) {
      console.log(err);
    }
  });
};

if (argv['full-dump'])
  dumpAll();

if (argv['run-queries'])
  runQueries();
  
if (argv['merge'])
  merge();
