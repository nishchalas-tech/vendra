"""
Authentication, Session Persistence & Clean Workspace Tests (backend/tests/test_auth.py)
Covers scenarios A through K:
- Public register/signup & login without Authorization header
- Duplicate email registration error ("An account with this email already exists.")
- Invalid credentials login error ("Incorrect email or password.")
- Authenticated requests with Authorization: Bearer <token>
- Protected requests without token returning HTTP 401 ("Please sign in to continue.")
- Logout clearing session token
- Session persistence via GET /api/auth/me (and /auth/me)
- Clean new user dashboard (0 missions, 0 budget, no demo missions or fake founders)
- Isolated Demo Mode only appearing when explicitly triggered
"""
import os
import tempfile
import unittest
from app.main import dispatch_request, initialize_backend


class TestAuthAndProfile(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        os.environ["VENDRA_SQLITE_PATH"] = self.tmp.name
        initialize_backend()

    def tearDown(self) -> None:
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)

    def test_signup_login_logout_and_protected_routes(self) -> None:
        # G. Unauthenticated request to protected routes must return 401
        code, err_body = dispatch_request("GET", "/api/missions", {})
        self.assertEqual(code, 401)
        self.assertEqual(err_body["error"], "Please sign in to continue.")

        me_unauth_code, me_unauth_body = dispatch_request("GET", "/api/auth/me", {})
        self.assertEqual(me_unauth_code, 401)
        self.assertEqual(me_unauth_body["error"], "Please sign in to continue.")

        # B. Register a new user via POST /api/auth/register without Authorization header
        code, data = dispatch_request(
            "POST",
            "/api/auth/register",
            {},
            {
                "full_name": "Nishchal S",
                "email": "nishchal@vendra.in",
                "password": "SecurePassword123",
                "company_name": "Vendra Manufacturing Labs",
                "phone": "+91 98450 11223",
                "city": "Bengaluru",
                "state": "Karnataka",
            },
        )
        self.assertEqual(code, 201)
        self.assertIn("token", data)
        self.assertNotIn("password_hash", data["user"])
        self.assertFalse(data["user"]["is_demo_user"])
        self.assertEqual(data["user"]["company_name"], "Vendra Manufacturing Labs")
        token = data["token"]

        # C. Register same email again -> proper duplicate-email error
        dup_code, dup_data = dispatch_request(
            "POST",
            "/api/auth/register",
            {},
            {
                "full_name": "Duplicate User",
                "email": "nishchal@vendra.in",
                "password": "AnotherPassword123",
            },
        )
        self.assertEqual(dup_code, 400)
        self.assertEqual(dup_data["error"], "An account with this email already exists.")

        # E. Login with invalid credentials -> proper authentication error
        bad_code, bad_data = dispatch_request(
            "POST",
            "/api/auth/login",
            {},
            {"email": "nishchal@vendra.in", "password": "WrongPassword"},
        )
        self.assertEqual(bad_code, 401)
        self.assertEqual(bad_data["error"], "Incorrect email or password.")

        # D. Login with valid credentials -> login succeeds
        login_code, login_data = dispatch_request(
            "POST",
            "/api/auth/login",
            {},
            {"email": "nishchal@vendra.in", "password": "SecurePassword123"},
        )
        self.assertEqual(login_code, 200)
        self.assertIn("token", login_data)
        self.assertEqual(login_data["user"]["email"], "nishchal@vendra.in")

        # F & I. Authenticated requests & session persistence via GET /api/auth/me
        auth_headers = {"Authorization": f"Bearer {token}"}
        me_ok_code, me_ok_data = dispatch_request("GET", "/api/auth/me", auth_headers)
        self.assertEqual(me_ok_code, 200)
        self.assertEqual(me_ok_data["user"]["email"], "nishchal@vendra.in")

        # J. New user's dashboard has 0 missions, no demo data, no fake budget
        m_code, m_data = dispatch_request("GET", "/api/missions", auth_headers)
        self.assertEqual(m_code, 200)
        self.assertEqual(m_data["missions"], [])

        p_code, p_data = dispatch_request("GET", "/api/profile", auth_headers)
        self.assertEqual(p_code, 200)
        self.assertEqual(p_data["profile"]["city"], "Bengaluru")
        self.assertEqual(p_data["profile"]["available_capital"], 0.0)

        u_code, u_data = dispatch_request(
            "PUT",
            "/api/profile",
            auth_headers,
            {
                "business_experience": "First-time D2C founder",
                "available_capital": 500000,
                "preferred_product_categories": "Sustainable Consumer Goods",
                "preferred_sourcing_location": "Peenya, Bengaluru",
            },
        )
        self.assertEqual(u_code, 200)
        self.assertEqual(u_data["profile"]["available_capital"], 500000.0)

        # H. Logout invalidates session token
        out_code, _ = dispatch_request("POST", "/api/auth/logout", auth_headers)
        self.assertEqual(out_code, 200)
        me_code, _ = dispatch_request("GET", "/api/auth/me", auth_headers)
        self.assertEqual(me_code, 401)

        # K. Demo Mode only loads when explicitly called and stays isolated from normal user
        demo_code, demo_data = dispatch_request("POST", "/api/demo/load", {})
        self.assertEqual(demo_code, 200)
        self.assertTrue(demo_data["is_demo"])
        self.assertTrue(demo_data["user"]["is_demo_user"])

        # Re-login as normal user and verify normal user still has 0 missions
        relogin_code, relogin_data = dispatch_request(
            "POST",
            "/api/auth/login",
            {},
            {"email": "nishchal@vendra.in", "password": "SecurePassword123"},
        )
        self.assertEqual(relogin_code, 200)
        real_headers = {"Authorization": f"Bearer {relogin_data['token']}"}
        real_m_code, real_m_data = dispatch_request("GET", "/api/missions", real_headers)
        self.assertEqual(real_m_code, 200)
        self.assertEqual(real_m_data["missions"], [])
