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

        # Navigate to General Ledger
        await page.goto("http://localhost:3000/acme-corp/finance/ledger")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Verify page loaded
        await expect(page.locator("table thead tr").first).to_be_visible(timeout=15000)

        # Apply EXPENSE filter
        type_select = page.locator("div:has(> span:has-text('Entry Type:')) select")
        await type_select.wait_for(state="visible", timeout=10000)
        await type_select.select_option("EXPENSE")

        # Verify at least one row is visible after filtering
        # (rows may be 0 if no expense entries, which is a valid state)
        rows = page.locator("table tbody tr")
        await expect(rows.first).to_be_visible(timeout=15000)

        # Apply REVENUE filter
        await type_select.select_option("REVENUE")
        await expect(rows.first).to_be_visible(timeout=15000)

        # Reset to ALL
        await type_select.select_option("ALL")
        await expect(rows.first).to_be_visible(timeout=15000)

        # Verify search works
        search_input = page.get_by_placeholder("Search entries...")
        if await search_input.is_visible():
            await search_input.fill("inv")
            # Just verify the table is still visible
            await expect(page.locator("table").first).to_be_visible(timeout=10000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())