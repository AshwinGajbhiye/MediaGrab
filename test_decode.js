const fs = require('fs');

const data = fs.readFileSync('snap_debug.txt', 'utf8');

// The obfuscated JS ends with eval(function(h,u,n,t,e,r){...}("..."))
// We want to replace "eval(" with "console.log(" so it prints the decoded string instead of executing it.

// Find the last index of "eval("
const evalIndex = data.lastIndexOf('eval(');
if (evalIndex !== -1) {
  const modified = data.substring(0, evalIndex) + 'console.log(' + data.substring(evalIndex + 5);
  
  // Write to a temporary file and run it
  fs.writeFileSync('temp_runner.js', modified);
  console.log('Created temp_runner.js');
} else {
  console.log('eval( not found');
}
