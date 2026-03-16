/**
 * Global setup/teardown for RLS tests.
 * Seeds test data once before all test files, cleans up once after.
 */
import { seedTestData, cleanupTestData } from './helpers';

export function setup(): void {
  cleanupTestData();
  seedTestData();
}

export function teardown(): void {
  cleanupTestData();
}
