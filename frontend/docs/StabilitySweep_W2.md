# Stability Sweep W2 — Auth Refresh Hang Fix

**Date:** 2026-01-06  
**Objective:** Eliminate the refresh/login "hang" where `/today` gets stuck spinning forever.

---

## Problem Statement

The app would get stuck in an infinite loading spinner when:
1. Multiple tabs were open with the same logged-in user
2. Refreshing via URL bar (Enter key)
3. Profile fetch failed or timed out

### Root Causes Identified

1. **`profile === null` blocked routing forever**
   - `null` could mean "not loaded yet", "not found", OR "fetch failed/timed out"
   - Routing waited forever in the last two cases

2. **Duplicate profile fetch behaviour created bad state**
   - Multiple auth events close together (common across tabs) could trigger overlapping profile loads
   - A second call could previously lead to `profile` remaining `null` and routing never resolving

3. **No timeout on `getSession()` or `fetchProfile()`**
   - If either hung, `loading` could remain `true` forever (infinite spinner)

---

## Fixes Implemented

### ✅ ProfileFetchSingleFlight_v1
**Location:** `fetchProfile()` function

Reuse an in-flight promise instead of starting duplicate profile fetches:
```ts
if (profileFetchPromise.current) {
  console.log('[Auth] ProfileFetchSingleFlight_v1: Awaiting existing fetch');
  return profileFetchPromise.current;
}
