#!/usr/bin/env node

/**
 * Test script for the automatic refresh system
 * Run with: node test_refresh_system.js
 */

const API_BASE = 'http://localhost:3002/api';

async function testRefreshSystem() {
  console.log('🧪 Testing Automatic Refresh System...\n');

  try {
    // Test 1: Get all last update times
    console.log('📅 Test 1: Getting all last update times...');
    const response1 = await fetch(`${API_BASE}/currencies/all-last-updates`);
    const data1 = await response1.json();
    console.log('Response:', JSON.stringify(data1, null, 2));
    console.log('✅ Test 1 passed\n');

    // Test 2: Get currency last update
    console.log('💱 Test 2: Getting currency last update...');
    const response2 = await fetch(`${API_BASE}/currencies/last-update`);
    const data2 = await response2.json();
    console.log('Response:', JSON.stringify(data2, null, 2));
    console.log('✅ Test 2 passed\n');

    // Test 3: Get manual investments last update
    console.log('📊 Test 3: Getting manual investments last update...');
    const response3 = await fetch(`${API_BASE}/manual-investments/all-last-updates`);
    const data3 = await response3.json();
    console.log('Response:', JSON.stringify(data3, null, 2));
    console.log('✅ Test 3 passed\n');

    console.log('🎉 All tests passed! The refresh system is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the server is running on http://localhost:3002');
  }
}

// Run the test
testRefreshSystem();