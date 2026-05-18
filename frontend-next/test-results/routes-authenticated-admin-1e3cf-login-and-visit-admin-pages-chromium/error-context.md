# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: routes.spec.ts >> authenticated admin routes >> login and visit admin pages
- Location: tests/e2e/routes.spec.ts:31:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/dashboard/
Received string:  "http://localhost:3000/auth/login"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    9 × unexpected value "http://localhost:3000/auth/login"

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e6] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e7]:
      - img [ref=e8]
    - generic [ref=e11]:
      - button "Open issues overlay" [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]: "0"
          - generic [ref=e15]: "1"
        - generic [ref=e16]: Issue
      - button "Collapse issues badge" [ref=e17]:
        - img [ref=e18]
  - generic [ref=e21]:
    - banner [ref=e22]:
      - generic [ref=e23]:
        - link "Kambeng" [ref=e25] [cursor=pointer]:
          - /url: /
          - strong [ref=e27]: Kambeng
        - generic [ref=e29]: PUBLIC
      - generic [ref=e30]:
        - link "Home" [ref=e32] [cursor=pointer]:
          - /url: /
          - button "Home" [ref=e33]:
            - generic [ref=e34]: Home
        - link "Campaigns" [ref=e36] [cursor=pointer]:
          - /url: /campaigns
          - button "Campaigns" [ref=e37]:
            - generic [ref=e38]: Campaigns
        - link "Login" [ref=e40] [cursor=pointer]:
          - /url: /auth/login
          - button "Login" [ref=e41]:
            - generic [ref=e42]: Login
        - link "Sign Up" [ref=e44] [cursor=pointer]:
          - /url: /auth/signup
          - button "Sign Up" [ref=e45]:
            - generic [ref=e46]: Sign Up
    - main [ref=e47]:
      - main [ref=e49]:
        - generic [ref=e50]:
          - generic [ref=e52]:
            - heading "Sign in to Kambeng" [level=1] [ref=e53]
            - generic [ref=e54]: Manage campaigns, reviews, and payments from one place. Use your email or wave number with your password.
            - generic [ref=e55]:
              - strong [ref=e57]: Seeded admin account
              - generic [ref=e58]: "Wave number: +2207000000"
              - generic [ref=e59]: "Password: AdminPass123!"
          - generic [ref=e63]:
            - generic [ref=e65]:
              - generic "Email or Wave number" [ref=e67]
              - textbox "+2207000000 or name@example.com" [ref=e71]: "+2207000000"
            - generic [ref=e73]:
              - generic "Password" [ref=e75]
              - generic [ref=e79]:
                - textbox "Your password" [ref=e80]: AdminPass123!
                - img "eye-invisible" [ref=e82] [cursor=pointer]:
                  - img [ref=e83]
            - button "Login" [active] [ref=e86] [cursor=pointer]:
              - generic [ref=e87]: Login
            - generic [ref=e88]:
              - link "Forgot password?" [ref=e89] [cursor=pointer]:
                - /url: /auth/forgot-password
              - link "Verify email" [ref=e90] [cursor=pointer]:
                - /url: /auth/verify-email
            - text: Admin access uses the seeded account above. The login session is stored in secure httpOnly cookies.
  - alert [ref=e91]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | const adminUsername = process.env.E2E_ADMIN_USERNAME;
  4  | const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  5  | 
  6  | test.describe("public routes", () => {
  7  |   test("home and campaigns pages load", async ({ page }) => {
  8  |     await page.goto("/");
  9  |     await expect(page.getByText("Kambeng Crowdfunding")).toBeVisible();
  10 | 
  11 |     await page.goto("/campaigns");
  12 |     await expect(page.getByText("Campaign Discovery")).toBeVisible();
  13 |   });
  14 | });
  15 | 
  16 | test.describe("auth redirects", () => {
  17 |   test("dashboard redirects to login when unauthenticated", async ({ page }) => {
  18 |     await page.goto("/dashboard");
  19 |     await expect(page).toHaveURL(/\/auth\/login/);
  20 |   });
  21 | 
  22 |   test("admin redirects to login when unauthenticated", async ({ page }) => {
  23 |     await page.goto("/admin");
  24 |     await expect(page).toHaveURL(/\/auth\/login/);
  25 |   });
  26 | });
  27 | 
  28 | test.describe("authenticated admin routes", () => {
  29 |   test.skip(!adminUsername || !adminPassword, "Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD to run authenticated smoke tests");
  30 | 
  31 |   test("login and visit admin pages", async ({ page }) => {
  32 |     await page.goto("/auth/login");
  33 | 
  34 |     await page.locator("#login-username").fill(adminUsername!);
  35 |     await page.locator("#login-password").fill(adminPassword!);
  36 |     await page.locator("form button[type='submit']").click();
  37 | 
> 38 |     await expect(page).toHaveURL(/\/dashboard/);
     |                        ^ Error: expect(page).toHaveURL(expected) failed
  39 | 
  40 |     await page.goto("/admin/campaigns");
  41 |     await expect(page.getByText("Admin Campaigns")).toBeVisible();
  42 | 
  43 |     await page.goto("/admin/users");
  44 |     await expect(page.getByText("Admin Users")).toBeVisible();
  45 | 
  46 |     await page.goto("/admin/moderation");
  47 |     await expect(page.getByText("Moderation Queue")).toBeVisible();
  48 |   });
  49 | 
  50 |   test("expired access token is refreshed and original request is retried", async ({ page, context }) => {
  51 |     await page.goto("/auth/login");
  52 | 
  53 |     await page.locator("#login-username").fill(adminUsername!);
  54 |     await page.locator("#login-password").fill(adminPassword!);
  55 |     await page.getByRole("button", { name: "Login" }).click();
  56 | 
  57 |     await expect(page).toHaveURL(/\/dashboard/);
  58 | 
  59 |     const existingCookies = await context.cookies();
  60 |     const accessCookie = existingCookies.find((cookie) => cookie.name === "kambeng_access_token");
  61 |     const refreshCookie = existingCookies.find((cookie) => cookie.name === "kambeng_refresh_token");
  62 |     expect(accessCookie).toBeTruthy();
  63 |     expect(refreshCookie).toBeTruthy();
  64 | 
  65 |     // Replace auth cookies deterministically: invalid access token + valid refresh token.
  66 |     await context.clearCookies();
  67 |     const appOrigin = new URL(page.url()).origin;
  68 |     await context.addCookies([
  69 |       {
  70 |         name: "kambeng_access_token",
  71 |         value: "expired-access-token-for-refresh-test",
  72 |         url: appOrigin,
  73 |       },
  74 |       {
  75 |         name: refreshCookie!.name,
  76 |         value: refreshCookie!.value,
  77 |         url: appOrigin,
  78 |       },
  79 |     ]);
  80 | 
  81 |     const injectedCookies = await context.cookies();
  82 |     expect(injectedCookies.some((cookie) => cookie.name === "kambeng_access_token")).toBeTruthy();
  83 |     expect(injectedCookies.some((cookie) => cookie.name === "kambeng_refresh_token")).toBeTruthy();
  84 | 
  85 |     const refreshResponses: number[] = [];
  86 |     page.on("response", (response) => {
  87 |       if (response.url().includes("/api/auth/refresh") && response.request().method() === "POST") {
  88 |         refreshResponses.push(response.status());
  89 |       }
  90 |     });
  91 | 
  92 |     await page.goto("/admin/campaigns");
  93 |     await expect.poll(() => refreshResponses.length, { timeout: 10000 }).toBeGreaterThan(0);
  94 |     expect(refreshResponses).toContain(200);
  95 |     await expect(page).toHaveURL(/\/admin\/campaigns/);
  96 |     await expect(page.getByText("Admin Campaigns")).toBeVisible();
  97 |   });
  98 | });
  99 | 
```