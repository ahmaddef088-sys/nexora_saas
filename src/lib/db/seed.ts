import { PrismaClient, Role, MembershipStatus, Prisma, OrderStatus } from '@prisma/client';
import { prisma } from './prisma';
import { hashPassword } from '@/lib/auth/password';

/**
 * Safe, idempotent seed function for Nexora Business Suite.
 *
 * Seeds initial demo tenants, users, memberships, product categories,
 * products, inventory, customers, and sample orders.
 * Uses `SEED_DEFAULT_PASSWORD` from environment if present, defaulting to `Password123!`.
 */
export async function seedDatabase(client: PrismaClient = prisma) {
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || 'Password123!';
  const passwordHash = await hashPassword(defaultPassword);

  // 1. Create Primary Demo Tenant: Acme Corporation
  const acmeTenant = await client.tenant.upsert({
    where: { slug: 'acme-corp' },
    update: { name: 'Acme Corporation' },
    create: { name: 'Acme Corporation', slug: 'acme-corp' },
  });

  // 2. Create Second Demo Tenant: Globex Corporation
  const globexTenant = await client.tenant.upsert({
    where: { slug: 'globex-corp' },
    update: { name: 'Globex Corporation' },
    create: { name: 'Globex Corporation', slug: 'globex-corp' },
  });

  // 3. Create Demo Users
  const acmeAdmin = await client.user.upsert({
    where: { email: 'admin@acme.com' },
    update: { passwordHash },
    create: {
      name: 'Acme Admin',
      email: 'admin@acme.com',
      passwordHash,
      emailVerified: new Date(),
    },
  });

  const acmeMember = await client.user.upsert({
    where: { email: 'member@acme.com' },
    update: { passwordHash },
    create: {
      name: 'Alex Member',
      email: 'member@acme.com',
      passwordHash,
      emailVerified: new Date(),
    },
  });

  const globexOwner = await client.user.upsert({
    where: { email: 'owner@globex.com' },
    update: { passwordHash },
    create: {
      name: 'Globex Owner',
      email: 'owner@globex.com',
      passwordHash,
      emailVerified: new Date(),
    },
  });

  // 4. Create Memberships
  await client.membership.upsert({
    where: {
      userId_tenantId: {
        userId: acmeAdmin.id,
        tenantId: acmeTenant.id,
      },
    },
    update: { role: Role.OWNER, status: MembershipStatus.ACTIVE },
    create: {
      userId: acmeAdmin.id,
      tenantId: acmeTenant.id,
      role: Role.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });

  await client.membership.upsert({
    where: {
      userId_tenantId: {
        userId: acmeMember.id,
        tenantId: acmeTenant.id,
      },
    },
    update: { role: Role.MEMBER, status: MembershipStatus.ACTIVE },
    create: {
      userId: acmeMember.id,
      tenantId: acmeTenant.id,
      role: Role.MEMBER,
      status: MembershipStatus.ACTIVE,
    },
  });

  await client.membership.upsert({
    where: {
      userId_tenantId: {
        userId: globexOwner.id,
        tenantId: globexTenant.id,
      },
    },
    update: { role: Role.OWNER, status: MembershipStatus.ACTIVE },
    create: {
      userId: globexOwner.id,
      tenantId: globexTenant.id,
      role: Role.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });

  // 5. Create Categories for Acme Corp
  const hardwareCat = await client.category.upsert({
    where: {
      tenantId_name: {
        tenantId: acmeTenant.id,
        name: 'Hardware & Infrastructure',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      name: 'Hardware & Infrastructure',
      description: 'Physical enterprise equipment and networking',
    },
  });

  const furnitureCat = await client.category.upsert({
    where: {
      tenantId_name: {
        tenantId: acmeTenant.id,
        name: 'Office Furniture',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      name: 'Office Furniture',
      description: 'Ergonomic workplace desks and chairs',
    },
  });

  const servicesCat = await client.category.upsert({
    where: {
      tenantId_name: {
        tenantId: acmeTenant.id,
        name: 'Enterprise Services',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      name: 'Enterprise Services',
      description: 'Consulting, maintenance, and SLA packages',
    },
  });

  // 6. Create Products & Inventory for Acme Corp
  const acmeProductsData = [
    {
      name: 'Enterprise Server X1',
      sku: 'SRV-X1',
      description: 'High-density 2U rackmount server with redundant power',
      price: new Prisma.Decimal(2499.0),
      cost: new Prisma.Decimal(1800.0),
      categoryId: hardwareCat.id,
      initialStock: 14,
      reorderLevel: 4,
    },
    {
      name: 'Ergonomic Executive Chair',
      sku: 'CHR-ERG-01',
      description: 'High-grade breathable mesh chair with 4D adjustable armrests',
      price: new Prisma.Decimal(349.99),
      cost: new Prisma.Decimal(190.0),
      categoryId: furnitureCat.id,
      initialStock: 3,
      reorderLevel: 5,
    },
    {
      name: 'Wireless Mechanical Keyboard',
      sku: 'KB-MECH-PRO',
      description: 'Hot-swappable tactile mechanical keyboard with Bluetooth 5.2',
      price: new Prisma.Decimal(129.99),
      cost: new Prisma.Decimal(65.0),
      categoryId: hardwareCat.id,
      initialStock: 0,
      reorderLevel: 5,
    },
    {
      name: '24/7 Priority Support SLA (1 Year)',
      sku: 'SVC-SLA-1Y',
      description: 'Dedicated technical account manager with 15-minute response SLA',
      price: new Prisma.Decimal(1200.0),
      cost: new Prisma.Decimal(200.0),
      categoryId: servicesCat.id,
      initialStock: 50,
      reorderLevel: 10,
    },
  ];

  const createdAcmeProducts: Record<string, any> = {};

  for (const item of acmeProductsData) {
    const product = await client.product.upsert({
      where: {
        tenantId_sku: {
          tenantId: acmeTenant.id,
          sku: item.sku,
        },
      },
      update: {
        price: item.price,
        cost: item.cost,
        categoryId: item.categoryId,
        description: item.description,
      },
      create: {
        tenantId: acmeTenant.id,
        name: item.name,
        sku: item.sku,
        description: item.description,
        price: item.price,
        cost: item.cost,
        categoryId: item.categoryId,
        isActive: true,
      },
    });

    createdAcmeProducts[item.sku] = product;

    await client.inventory.upsert({
      where: { productId: product.id },
      update: { reorderLevel: item.reorderLevel },
      create: {
        tenantId: acmeTenant.id,
        productId: product.id,
        quantity: item.initialStock,
        reorderLevel: item.reorderLevel,
      },
    });
  }

  // 7. Create Category & Product for Globex Corp
  const globexCat = await client.category.upsert({
    where: {
      tenantId_name: {
        tenantId: globexTenant.id,
        name: 'Industrial Robotics',
      },
    },
    update: {},
    create: {
      tenantId: globexTenant.id,
      name: 'Industrial Robotics',
      description: 'Heavy assembly automation equipment',
    },
  });

  await client.product.upsert({
    where: {
      tenantId_sku: {
        tenantId: globexTenant.id,
        sku: 'ROB-HVY-99',
      },
    },
    update: {},
    create: {
      tenantId: globexTenant.id,
      name: 'Hydraulic Robotic Arm 9000',
      sku: 'ROB-HVY-99',
      description: '6-axis precision robotic arm for heavy manufacturing',
      price: new Prisma.Decimal(45000.0),
      cost: new Prisma.Decimal(32000.0),
      categoryId: globexCat.id,
      isActive: true,
    },
  });

  // 8. Create Customers for Acme Corp
  const customerJohn = await client.customer.findFirst({
    where: { tenantId: acmeTenant.id, name: 'John Smith' },
  });

  const acmeCustomer1 =
    customerJohn ??
    (await client.customer.create({
      data: {
        tenantId: acmeTenant.id,
        name: 'John Smith',
        email: 'john@example.com',
        phone: '+1 (555) 123-4567',
        companyName: 'Example Industries',
        address: '100 Market St, Suite 400',
        city: 'San Francisco, CA',
        notes: 'Net 30 payment terms, key account',
        isActive: true,
      },
    }));

  const customerSarah = await client.customer.findFirst({
    where: { tenantId: acmeTenant.id, name: 'Sarah Connor' },
  });

  await (customerSarah ??
    client.customer.create({
      data: {
        tenantId: acmeTenant.id,
        name: 'Sarah Connor',
        email: 'sarah@cyberdyne.io',
        phone: '+1 (555) 987-6543',
        companyName: 'Cyberdyne Systems',
        address: '2140 Tech Parkway',
        city: 'Los Angeles, CA',
        notes: 'Priority SLA customer',
        isActive: true,
      },
    }));

  // 9. Create Customers for Globex Corp
  const customerHank = await client.customer.findFirst({
    where: { tenantId: globexTenant.id, name: 'Hank Scorpio' },
  });

  if (!customerHank) {
    await client.customer.create({
      data: {
        tenantId: globexTenant.id,
        name: 'Hank Scorpio',
        email: 'scorpio@globex.com',
        phone: '+1 (555) 444-9999',
        companyName: 'Globex Advanced Labs',
        address: '1 Volcano Way',
        city: 'Cypress Creek',
        notes: 'International supplier account',
        isActive: true,
      },
    });
  }

  // 10. Create Sample Orders for Acme Corp if none exist
  const existingOrder = await client.order.findFirst({
    where: { tenantId: acmeTenant.id },
  });

  if (!existingOrder && createdAcmeProducts['CHR-ERG-01']) {
    const chairProduct = createdAcmeProducts['CHR-ERG-01'];
    const chairPrice = parseFloat(chairProduct.price.toString());
    const subtotal = chairPrice * 2;

    await client.order.create({
      data: {
        tenantId: acmeTenant.id,
        customerId: acmeCustomer1.id,
        status: OrderStatus.DRAFT,
        subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
        discount: new Prisma.Decimal('0.00'),
        total: new Prisma.Decimal(subtotal.toFixed(2)),
        notes: 'Sample draft order for ergonomic workplace upgrade',
        createdByUserId: acmeAdmin.id,
        items: {
          create: [
            {
              productId: chairProduct.id,
              quantity: 2,
              unitPrice: chairProduct.price,
              lineTotal: new Prisma.Decimal(subtotal.toFixed(2)),
            },
          ],
        },
      },
    });
  }

  return {
    acmeAdminEmail: 'admin@acme.com',
    acmeMemberEmail: 'member@acme.com',
    globexOwnerEmail: 'owner@globex.com',
  };
}
