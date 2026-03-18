#!/usr/bin/env node

const https = require('https');

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_NAME = 'expresswash-ke'; // or the actual project name

if (!VERCEL_TOKEN) {
  console.error('❌ ERROR: VERCEL_TOKEN environment variable not set');
  process.exit(1);
}

// First, get the list of projects to find the correct project ID
function getProjects() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.vercel.com',
      port: 443,
      path: '/v9/projects',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Failed to get projects: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Set environment variable
function setEnvVar(projectId, key, value) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      key: key,
      value: value,
      type: 'plain',
      target: ['production', 'preview', 'development']
    });

    const options = {
      hostname: 'api.vercel.com',
      port: 443,
      path: `/v10/projects/${projectId}/env`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Failed to set ${key}: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    console.log('🔍 Getting Vercel projects...');
    const projectsData = await getProjects();

    console.log(`Found ${projectsData.projects.length} projects`);
    projectsData.projects.forEach(p => {
      console.log(`  - ${p.name} (${p.id})`);
    });

    // Find the Expresswash project
    const project = projectsData.projects.find(p =>
      p.name.toLowerCase().includes('expresswash') ||
      p.name.toLowerCase().includes('express-wash')
    );

    if (!project) {
      console.error('❌ Could not find Expresswash project');
      console.error('Available projects:', projectsData.projects.map(p => p.name).join(', '));
      process.exit(1);
    }

    console.log(`\n✅ Found project: ${project.name} (${project.id})`);

    // Read credentials from environment variables (never hardcode)
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('❌ SUPABASE_URL and SUPABASE_ANON_KEY env vars required');
      process.exit(1);
    }

    // Set environment variables
    console.log('\n📝 Setting VITE_SUPABASE_URL...');
    await setEnvVar(project.id, 'VITE_SUPABASE_URL', SUPABASE_URL);
    console.log('✅ VITE_SUPABASE_URL set successfully');

    console.log('\n📝 Setting VITE_SUPABASE_ANON_KEY...');
    await setEnvVar(project.id, 'VITE_SUPABASE_ANON_KEY', SUPABASE_ANON_KEY);
    console.log('✅ VITE_SUPABASE_ANON_KEY set successfully');

    console.log('\n🎉 All environment variables set successfully!');
    console.log('👉 Now go to Vercel dashboard and redeploy your project');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
