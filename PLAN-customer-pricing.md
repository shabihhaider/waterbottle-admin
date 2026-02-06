# Plan: Customer-Specific Pricing

## Overview
Enable administrators to set custom prices for specific products per customer. When creating an order for a customer, the system should prioritize this custom price over the standard inventory price.

## Success Criteria
- [ ] Database supports many-to-many relationship between Customer and Product with a custom price.
- [ ] "Add/Edit Customer" form allows managing custom prices (add row, select product, set price, remove row).
- [ ] "Create Order" form automatically populates the correct price based on priority:
    1.  Customer-specific price (if exists).
    2.  Standard inventory `salePrice` (fallback).
- [ ] Order UI visually indicates when a custom price is being used.

## Tech Stack
- **Backend**: Node.js, Prisma, PostgreSQL
- **Frontend**: Next.js (App Router), React, Tailwind CSS
- **State/Form**: React Hook Form, Zod

## File Structure
- `backend/prisma/schema.prisma` (Database changes)
- `frontend/src/app/(app)/customers/_components/CustomerForm.tsx` (UI updates)
- `frontend/src/app/(app)/orders/_components/OrderForm.tsx` (Logic updates)
- `backend/src/controllers/customerController.ts` (API updates)
- `backend/src/types/index.ts` (Type definitions)

## Phase 1: Database & Backend
- [ ] **Task 1.1**: Update Prisma schema
    - Create `CustomerPrice` model:
        - `id` (PK)
        - `customerId` (FK to Customer)
        - `productId` (FK to Product)
        - `price` (Decimal)
        - Unique constraint on `[customerId, productId]`
    - Add relation fields to `Customer` and `Product` models.
    - Run `prisma migrate dev`.
- [ ] **Task 1.2**: Update Customer API
    - Update `createCustomer` and `updateCustomer` in `customerController.ts` to handle `customerPrices` (create/update/delete).
    - Update `getCustomers` to include `customerPrices` in the response (needed for Order page).

## Phase 2: Frontend Customer Management
- [ ] **Task 2.1**: Update Customer Form UI (`CustomerFormModal` or similar)
    - Add "Custom Pricing" section.
    - Use dynamic field array for adding multiple price entries.
    - Dropdown: Select Product (filter out already selected ones).
    - Input: Price (number).
- [ ] **Task 2.2**: Integrate with Backend
    - Ensure form submission sends the correct `customerPrices` structure.
    - Handle pre-filling data when editing a customer.

## Phase 3: Order Management Logic
- [ ] **Task 3.1**: Update Order Form Logic
    - When a Customer is selected, fetch/access their specific prices.
    - When a Product is selected in the order items list:
        - Check if `currentCustomer` has a custom price for this `productId`.
        - If yes, use it. If no, use `product.salePrice`.
    - Update `unitPrice` field automatically.
- [ ] **Task 3.2**: UI Indicators
    - Add a visual cue (e.g., small badge or icon) next to the price input if it was sourced from "Customer Price".

## Phase 4: Verification
- [ ] **Test**: Add a custom price for Customer A / Product X.
- [ ] **Test**: Create order for Customer A -> Select Product X -> Verify custom price.
- [ ] **Test**: Create order for Customer B -> Select Product X -> Verify standard price.
- [ ] **Test**: Update custom price and verify changes.
- [ ] **Test**: Delete custom price and verify fallback.
