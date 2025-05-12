#!/usr/bin/env bun

import { testImapSmtp } from '../apps/server/src/lib/driver/test-imap';

console.log('=== Testing IMAP/SMTP Connection ===');
console.log('Make sure you have the following environment variables set:');
console.log('IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS, IMAP_SECURE');
console.log('SMTP_HOST, SMTP_PORT, SMTP_SECURE (optional if different from IMAP)');
console.log('');

testImapSmtp()
  .then(() => {
    console.log('\nTest completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest failed with error:', error);
    process.exit(1);
  }); 