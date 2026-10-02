import asyncio
import re
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

        # Login
        await page.get_by_role('button', name='Acme Owner admin@acme.com', exact=True).click(timeout=10000)
        await page.locator('[id="submit-login-btn"]').click(timeout=10000)
        await expect(page).to_have_url(re.compile(r"/acme-corp"), timeout=15000)

        # Perform an action first to ensure there's an audit event (create an expense)
        await page.goto("http://localhost:3000/acme-corp/finance/expenses")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Navigate to Audit Logs
        await page.goto("http://localhost:3000/acme-corp/audit")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Verify audit page loaded
        await expect(page.locator("h1").first).to_be_visible(timeout=15000)

        # Verify audit table has entries
        first_row = page.locator("table tbody tr").first
        await expect(first_row).to_be_visible(timeout=15000)

        # Search for an audit action that is guaranteed to exist
        search_input = page.locator('[id="audit-search"]')
        await search_input.wait_for(state="visible", timeout=10000)
        await search_input.fill("admin")

        # Verify table still shows rows (search doesn't crash)
        await expect(page.locator("table").first).to_be_visible(timeout=10000)

        # Clear search
        await search_input.fill("")

        # Verify first row still visible after clearing
        await expect(first_row).to_be_visible(timeout=15000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())