import { spawn } from 'child_process';

const jest = spawn('node', [
  '--experimental-vm-modules',
  'node_modules/jest/bin/jest.js',
  'tests/config/configValidator.test.js'
], {
  stdio: 'inherit',
  shell: true
});

jest.on('close', (code) => {
  process.exit(code);
});
