const { promisify } = require('node:util');
//const requestPromise = util.promisify(request);
const path = require('node:path').win32; 
const fs = require('node:fs');
const { writeFile, access } = require('node:fs/promises');
const core = require('@actions/core');
const github = require('@actions/github');
//const childProc = require('node:child_process');
const { spawn } = require('node:child_process');
const process = require("process");
//const fetch = require("node:fetch");
//const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { pipeline } = require("node:stream");
const streamPipe = promisify(pipeline);

const DEFAULT_EXIT_MSG_PREFIX = "The launcher tool exited with error code";
const LAUNCHER = "FTToolsLauncher.exe";
const LAUNCHER_URL = "https://github.com/MicroFocus/ADM-FT-ToolsLauncher/releases/download/v1.0-beta-rev12/FTToolsLauncher_net48.exe";
//const execFile = util.promisify(childProc.execFile);

/*  const time = (new Date()).toTimeString();
    core.setOutput("time", time);
    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github.context.payload, undefined, 2)
*/

//const workDir = "D:\\Work\\Temp\\UFT";
const strTests = core.getMultilineInput('tests');
console.log(`tests = ${strTests}`);
const workDir = core.getInput("work-dir") || __dirname;
console.log(`work-dir = ${workDir}`);

const timestamp = Date.now();
const propsFilename = `Props${timestamp}.txt`;
const propsFullPathFilename = path.join(workDir, `Props${timestamp}.txt`);
const resFilename = `Results${timestamp}.xml`;

console.log(`__dirname == ${__dirname}`);
process.chdir(workDir);
console.log(`__dirname == ${__dirname}`);
const tests = []
if (strTests && strTests.length > 0)
  strTests.split("\n");
for (let idx = 0; idx < tests.length; idx++) {
  console.log(`Test${idx} = ${tests[idx]}`);
  let test = path.replace(/\\/g, "\\\\");
  console.log(test);
}

//TODO make sure each test contains an absolute path using path.isAbsolute

//tests.push("D:\\\\Work\\\\UFTTests\\\\Success");
//tests.push("D:\\\\Work\\\\UFTTests\\\\QuickFail");

const launcherFullPathFilename = path.join(workDir, LAUNCHER);

main();

async function main() {
  let ok = await checkLauncher();
  if (ok) {
    ok = await createPropsFile();
    if (ok) {
      await run();
    }
  }
}

async function checkLauncher() {
  try {
    await access(launcherFullPathFilename, fs.F_OK);
    return true;
  } catch(e) {
    return await downloadLauncher();
  }
}

async function downloadLauncher() {
  try {
    const res = await fetch(LAUNCHER_URL);
    if (res.ok && res.status == 200) {
      await streamPipe(res.body, fs.createWriteStream(launcherFullPathFilename));
      console.log(`Download completed: ${launcherFullPathFilename}`);
      return true;
    } else {
      core.setFailed(`downloadLauncher: ${res.status} -> ${res.statusText} (${LAUNCHER_URL})`);
      return false;
    }
  } catch (err) {
    console.error("downloadLauncher: ", err);
    core.setFailed(err.message);
    return false;
  }
}

async function createPropsFile() {
  try {
    let str = "runType=FileSystem\r\n";
    str += `resultsFilename=${resFilename}\r\n`;
    for (let idx = 0; idx < tests.length; idx++) {
      let test = path.replace(/\\/g, "\\\\");
      str += `Test${idx+1}=${test}\r\n`;
    }
    await writeFile(propsFullPathFilename, str);
    return true;
  } catch (err) {
    console.error(err);
    core.setFailed(err);
  }
}

function runTests(app, args, dir) {
  let p = spawn(app, args, {cwd: dir});
  p.stdout.on("data", (x) => {
    //process.stdout.write(x.toString());
    x && console.log(x.toString().trim());
  });
  const errors = [];
  p.stderr.on("data", (x) => {
    let err = x.toString();
    console.error(err);
    //process.stderr.write(x.toString());
    errors.push(err.trim());
  });
  return new Promise((resolve, reject) => {
    p.on("exit", (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        let msg = errors.length > 0 ? errors.pop() : "";
        if (msg.startsWith(DEFAULT_EXIT_MSG_PREFIX))
          msg = "";
        const err = { code: code << 0, message: msg };
        reject(err);
      }
    });
    p.on("error", reject);
  });
}

async function run() {
  try {
    console.log(`${workDir}>${LAUNCHER} -paramfile ${propsFilename}`);
    const exitCode = await runTests(LAUNCHER, ["-paramfile", propsFilename], workDir);
    console.log(`Exit Code = ${exitCode}`);
    core.setOutput("exitCode", exitCode);
  } catch(error) {
    console.log("ERROR: ", JSON.stringify(error));
    core.setFailed(error.code);
  }
}

console.log("END of script reached");

