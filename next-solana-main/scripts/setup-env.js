#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve)
  })
}

async function setupEnvironment() {
  console.log('🔧 Modern Solana DEX - Environment Setup\n')

  const envFile = path.join(process.cwd(), '.env.local')
  let existingEnv = ''
  
  if (fs.existsSync(envFile)) {
    existingEnv = fs.readFileSync(envFile, 'utf8')
    console.log('📝 Found existing .env.local file\n')
  }

  console.log('Choose your environment setup:')
  console.log('1. Development (Mock data)')
  console.log('2. Staging (Real services, devnet)')
  console.log('3. Production (Real services, mainnet)')
  console.log('4. Custom configuration')

  const choice = await prompt('\nEnter your choice (1-4): ')

  let config = {}

  switch (choice) {
    case '1':
      config = await setupDevelopment()
      break
    case '2':
      config = await setupStaging()
      break
    case '3':
      config = await setupProduction()
      break
    case '4':
      config = await setupCustom()
      break
    default:
      console.log('❌ Invalid choice. Exiting.')
      process.exit(1)
  }

  // Generate .env.local content
  const envContent = generateEnvContent(config)
  
  console.log('\n📄 Generated .env.local content:')
  console.log('─'.repeat(50))
  console.log(envContent)
  console.log('─'.repeat(50))

  const shouldWrite = await prompt('\nWrite this configuration to .env.local? (y/N): ')
  
  if (shouldWrite.toLowerCase() === 'y' || shouldWrite.toLowerCase() === 'yes') {
    fs.writeFileSync(envFile, envContent)
    console.log('✅ Configuration saved to .env.local')
    
    // Create .env.example if it doesn't exist
    const exampleFile = path.join(process.cwd(), '.env.local.example')
    if (!fs.existsSync(exampleFile)) {
      const exampleContent = generateEnvContent({
        ...config,
        supabaseUrl: 'your_supabase_url_here',
        supabaseAnonKey: 'your_supabase_anon_key_here',
        supabaseServiceKey: 'your_service_role_key_here',
        jupiterApiKey: 'your_jupiter_api_key_here',
      })
      fs.writeFileSync(exampleFile, exampleContent)
      console.log('📋 Created .env.local.example template')
    }
  } else {
    console.log('⏭️  Configuration not saved. You can manually copy the content above.')
  }

  console.log('\n🚀 Next steps:')
  console.log('1. Review your .env.local file')
  console.log('2. Install dependencies: npm install or yarn install')
  console.log('3. Set up your Anchor program: npm run setup')
  console.log('4. Start development: npm run dev')

  rl.close()
}

async function setupDevelopment() {
  console.log('\n🔬 Setting up Development environment...')
  
  return {
    nodeEnv: 'development',
    solanaNetwork: 'devnet',
    rpcEndpoint: 'https://api.devnet.solana.com',
    commitment: 'confirmed',
    useMockData: 'true',
    enableAnalytics: 'true',
    enableLimitOrders: 'true',
    enableDCA: 'true',
    showDebugInfo: 'true',
    logLevel: 'debug',
    jupiterApiUrl: 'https://quote-api.jup.ag/v6',
    supabaseUrl: 'mock://localhost',
    supabaseAnonKey: 'mock-anon-key',
  }
}

async function setupStaging() {
  console.log('\n🧪 Setting up Staging environment...')
  
  const supabaseUrl = await prompt('Supabase URL: ')
  const supabaseAnonKey = await prompt('Supabase Anon Key: ')
  const rpcEndpoint = await prompt('Custom RPC endpoint (or press Enter for default): ')
  
  return {
    nodeEnv: 'development',
    solanaNetwork: 'devnet',
    rpcEndpoint: rpcEndpoint || 'https://api.devnet.solana.com',
    commitment: 'confirmed',
    useMockData: 'false',
    enableAnalytics: 'true',
    enableLimitOrders: 'true',
    enableDCA: 'true',
    showDebugInfo: 'true',
    logLevel: 'info',
    jupiterApiUrl: 'https://quote-api.jup.ag/v6',
    supabaseUrl,
    supabaseAnonKey,
  }
}

async function setupProduction() {
  console.log('\n🏭 Setting up Production environment...')
  console.log('⚠️  Make sure you have real services configured!')
  
  const supabaseUrl = await prompt('Supabase URL: ')
  const supabaseAnonKey = await prompt('Supabase Anon Key: ')
  const supabaseServiceKey = await prompt('Supabase Service Role Key: ')
  const rpcEndpoint = await prompt('Mainnet RPC endpoint: ')
  const programId = await prompt('Deployed Program ID: ')
  const jupiterApiKey = await prompt('Jupiter API Key (optional): ')
  
  return {
    nodeEnv: 'production',
    solanaNetwork: 'mainnet-beta',
    rpcEndpoint,
    commitment: 'confirmed',
    programId,
    useMockData: 'false',
    enableAnalytics: 'true',
    enableLimitOrders: 'true',
    enableDCA: 'true',
    showDebugInfo: 'false',
    logLevel: 'error',
    jupiterApiUrl: 'https://quote-api.jup.ag/v6',
    jupiterApiKey,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceKey,
  }
}

async function setupCustom() {
  console.log('\n⚙️  Custom configuration...')
  
  const nodeEnv = await prompt('Node environment (development/production): ')
  const solanaNetwork = await prompt('Solana network (devnet/testnet/mainnet-beta): ')
  const useMockData = await prompt('Use mock data? (true/false): ')
  
  const config = {
    nodeEnv,
    solanaNetwork,
    useMockData,
    enableAnalytics: 'true',
    enableLimitOrders: 'true',
    enableDCA: 'true',
    showDebugInfo: nodeEnv === 'development' ? 'true' : 'false',
    logLevel: nodeEnv === 'development' ? 'debug' : 'error',
    jupiterApiUrl: 'https://quote-api.jup.ag/v6',
  }

  if (useMockData === 'false') {
    config.supabaseUrl = await prompt('Supabase URL: ')
    config.supabaseAnonKey = await prompt('Supabase Anon Key: ')
    config.rpcEndpoint = await prompt('RPC endpoint: ')
    
    if (nodeEnv === 'production') {
      config.supabaseServiceKey = await prompt('Supabase Service Role Key: ')
      config.programId = await prompt('Deployed Program ID: ')
      config.jupiterApiKey = await prompt('Jupiter API Key (optional): ')
    }
  }

  return config
}

function generateEnvContent(config) {
  const lines = [
    '# Environment Configuration',
    `NODE_ENV=${config.nodeEnv || 'development'}`,
    '',
    '# Solana Configuration',
    `NEXT_PUBLIC_SOLANA_NETWORK=${config.solanaNetwork || 'devnet'}`,
    `NEXT_PUBLIC_RPC_ENDPOINT=${config.rpcEndpoint || 'https://api.devnet.solana.com'}`,
    `NEXT_PUBLIC_SOLANA_COMMITMENT=${config.commitment || 'confirmed'}`,
    '',
  ]

  if (config.programId) {
    lines.push(`NEXT_PUBLIC_DEX_PROGRAM_ID=${config.programId}`)
    lines.push('')
  }

  lines.push(
    '# Supabase Configuration',
    `NEXT_PUBLIC_SUPABASE_URL=${config.supabaseUrl || 'your_supabase_url_here'}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${config.supabaseAnonKey || 'your_supabase_anon_key_here'}`,
  )

  if (config.supabaseServiceKey) {
    lines.push(`SUPABASE_SERVICE_ROLE_KEY=${config.supabaseServiceKey}`)
  }

  lines.push(
    '',
    '# Jupiter API Configuration',
    `NEXT_PUBLIC_JUPITER_API_URL=${config.jupiterApiUrl || 'https://quote-api.jup.ag/v6'}`,
  )

  if (config.jupiterApiKey) {
    lines.push(`JUPITER_API_KEY=${config.jupiterApiKey}`)
  }

  lines.push(
    '',
    '# Feature Flags',
    `NEXT_PUBLIC_USE_MOCK_DATA=${config.useMockData || 'true'}`,
    `NEXT_PUBLIC_ENABLE_ANALYTICS=${config.enableAnalytics || 'true'}`,
    `NEXT_PUBLIC_ENABLE_LIMIT_ORDERS=${config.enableLimitOrders || 'true'}`,
    `NEXT_PUBLIC_ENABLE_DCA=${config.enableDCA || 'true'}`,
    '',
    '# Development Settings',
    `NEXT_PUBLIC_SHOW_DEBUG_INFO=${config.showDebugInfo || 'false'}`,
    `NEXT_PUBLIC_LOG_LEVEL=${config.logLevel || 'error'}`,
    ''
  )

  return lines.join('\n')
}

// Run the setup
setupEnvironment().catch(console.error)
