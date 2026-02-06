-- Clean up CustomerStatus 'VIP' -> 'ACTIVE'
-- Note: 'VIP' type doesn't exist yet in the DB enum, so we default to 'REGULAR' implicitly (or whatever the row already has).
UPDATE "Customer"
SET "status" = 'ACTIVE'
WHERE "status" = 'VIP';

-- Clean up CustomerType 'PACKAGE' -> 'REGULAR'
UPDATE "Customer"
SET "customerType" = 'REGULAR'
WHERE "customerType" = 'PACKAGE';
