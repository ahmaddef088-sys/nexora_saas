import requests

def test_post_api_auth_callback_credentials_login_success():
    base_url = "http://localhost:3000"
    session = requests.Session()
    timeout = 30

    # Step 1: Get CSRF token from /api/auth/csrf
    csrf_url = f"{base_url}/api/auth/csrf"
    try:
        csrf_resp = session.get(csrf_url, timeout=timeout)
        csrf_resp.raise_for_status()
        csrf_token = csrf_resp.json().get("csrfToken")
        assert csrf_token is not None and isinstance(csrf_token, str), "CSRF token missing or invalid"
    except Exception as e:
        assert False, f"Failed to fetch CSRF token: {e}"

    # Prepare login payload with valid credentials and csrfToken
    login_url = f"{base_url}/api/auth/callback/credentials"
    # Using demo credentials as per PRD for Acme Owner (example)
    payload = {
        "csrfToken": csrf_token,
        "email": "acme.owner@example.com",
        "password": "AcmeOwnerDemoPassword123"
    }
    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }

    try:
        # Use data=payload to send as form-urlencoded
        response = session.post(login_url, data=payload, headers=headers, timeout=timeout, allow_redirects=False)
        # According to NextAuth v5, successful login redirects or returns JSON with user session info
        # We accept 200 or 302 status as success depending on implementation
        assert response.status_code in (200, 302), f"Unexpected status code: {response.status_code}"

        # If 302 redirect, location header likely contains callback url to workspace
        if response.status_code == 302:
            location = response.headers.get("Location", "")
            assert location and isinstance(location, str), "Redirect location header missing or empty"
        else:
            # If 200, expect JSON payload with user session info
            json_data = response.json()
            # Validate user data fields presence and correctness
            user = json_data.get("user")
            session_token = json_data.get("session")
            assert user is not None, "User data missing in response"
            assert isinstance(user, dict), "User data is not a dictionary"
            # Minimal assertions for user fields (email, name)
            assert "email" in user and user["email"].lower() == "acme.owner@example.com", "User email mismatch"
            assert "name" in user and isinstance(user["name"], str) and user["name"], "User name missing or empty"
            # Session token expected (may vary)
            assert session_token is not None, "Session token missing"

    except Exception as e:
        assert False, f"POST login request failed or invalid response: {e}"

test_post_api_auth_callback_credentials_login_success()
