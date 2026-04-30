"""
Test ML Service REST API
Comprehensive test suite for all endpoints

Run the Flask server first: python app.py
Then run this test: python test_api.py
"""

import requests
import json
import time

# API base URL
BASE_URL = 'http://localhost:5001'

def print_header(text):
    """Print formatted header"""
    print("\n" + "="*70)
    print(text)
    print("="*70)

def print_response(response):
    """Print formatted response"""
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response:")
    print(json.dumps(response.json(), indent=2))

def test_health_check():
    """Test health check endpoint"""
    print_header("TEST 1: Health Check (GET /ml/health)")

    try:
        response = requests.get(f'{BASE_URL}/ml/health')
        print_response(response)

        # Verify response
        data = response.json()
        assert response.status_code == 200, "Health check should return 200"
        assert 'status' in data, "Response should contain status"
        assert 'models' in data, "Response should contain models info"

        print("\n✅ Health check test PASSED")
        return True

    except Exception as e:
        print(f"\n❌ Health check test FAILED: {e}")
        return False


def test_forecast():
    """Test sales forecasting endpoint"""
    print_header("TEST 2: Sales Forecasting (POST /ml/forecast)")

    # Test 7-day forecast
    print("\n2a. Testing 7-day forecast...")
    try:
        payload = {'days': 7}
        response = requests.post(
            f'{BASE_URL}/ml/forecast',
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        print_response(response)

        # Verify response
        data = response.json()
        assert response.status_code == 200, "Forecast should return 200"
        assert 'forecast' in data, "Response should contain forecast"
        assert 'summary' in data, "Response should contain summary"
        assert len(data['forecast']) == 7, "Should have 7 days of forecast"

        print("\n✅ 7-day forecast test PASSED")

    except Exception as e:
        print(f"\n❌ 7-day forecast test FAILED: {e}")
        return False

    # Test 14-day forecast
    print("\n2b. Testing 14-day forecast...")
    try:
        payload = {'days': 14}
        response = requests.post(
            f'{BASE_URL}/ml/forecast',
            json=payload,
            headers={'Content-Type': 'application/json'}
        )

        data = response.json()
        assert response.status_code == 200, "Forecast should return 200"
        assert len(data['forecast']) == 14, "Should have 14 days of forecast"

        print(f"Status: {response.status_code}")
        print(f"Forecast days: {len(data['forecast'])}")
        print(f"Average daily sales: {data['summary']['average_daily_sales']:,.2f} MMK")
        print("\n✅ 14-day forecast test PASSED")

    except Exception as e:
        print(f"\n❌ 14-day forecast test FAILED: {e}")
        return False

    # Test 30-day forecast
    print("\n2c. Testing 30-day forecast...")
    try:
        payload = {'days': 30}
        response = requests.post(
            f'{BASE_URL}/ml/forecast',
            json=payload,
            headers={'Content-Type': 'application/json'}
        )

        data = response.json()
        assert response.status_code == 200, "Forecast should return 200"
        assert len(data['forecast']) == 30, "Should have 30 days of forecast"

        print(f"Status: {response.status_code}")
        print(f"Forecast days: {len(data['forecast'])}")
        print(f"Total predicted sales: {data['summary']['total_predicted_sales']:,.2f} MMK")
        print("\n✅ 30-day forecast test PASSED")

    except Exception as e:
        print(f"\n❌ 30-day forecast test FAILED: {e}")
        return False

    # Test invalid days parameter
    print("\n2d. Testing invalid days parameter (error handling)...")
    try:
        payload = {'days': 45}
        response = requests.post(
            f'{BASE_URL}/ml/forecast',
            json=payload,
            headers={'Content-Type': 'application/json'}
        )

        assert response.status_code == 400, "Invalid days should return 400"
        print(f"Status: {response.status_code} (Expected 400)")
        print(f"Error message: {response.json()['message']}")
        print("\n✅ Error handling test PASSED")

    except Exception as e:
        print(f"\n❌ Error handling test FAILED: {e}")
        return False

    return True


def test_inventory_predictions():
    """Test inventory stockout predictions endpoint"""
    print_header("TEST 3: Inventory Predictions (GET /ml/inventory/predictions)")

    # Test all products
    print("\n3a. Testing all products...")
    try:
        response = requests.get(f'{BASE_URL}/ml/inventory/predictions')
        print_response(response)

        # Verify response
        data = response.json()
        assert response.status_code == 200, "Inventory predictions should return 200"
        assert 'predictions' in data, "Response should contain predictions"
        assert len(data['predictions']) > 0, "Should have at least one prediction"

        print(f"\n✅ All products test PASSED ({data['count']} products)")

    except Exception as e:
        print(f"\n❌ All products test FAILED: {e}")
        return False

    # Test specific product
    print("\n3b. Testing specific product (product_id=1)...")
    try:
        response = requests.get(f'{BASE_URL}/ml/inventory/predictions?product_id=1')

        data = response.json()
        assert response.status_code == 200, "Should return 200"
        assert len(data['predictions']) == 1, "Should have exactly one prediction"
        assert data['predictions'][0]['product_id'] == 1, "Should be product 1"

        pred = data['predictions'][0]
        print(f"Status: {response.status_code}")
        print(f"Product: {pred['product_name']}")
        print(f"Current stock: {pred['current_stock']}")
        print(f"Days until stockout: {pred['days_until_stockout']}")
        print(f"Recommended reorder: {pred['recommended_reorder_qty']}")
        print(f"Status: {pred['status']}")
        print("\n✅ Specific product test PASSED")

    except Exception as e:
        print(f"\n❌ Specific product test FAILED: {e}")
        return False

    # Test non-existent product
    print("\n3c. Testing non-existent product (error handling)...")
    try:
        response = requests.get(f'{BASE_URL}/ml/inventory/predictions?product_id=999')

        assert response.status_code == 404, "Non-existent product should return 404"
        print(f"Status: {response.status_code} (Expected 404)")
        print(f"Error message: {response.json()['message']}")
        print("\n✅ Error handling test PASSED")

    except Exception as e:
        print(f"\n❌ Error handling test FAILED: {e}")
        return False

    return True


def test_recommendations():
    """Test product recommendations endpoint"""
    print_header("TEST 4: Product Recommendations (GET /ml/recommendations)")

    # Test product 1
    print("\n4a. Testing recommendations for product_id=1...")
    try:
        response = requests.get(f'{BASE_URL}/ml/recommendations?product_id=1')
        print_response(response)

        # Verify response
        data = response.json()
        assert response.status_code == 200, "Recommendations should return 200"
        assert 'recommendations' in data, "Response should contain recommendations"
        assert data['product_id'] == 1, "Should be for product 1"

        print(f"\n✅ Product 1 recommendations test PASSED ({data['count']} recommendations)")

    except Exception as e:
        print(f"\n❌ Product 1 recommendations test FAILED: {e}")
        return False

    # Test with limit parameter
    print("\n4b. Testing with limit=2...")
    try:
        response = requests.get(f'{BASE_URL}/ml/recommendations?product_id=2&limit=2')

        data = response.json()
        assert response.status_code == 200, "Should return 200"
        assert len(data['recommendations']) <= 2, "Should return max 2 recommendations"

        print(f"Status: {response.status_code}")
        print(f"Product: {data['product_name']}")
        print(f"Recommendations: {data['count']}")
        for rec in data['recommendations']:
            print(f"  → {rec['product_name']} (confidence: {rec['confidence']:.2%})")
        print("\n✅ Limit parameter test PASSED")

    except Exception as e:
        print(f"\n❌ Limit parameter test FAILED: {e}")
        return False

    # Test missing product_id (error handling)
    print("\n4c. Testing missing product_id (error handling)...")
    try:
        response = requests.get(f'{BASE_URL}/ml/recommendations')

        assert response.status_code == 400, "Missing product_id should return 400"
        print(f"Status: {response.status_code} (Expected 400)")
        print(f"Error message: {response.json()['message']}")
        print("\n✅ Error handling test PASSED")

    except Exception as e:
        print(f"\n❌ Error handling test FAILED: {e}")
        return False

    # Test invalid limit parameter
    print("\n4d. Testing invalid limit (error handling)...")
    try:
        response = requests.get(f'{BASE_URL}/ml/recommendations?product_id=1&limit=20')

        assert response.status_code == 400, "Invalid limit should return 400"
        print(f"Status: {response.status_code} (Expected 400)")
        print(f"Error message: {response.json()['message']}")
        print("\n✅ Error handling test PASSED")

    except Exception as e:
        print(f"\n❌ Error handling test FAILED: {e}")
        return False

    return True


def test_models_info():
    """Test models info endpoint"""
    print_header("TEST 5: Models Info (GET /ml/models/info)")

    try:
        response = requests.get(f'{BASE_URL}/ml/models/info')
        print_response(response)

        # Verify response
        data = response.json()
        assert response.status_code == 200, "Models info should return 200"
        assert 'forecast' in data, "Response should contain forecast info"
        assert 'inventory' in data, "Response should contain inventory info"
        assert 'recommendations' in data, "Response should contain recommendations info"

        print("\n✅ Models info test PASSED")
        return True

    except Exception as e:
        print(f"\n❌ Models info test FAILED: {e}")
        return False


def test_404_endpoint():
    """Test non-existent endpoint (404 handling)"""
    print_header("TEST 6: Non-existent Endpoint (404 Handling)")

    try:
        response = requests.get(f'{BASE_URL}/ml/nonexistent')

        assert response.status_code == 404, "Non-existent endpoint should return 404"
        data = response.json()
        print(f"Status: {response.status_code} (Expected 404)")
        print(f"Error message: {data['message']}")
        print("\n✅ 404 handling test PASSED")
        return True

    except Exception as e:
        print(f"\n❌ 404 handling test FAILED: {e}")
        return False


def run_all_tests():
    """Run all API tests"""
    print("\n" + "="*70)
    print("ML SERVICE REST API - COMPREHENSIVE TEST SUITE")
    print("="*70)

    print("\nChecking if server is running...")
    try:
        response = requests.get(f'{BASE_URL}/ml/health', timeout=2)
        print("✓ Server is running")
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Server is not running!")
        print("Please start the server first: python app.py")
        return

    # Run all tests
    tests = [
        ('Health Check', test_health_check),
        ('Sales Forecasting', test_forecast),
        ('Inventory Predictions', test_inventory_predictions),
        ('Product Recommendations', test_recommendations),
        ('Models Info', test_models_info),
        ('404 Handling', test_404_endpoint)
    ]

    results = []
    for test_name, test_func in tests:
        result = test_func()
        results.append((test_name, result))
        time.sleep(0.5)  # Brief pause between tests

    # Print summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name:<30} {status}")

    print("\n" + "="*70)
    print(f"TOTAL: {passed}/{total} tests passed ({passed/total*100:.0f}%)")
    print("="*70)

    if passed == total:
        print("\n🎉 ALL TESTS PASSED! API is working correctly.")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please review the output above.")


if __name__ == '__main__':
    run_all_tests()
