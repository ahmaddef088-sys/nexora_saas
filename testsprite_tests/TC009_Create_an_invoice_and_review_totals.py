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

        # Open Invoices page
        await page.goto("http://localhost:3000/acme-corp/finance/invoices")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Open Create Invoice Modal
        await page.locator('[id="create-invoice-btn"]').click(timeout=10000)

        # Select Customer
        customer_select = page.locator("form select").first
        await customer_select.wait_for(state="visible", timeout=10000)
        await customer_select.select_option(index=1)

        # Explicitly set 10% Tax Rate
        tax_input = page.locator("form").locator("label:has-text('Tax Rate')").locator("xpath=following-sibling::input | ..//input").first
        await tax_input.fill("10")

        # Wait for tax preview in modal
        await expect(page.locator("form").locator("text=Tax (10%)")).to_be_visible(timeout=5000)

        # Submit create draft invoice
        await page.get_by_role('button', name='Create Draft Invoice', exact=True).click(timeout=10000)

        # Open newly created invoice detail from first table row
        first_row = page.locator("table tbody tr").first
        await expect(first_row).to_be_visible(timeout=15000)
        await first_row.locator("a[title='View Invoice Details']").click(timeout=10000)

        # Verify Tax is displayed on the invoice detail page (e.g. Tax (10.00%))
        await expect(page.locator("text=/Tax \\(10/").first).to_be_visible(timeout=15000)

        # Verify line items are displayed
        await expect(page.locator("table tbody tr").first).to_be_visible(timeout=15000)

        # Verify Balance Due / Outstanding Balance is displayed
        await expect(page.locator("text=/Outstanding Balance|Balance Due/").first).to_be_visible(timeout=15000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())