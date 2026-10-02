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

        # Login
        await page.get_by_role('button', name='Acme Owner admin@acme.com', exact=True).click(timeout=10000)
        await page.locator('[id="submit-login-btn"]').click(timeout=10000)
        await expect(page).to_have_url(re.compile(r"/acme-corp"), timeout=15000)

        # Open Expenses page
        await page.goto("http://localhost:3000/acme-corp/finance/expenses")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Open Log Expense modal
        await page.locator('[id="log-expense-btn"]').click(timeout=10000)

        vendor_name = f"Test Vendor {int(time.time())}"

        # Category
        category_select = page.locator("form select").first
        await category_select.wait_for(state="visible", timeout=10000)
        await category_select.select_option(value="UTILITIES")

        # Payee
        await page.get_by_placeholder('e.g. AWS, Office Depot, Landlord Inc.').fill(vendor_name)

        # Amount
        amount_input = page.locator("form input[type='number']").first
        await amount_input.fill("45.67")

        # Notes
        notes_input = page.get_by_placeholder('Describe business purpose or additional details...')
        if await notes_input.is_visible():
            await notes_input.fill("Test expense note")

        # Submit
        await page.locator("form button[type='submit']").click(timeout=10000)

        # Verify expense appears in table
        row = page.locator("table tbody tr", has_text=vendor_name)
        await expect(row).to_be_visible(timeout=15000)
        await expect(row).to_contain_text("45.67", timeout=15000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())