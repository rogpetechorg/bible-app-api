import { config } from 'dotenv';

// Load test environment variables before running tests
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
