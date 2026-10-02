import asyncio
import re
import time
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        pw = await async_api.async_playwright().start()
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )
        context = await browser.new_context()
        context.set_default_timeout(15000)
        page = await context.new_page()

        await page.goto("http://localhost:3000/login")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Login as Owner
        await page.get_by_role('button', name='Acme Owner admin@acme.com', exact=True).click(timeout=10000)
        await page.locator('[id="submit-login-btn"]').click(timeout=10000)
        await expect(page).to_have_url(re.compile(r"/acme-corp"), timeout=15000)

        # Open Users & Roles
        await page.goto("http://localhost:3000/acme-corp/users")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Invite member
        await page.locator('[id="add-member-btn"]').click(timeout=10000)

        email = f"invitee_{int(time.time())}@example.com"
        await page.get_by_placeholder('Jane Doe').fill("Test Invitee")
        await page.get_by_placeholder('jane@company.com').fill(email)

        role_select = page.locator("form select").first
        await role_select.wait_for(state="visible", timeout=10000)
        await role_select.select_option("ADMIN")

        await page.locator("form button[type='submit']").click(timeout=10000)

        # Find member row
        row = page.locator("table tbody tr", has_text=email)
        await expect(row).to_be_visible(timeout=15000)
        await expect(row).to_contain_text("ADMIN", timeout=15000)

        # Open quick role change
        await row.locator("button[title='Change Member Role']").click(timeout=10000)

        # Select MEMBER
        new_role_select = page.locator("div.fixed form select").first
        await new_role_select.wait_for(state="visible", timeout=10000)
        await new_role_select.select_option("MEMBER")

        # Submit update
        await page.locator("div.fixed form button[type='submit']").click(timeout=10000)

        # Verify updated role
        await expect(row).to_contain_text("MEMBER", timeout=15000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())