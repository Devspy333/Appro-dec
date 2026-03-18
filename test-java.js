import { execSync } from 'child_process';
try {
  console.log(execSync('java -version').toString());
} catch (e) {
  console.error(e);
}
