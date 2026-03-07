import { execSync } from 'child_process';

console.log('Running pnpm install...');
try {
  execSync('pnpm install', { stdio: 'inherit', cwd: '/vercel/share/v0-project' });
  console.log('Dependencies installed successfully!');
} catch (error) {
  console.error('Error installing dependencies:', error.message);
  process.exit(1);
}
