DO $$ 
BEGIN
    -- Create enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CustomerStatus') THEN
        CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'VIP');
    END IF;
    
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Customer' AND column_name = 'status') THEN
        ALTER TABLE "Customer" ADD COLUMN status "CustomerStatus" DEFAULT 'ACTIVE';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Customer' AND column_name = 'rating') THEN
        ALTER TABLE "Customer" ADD COLUMN rating INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Customer' AND column_name = 'creditLimit') THEN
        ALTER TABLE "Customer" ADD COLUMN "creditLimit" DECIMAL(12,2) DEFAULT 0;
    END IF;
END
$$;

-- Create index
CREATE INDEX IF NOT EXISTS "Customer_status_idx" ON "Customer"(status);