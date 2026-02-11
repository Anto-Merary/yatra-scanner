# Backend Architecture Recommendation

## Current Setup vs Edge Functions

### ✅ **Keep in Database RPC (Current Approach)**

**Ticket Verification** - `verify_and_mark_ticket`
- ✅ **Why**: Atomic operations, faster (no network hop), secure with RLS
- ✅ **Performance**: Executes directly in database, minimal latency
- ✅ **Security**: Uses `SECURITY DEFINER` with proper RLS policies
- ✅ **Complexity**: Simpler, no additional deployment needed

**Search Operations** - Direct client queries
- ✅ **Why**: Read-only, properly secured with RLS
- ✅ **Performance**: Fast, direct database access
- ✅ **Security**: RLS policies control access

---

### 🔄 **Move to Edge Functions (Recommended)**

**Admin Override Operations** - `admin_force_allow`, `admin_reset_entry`
- ⚠️ **Why Move**: 
  - More secure (service role key never exposed to client)
  - Better audit trail (server-side logging)
  - Can add rate limiting
  - Can validate admin PIN server-side
- ⚠️ **Current Risk**: Admin PIN is client-side validated only
- ✅ **Benefit**: Service role key stays on server

---

## Recommended Architecture

### Option 1: **Hybrid (Recommended for Production)**

```
┌─────────────────────────────────────────┐
│         Frontend (React)                │
│  - Search (direct queries)              │
│  - Display results                      │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌──────────────┐  ┌──────────────────┐
│ Database RPC │  │ Edge Functions   │
│              │  │                  │
│ - verify_*   │  │ - admin_force_*  │
│ - search_*   │  │ - admin_reset_*  │
│              │  │ - email sending  │
└──────────────┘  └──────────────────┘
```

**Pros:**
- ✅ Best security for sensitive operations
- ✅ Fast verification (database RPC)
- ✅ Better audit trail
- ✅ Can add rate limiting to admin functions

**Cons:**
- ⚠️ Slightly more complex (need to deploy edge functions)
- ⚠️ Small latency increase for admin operations

---

### Option 2: **Keep Current (Database RPC Only)**

**Pros:**
- ✅ Simpler (no edge function deployment)
- ✅ Faster (no network hop)
- ✅ Already working

**Cons:**
- ⚠️ Admin PIN validation is client-side only
- ⚠️ Service role key not used (functions use SECURITY DEFINER)
- ⚠️ Harder to add rate limiting
- ⚠️ Less control over admin operations

---

## Security Comparison

### Current (Database RPC):
```javascript
// Client-side
const pin = getAdminPin(); // From .env, exposed in bundle
if (pinInput === pin) {
  // Call RPC function
  supabase.rpc('admin_force_allow', {...});
}
```

**Issues:**
- Admin PIN is in frontend bundle (can be extracted)
- Anyone with PIN can call RPC directly
- No server-side validation

### Edge Function Approach:
```javascript
// Client-side
supabase.functions.invoke('admin-override', {
  body: { ticketId, reason, adminName, pin }
});

// Edge Function (server-side)
const { pin } = await req.json();
if (pin !== Deno.env.get('ADMIN_PIN')) {
  return new Response('Unauthorized', { status: 401 });
}
// Use service_role_key for database operations
```

**Benefits:**
- ✅ PIN never exposed to client
- ✅ Server-side validation
- ✅ Service role key stays on server
- ✅ Can add rate limiting, IP restrictions, etc.

---

## Recommendation for Your Use Case

### **For Production: Use Edge Functions for Admin Override**

**Reasons:**
1. **Security**: Admin operations are sensitive - should be server-side
2. **Audit**: Better logging and monitoring
3. **Control**: Can add rate limiting, IP whitelisting
4. **Best Practice**: Sensitive operations shouldn't be client-callable

### **Keep Database RPC for:**
1. **Ticket Verification**: Fast, atomic, already secure
2. **Search**: Read-only, properly secured with RLS

---

## Implementation Plan

### Step 1: Create Edge Function for Admin Override

Create: `supabase/functions/admin-override/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { ticketId, action, reason, adminName, pin } = await req.json()
  
  // Validate PIN server-side
  const adminPin = Deno.env.get('ADMIN_PIN')
  if (pin !== adminPin) {
    return new Response(JSON.stringify({ success: false, message: 'Invalid PIN' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 401
    })
  }
  
  // Use service role key (bypasses RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  // Call database function with service role
  const { data, error } = await supabase.rpc(
    action === 'allow' ? 'admin_force_allow' : 'admin_reset_entry',
    {
      p_ticket_id: ticketId,
      p_reason: reason,
      p_admin_identifier: adminName
    }
  )
  
  return new Response(JSON.stringify(data || { success: false, message: error?.message }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### Step 2: Update Frontend

```javascript
// src/lib/adminOverride.js
export async function adminForceAllow(ticketId, day, reason, adminIdentifier) {
  const pin = getAdminPin(); // Still needed for UI, but validated server-side
  
  const { data, error } = await supabase.functions.invoke('admin-override', {
    body: {
      ticketId,
      action: 'allow',
      reason,
      adminName: adminIdentifier,
      pin
    }
  })
  
  return data;
}
```

---

## Final Recommendation

**For your ticket scanner:**

1. **Keep Database RPC for verification** ✅
   - Fast, atomic, secure
   - Already working well

2. **Move Admin Override to Edge Functions** 🔄
   - Better security
   - PIN validation server-side
   - Better audit trail
   - Production-ready

3. **Keep Search as direct queries** ✅
   - Fast, read-only
   - Properly secured with RLS

**Priority:**
- **Low Priority**: Current setup works fine for now
- **Before Production**: Move admin override to Edge Functions
- **Nice to Have**: Add rate limiting, IP restrictions

---

## Quick Decision Guide

**Use Database RPC if:**
- ✅ Operation needs to be atomic (like verification)
- ✅ Performance is critical
- ✅ Operation is read-only or properly secured

**Use Edge Functions if:**
- ✅ Operation is sensitive (admin actions)
- ✅ Need server-side validation
- ✅ Need rate limiting or IP restrictions
- ✅ Need to use service role key securely
