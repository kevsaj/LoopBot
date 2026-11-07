// Runs the Android Gradle wrapper on any OS: gradlew.bat on Windows (npm scripts use cmd.exe there),
// ./gradlew elsewhere. Usage: node scripts/gradle.mjs bundleRelease
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const android = fileURLToPath(new URL('../android', import.meta.url));
const win = process.platform === 'win32';
const r = spawnSync(win ? 'gradlew.bat' : './gradlew', process.argv.slice(2), { cwd: android, stdio: 'inherit', shell: win });
process.exit(r.status ?? 1);
