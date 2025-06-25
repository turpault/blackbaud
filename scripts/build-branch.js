#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get current branch name
function getCurrentBranch() {
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    return branch;
  } catch (error) {
    console.error('Error getting current branch:', error.message);
    process.exit(1);
  }
}

// Clean and create build directory
function prepareBuildDirectory(buildPath) {
  if (fs.existsSync(buildPath)) {
    console.log(`🧹 Cleaning existing build directory: ${buildPath}`);
    fs.rmSync(buildPath, { recursive: true, force: true });
  }
  fs.mkdirSync(buildPath, { recursive: true });
}

// Run the build command
function runBuild(buildPath, enableSourceMaps = false) {
  const env = { ...process.env };

  if (enableSourceMaps) {
    env.GENERATE_SOURCEMAP = 'true';
    console.log('📝 Source maps enabled for branch build');
  }

  try {
    console.log(`🚀 Building to: ${buildPath}`);
    execSync('react-scripts build', {
      stdio: 'inherit',
      env,
      cwd: process.cwd()
    });

    // Move build output to branch-specific directory
    const defaultBuildPath = path.join(process.cwd(), 'build');
    if (fs.existsSync(defaultBuildPath)) {
      fs.renameSync(defaultBuildPath, buildPath);
      console.log(`✅ Build completed successfully in: ${buildPath}`);
    }
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Main execution
function main() {
  const currentBranch = getCurrentBranch();
  console.log(`🌿 Current branch: ${currentBranch}`);

  let buildPath;
  let enableSourceMaps = false;

  if (currentBranch === 'main') {
    buildPath = path.join(process.cwd(), 'build');
    console.log('📦 Building to default build directory (main branch)');
  } else {
    // Sanitize branch name for filesystem compatibility
    const sanitizedBranch = currentBranch.replace(/[^a-zA-Z0-9-_]/g, '-');
    buildPath = path.join(process.cwd(), `build-${sanitizedBranch}`);
    enableSourceMaps = true;
    console.log(`🌿 Building to branch-specific directory: build-${sanitizedBranch}`);
  }

  prepareBuildDirectory(buildPath);
  runBuild(buildPath, enableSourceMaps);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { getCurrentBranch, prepareBuildDirectory, runBuild }; 