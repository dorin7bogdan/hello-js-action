const github = require('@actions/github');
const { spawn } = require('node:child_process');

async function runCmd(app, args, dir) {
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

const token = "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";
const url = `https://${token}@github.houston.softwaregrp.net/uft/qtp.addins.dotnet.git`;
//runCmd("git", ["clone", url], ".");
console.log(process.cwd());
process.chdir("qtp.addins.dotnet");
runCmd("git", ["checkout", "master"], ".");
runCmd("git", ["pull", url], ".");
console.log(process.cwd());

//@actions/checkout -> not working