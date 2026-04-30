#!/bin/bash
# Authentication Endpoints Test Script

BASE_URL="http://localhost:5001/api/auth"

echo "================================"
echo "POS Myanmar Authentication Tests"
echo "================================"

# Test 1: Owner Login
echo ""
echo "TEST 1: Owner Login"
echo "-------------------"
RESPONSE=$(curl -s -X POST $BASE_URL/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@pos.com","password":"owner123"}')
echo "$RESPONSE" | python3 -m json.tool
TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Test 2: Cashier Login
echo ""
echo "TEST 2: Cashier Login"
echo "-------------------"
curl -s -X POST $BASE_URL/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cashier@pos.com","password":"cashier123"}' | python3 -m json.tool

# Test 3: Invalid Login
echo ""
echo "TEST 3: Invalid Login (Should fail)"
echo "-------------------"
curl -s -X POST $BASE_URL/login \
  -H "Content-Type: application/json" \
  -d '{"email":"wrong@pos.com","password":"wrong"}' | python3 -m json.tool

# Test 4: Register New User (with owner token)
echo ""
echo "TEST 4: Register New User (Owner Permission)"
echo "-------------------"
curl -s -X POST $BASE_URL/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"email":"newuser@pos.com","password":"test123","full_name":"Test User","role":"cashier"}' | python3 -m json.tool

# Test 5: Try to register without token (should fail)
echo ""
echo "TEST 5: Register Without Token (Should fail)"
echo "-------------------"
curl -s -X POST $BASE_URL/register \
  -H "Content-Type: application/json" \
  -d '{"email":"another@pos.com","password":"test123","full_name":"Another User","role":"cashier"}' | python3 -m json.tool

echo ""
echo "================================"
echo "All Tests Complete!"
echo "================================"
