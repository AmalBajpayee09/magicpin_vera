// Kept as a compatibility launcher. This suite never sends context to external APIs.
import {spawnSync} from 'node:child_process';
process.exitCode=spawnSync(process.execPath,['--import','tsx','--test','tests/adversarial.test.ts'],{stdio:'inherit'}).status ?? 1;
